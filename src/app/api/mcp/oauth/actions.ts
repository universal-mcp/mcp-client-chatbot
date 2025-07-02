"use server";

import {
  checkAdminPermission,
  getSessionContext,
} from "@/lib/auth/session-context";
import { MCPOAuthClient } from "lib/oauth/oauth-client";
import { OAuthStateManager } from "lib/oauth/oauth-state-manager";
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

export interface AccessTokenResult {
  token: string;
  expiresAt?: Date;
}

/**
 * Initiate OAuth authorization flow for an MCP server
 */
export async function authorizeServerAction(
  serverId: string,
  credentialType?: "personal" | "shared",
): Promise<AuthorizeServerResponse> {
  return safe(async () => {
    const { userId, organizationId } = await getSessionContext();

    // Rate limiting check
    if (!checkOAuthActionRateLimit(userId)) {
      throw new Error(
        "Too many OAuth requests. Please wait before trying again.",
      );
    }

    // Check if this is a shared credential server in an organization workspace
    const isSharedCredentials = credentialType === "shared";
    if (isSharedCredentials && organizationId) {
      // Only check admin permissions for shared credentials in organization workspaces
      await checkAdminPermission();
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

    // All servers are remote now
    const serverUrl = (mcpServer.config as any).url;

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
 * Revoke authorization for an MCP server
 */
export async function revokeAuthorizationAction(
  serverId: string,
  credentialType?: "personal" | "shared",
): Promise<{ success: boolean; error?: string }> {
  return safe(async () => {
    const { userId, organizationId } = await getSessionContext();

    // Rate limiting check
    if (!checkOAuthActionRateLimit(userId)) {
      throw new Error(
        "Too many OAuth requests. Please wait before trying again.",
      );
    }

    // Check if this is a shared credential server in an organization workspace
    const isSharedCredentials = credentialType === "shared";
    if (isSharedCredentials && organizationId) {
      // Only check admin permissions for shared credentials in organization workspaces
      await checkAdminPermission();
    }

    await pgMcpOAuthTokenRepository.deleteByServerId(
      serverId,
      userId,
      organizationId,
      credentialType,
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
  credentialType?: "personal" | "shared",
): Promise<AccessTokenResult | null> {
  return safe(async () => {
    const { userId, organizationId } = await getSessionContext();

    // Create cache key for this user/server combination
    const cacheKey = `oauth:token:${userId}:${serverId}:${organizationId || "null"}`;

    // Try to get from cache first (for performance)
    const cachedTokenData = await serverCache.get<AccessTokenResult>(cacheKey);
    if (cachedTokenData) {
      return cachedTokenData;
    }

    const token = await pgMcpOAuthTokenRepository.findByServerId(
      serverId,
      userId,
      organizationId,
      credentialType,
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

            const tokenResult = {
              token: currentAccessToken,
              expiresAt: newExpiresAt || undefined,
            };
            await serverCache.set(cacheKey, tokenResult, cacheTimeMs);
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
        const tokenResult = {
          token: currentAccessToken,
          expiresAt: token.expiresAt,
        };
        await serverCache.set(cacheKey, tokenResult, cacheTime);
      }
    } else if (!token.expiresAt) {
      // Token doesn't expire, cache for 1 hour
      const tokenResult = { token: currentAccessToken, expiresAt: undefined };
      await serverCache.set(cacheKey, tokenResult, 3600000);
    }

    return {
      token: currentAccessToken,
      expiresAt: token.expiresAt || undefined,
    };
  })
    .ifFail((error) => {
      logger.error("Failed to get access token:", error);
      return null;
    })
    .unwrap();
}
