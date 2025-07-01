"use server";

import { getSessionContext } from "@/lib/auth/session-context";
import { MCPOAuthClient } from "lib/oauth/oauth-client";
import { OAuthStateManager } from "lib/oauth/oauth-state-manager";
import { isMaybeRemoteConfig } from "@/lib/ai/mcp/is-mcp-config";
import { serverCache } from "@/lib/cache";
import {
  pgMcpOAuthClientRepository,
  pgMcpOAuthTokenRepository,
  pgMcpRepository,
} from "@/lib/db/pg/repositories/mcp-repository.pg";
import logger from "@/lib/logger";
import { safe } from "ts-safe";

// Rate limiting for OAuth actions (per user)
const OAUTH_ACTION_RATE_LIMIT = 5; // 5 actions per minute per user
const OAUTH_ACTION_WINDOW = 60000; // 1 minute
const userActionCounts = new Map<
  string,
  { count: number; resetTime: number }
>();

/**
 * Check rate limit for OAuth actions per user
 */
function checkOAuthActionRateLimit(userId: string): boolean {
  const now = Date.now();
  const record = userActionCounts.get(userId);

  if (!record || now > record.resetTime) {
    userActionCounts.set(userId, {
      count: 1,
      resetTime: now + OAUTH_ACTION_WINDOW,
    });
    return true;
  }

  if (record.count >= OAUTH_ACTION_RATE_LIMIT) {
    logger.warn(`OAuth action rate limit exceeded for user: ${userId}`);
    return false;
  }

  record.count++;
  return true;
}

export interface AuthorizeServerResponse {
  success: boolean;
  authorizationUrl?: string;
  error?: string;
}

export interface AuthorizationStatus {
  isAuthorized: boolean;
  hasToken: boolean;
  tokenExpiry?: Date;
}

/**
 * Initiate OAuth authorization flow for an MCP server
 */
export async function authorizeServerAction(
  serverId: string,
): Promise<AuthorizeServerResponse> {
  return safe(async () => {
    const { userId, organizationId } = await getSessionContext();

    // Rate limiting check
    if (!checkOAuthActionRateLimit(userId)) {
      throw new Error(
        "Too many OAuth requests. Please wait before trying again.",
      );
    }

    // Get the MCP server configuration
    const mcpServer = await pgMcpRepository.selectById(
      serverId,
      userId,
      organizationId,
    );

    if (!mcpServer) {
      throw new Error("MCP server not found");
    }

    // Check if it's a remote server (OAuth only applies to HTTP-based transports)
    if (!isMaybeRemoteConfig(mcpServer.config)) {
      throw new Error(
        "OAuth authorization is only supported for remote MCP servers",
      );
    }

    const serverUrl = mcpServer.config.url;

    // Discover OAuth endpoints
    const endpoints = await MCPOAuthClient.getOAuthEndpoints(serverUrl);

    // Check if we already have a client registration
    let clientConfig = await pgMcpOAuthClientRepository.findByServerId(
      serverId,
      userId,
      organizationId,
    );

    // If no client exists, try dynamic registration
    if (!clientConfig) {
      const redirectUri = MCPOAuthClient.getRedirectUri();

      if (endpoints.registrationEndpoint) {
        logger.info(
          `Attempting dynamic client registration for server: ${mcpServer.name}`,
        );

        const registrationResult = await MCPOAuthClient.registerClient(
          endpoints.registrationEndpoint,
          redirectUri,
        );

        if (registrationResult) {
          // Store the client configuration
          clientConfig = await pgMcpOAuthClientRepository.save({
            userId,
            organizationId,
            mcpServerId: serverId,
            clientId: registrationResult.client_id,
            clientSecret: registrationResult.client_secret || null,
            redirectUri,
            authorizationEndpoint: endpoints.authorizationEndpoint,
            tokenEndpoint: endpoints.tokenEndpoint,
            registrationEndpoint: endpoints.registrationEndpoint || null,
            isDynamicallyRegistered: true,
          });
          logger.info(
            `Successfully registered OAuth client for server: ${mcpServer.name}`,
          );
        }
      }

      // If dynamic registration failed or not supported, return error
      if (!clientConfig) {
        throw new Error(
          "This MCP server requires OAuth authorization but does not support dynamic client registration. " +
            "Please contact the server administrator to obtain OAuth client credentials.",
        );
      }
    }

    // Generate PKCE parameters and state
    const pkceParams = MCPOAuthClient.generatePKCEParams();
    const nonce = MCPOAuthClient.generateState();

    // Store authorization state securely
    const publicState = await OAuthStateManager.storeState({
      serverId,
      serverName: mcpServer.name,
      userId,
      organizationId,
      codeVerifier: pkceParams.codeVerifier,
      redirectUri: clientConfig.redirectUri,
      nonce,
    });

    // Build authorization URL
    const authorizationUrl = MCPOAuthClient.buildAuthorizationUrl(
      clientConfig.authorizationEndpoint,
      clientConfig.clientId,
      clientConfig.redirectUri,
      pkceParams,
      publicState,
    );

    logger.info(`Generated authorization URL for server: ${mcpServer.name}`);

    return {
      success: true,
      authorizationUrl,
    };
  })
    .ifFail((error) => {
      logger.error("Failed to initiate OAuth authorization:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to initiate authorization",
      };
    })
    .unwrap();
}

/**
 * Check authorization status for an MCP server
 */
export async function getAuthorizationStatusAction(
  serverId: string,
): Promise<AuthorizationStatus> {
  return safe(async () => {
    const { userId, organizationId } = await getSessionContext();

    const token = await pgMcpOAuthTokenRepository.findByServerId(
      serverId,
      userId,
      organizationId,
    );

    if (!token) {
      return {
        isAuthorized: false,
        hasToken: false,
      };
    }

    const now = new Date();
    const isExpired = token.expiresAt && token.expiresAt < now;

    return {
      isAuthorized: !isExpired,
      hasToken: true,
      tokenExpiry: token.expiresAt || undefined,
    };
  })
    .ifFail(() => {
      return {
        isAuthorized: false,
        hasToken: false,
      };
    })
    .unwrap();
}

/**
 * Revoke authorization for an MCP server
 */
export async function revokeAuthorizationAction(
  serverId: string,
): Promise<{ success: boolean; error?: string }> {
  return safe(async () => {
    const { userId, organizationId } = await getSessionContext();

    // Rate limiting check
    if (!checkOAuthActionRateLimit(userId)) {
      throw new Error(
        "Too many OAuth requests. Please wait before trying again.",
      );
    }

    await pgMcpOAuthTokenRepository.deleteByServerId(
      serverId,
      userId,
      organizationId,
    );

    // Clear token from cache
    const cacheKey = `oauth:token:${userId}:${serverId}:${organizationId || "null"}`;
    await serverCache.delete(cacheKey);

    logger.info(`Revoked OAuth authorization for server: ${serverId}`);

    return { success: true };
  })
    .ifFail((error) => {
      logger.error("Failed to revoke authorization:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to revoke authorization",
      };
    })
    .unwrap();
}

/**
 * Get access token for MCP server (with automatic refresh and caching)
 */
export async function getAccessTokenAction(
  serverId: string,
): Promise<string | null> {
  return safe(async () => {
    const { userId, organizationId } = await getSessionContext();

    // Create cache key for this user/server combination
    const cacheKey = `oauth:token:${userId}:${serverId}:${organizationId || "null"}`;

    // Try to get from cache first (for performance)
    const cachedToken = await serverCache.get<string>(cacheKey);
    if (cachedToken) {
      return cachedToken;
    }

    const token = await pgMcpOAuthTokenRepository.findByServerId(
      serverId,
      userId,
      organizationId,
    );

    if (!token) {
      logger.warn(`No OAuth token found for server: ${serverId}`);
      return null;
    }

    const now = new Date();

    // Check if token is expired or will expire soon (within 5 minutes for proactive refresh)
    const expiryBuffer = 5 * 60 * 1000; // 5 minutes
    const isExpiring =
      token.expiresAt &&
      token.expiresAt.getTime() - now.getTime() < expiryBuffer;

    let currentAccessToken = token.accessToken;

    if (isExpiring && token.refreshToken) {
      logger.info(
        `Token expiring soon for server ${serverId}, attempting refresh`,
      );

      // Get client configuration for refresh
      const client = await pgMcpOAuthClientRepository.findByServerId(
        serverId,
        userId,
        organizationId,
      );

      if (client) {
        try {
          const refreshResult = await MCPOAuthClient.refreshToken(
            client.tokenEndpoint,
            client.clientId,
            client.clientSecret || undefined,
            token.refreshToken,
          );

          if (refreshResult) {
            // Update token in database
            const newExpiresAt = refreshResult.expires_in
              ? new Date(Date.now() + refreshResult.expires_in * 1000)
              : null;

            await pgMcpOAuthTokenRepository.save({
              userId,
              organizationId,
              mcpServerId: serverId,
              accessToken: refreshResult.access_token,
              refreshToken: refreshResult.refresh_token || token.refreshToken,
              expiresAt: newExpiresAt,
              tokenType: "Bearer",
              scope: token.scope,
            });

            currentAccessToken = refreshResult.access_token;
            logger.info(
              `Successfully refreshed access token for server: ${serverId}`,
            );

            // Cache the new token (cache for 90% of its lifetime or 1 hour, whichever is shorter)
            const cacheTimeMs = refreshResult.expires_in
              ? Math.min(refreshResult.expires_in * 900, 3600000) // 90% of lifetime or 1 hour
              : 3600000; // Default 1 hour

            await serverCache.set(cacheKey, currentAccessToken, cacheTimeMs);
          } else {
            logger.error(`Failed to refresh token for server: ${serverId}`);
            // Token refresh failed, return null to force re-authorization
            if (token.expiresAt && token.expiresAt < now) {
              return null;
            }
          }
        } catch (refreshError) {
          logger.error(
            `Error during token refresh for server ${serverId}:`,
            refreshError,
          );
          // If token is actually expired, return null
          if (token.expiresAt && token.expiresAt < now) {
            return null;
          }
        }
      } else {
        logger.error(
          `No OAuth client configuration found for server: ${serverId}`,
        );
        return null;
      }
    } else if (!isExpiring && token.expiresAt) {
      // Token is still valid, cache it
      const remainingTime = token.expiresAt.getTime() - now.getTime();
      const cacheTime = Math.min(remainingTime * 0.9, 3600000); // 90% of remaining time or 1 hour

      if (cacheTime > 60000) {
        // Only cache if more than 1 minute remaining
        await serverCache.set(cacheKey, currentAccessToken, cacheTime);
      }
    } else if (!token.expiresAt) {
      // Token doesn't expire, cache for 1 hour
      await serverCache.set(cacheKey, currentAccessToken, 3600000);
    }

    return currentAccessToken;
  })
    .ifFail((error) => {
      logger.error("Failed to get access token:", error);
      return null;
    })
    .unwrap();
}
