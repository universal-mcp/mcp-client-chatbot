import { NextRequest, NextResponse } from "next/server";
import { MCPOAuthClient } from "lib/oauth/oauth-client";
import { OAuthStateManager } from "lib/oauth/oauth-state-manager";
import { getSessionContext } from "@/lib/auth/session-context";
import { pgMcpOAuthClientRepository } from "@/lib/db/pg/repositories/mcp-repository.pg";
import logger from "@/lib/logger";
import { globalMCPManager } from "@/lib/ai/mcp/global-mcp-manager";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const redirectUri = MCPOAuthClient.getRedirectUri();

  try {
    // Handle OAuth errors
    if (error) {
      logger.error(`OAuth authorization error: ${error} - ${errorDescription}`);
      return NextResponse.redirect(
        new URL(
          `/integrations?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || "")}`,
          redirectUri,
        ),
      );
    }

    // Validate required parameters
    if (!code || !state) {
      logger.error("Missing required OAuth callback parameters");
      return NextResponse.redirect(
        new URL("/integrations?error=invalid_request", redirectUri),
      );
    }

    // Get user session
    const { userId, organizationId } = await getSessionContext();

    // Retrieve and validate authorization state from secure storage
    const authState = await OAuthStateManager.getState(state);

    if (!authState) {
      logger.error("Invalid or expired authorization state");
      return NextResponse.redirect(
        new URL("/integrations?error=invalid_state", redirectUri),
      );
    }

    // Validate state matches current user
    if (
      authState.userId !== userId ||
      authState.organizationId !== organizationId
    ) {
      logger.error("Authorization state user/organization mismatch");
      await OAuthStateManager.clearState(); // Clear state on mismatch
      return NextResponse.redirect(
        new URL("/integrations?error=invalid_state", redirectUri),
      );
    }

    // Get OAuth client configuration
    const clientConfig = await pgMcpOAuthClientRepository.findByServerId(
      authState.serverId,
      userId,
      organizationId,
    );

    if (!clientConfig) {
      logger.error("OAuth client configuration not found");
      return NextResponse.redirect(
        new URL("/integrations?error=client_not_found", redirectUri),
      );
    }

    // Exchange authorization code for access token
    const tokenResponse = await MCPOAuthClient.exchangeCodeForToken(
      clientConfig.tokenEndpoint,
      clientConfig.clientId,
      clientConfig.clientSecret || undefined,
      code,
      clientConfig.redirectUri,
      authState.codeVerifier,
    );

    if (!tokenResponse) {
      logger.error("Failed to exchange authorization code for token");
      return NextResponse.redirect(
        new URL("/integrations?error=token_exchange_failed", redirectUri),
      );
    }

    // Calculate token expiration
    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : null;

    await globalMCPManager.saveAccessToken(
      userId,
      organizationId,
      authState.serverId,
      tokenResponse.access_token,
      tokenResponse.refresh_token || null,
      tokenResponse.token_type,
      tokenResponse.scope || null,
      expiresAt,
    );
    logger.info(
      `Successfully stored OAuth token for server ${authState.serverName}`,
    );

    // Clean up authorization state after successful use
    await OAuthStateManager.clearState();

    // Redirect back to integrations page with success
    return NextResponse.redirect(
      new URL(
        `/integrations?success=authorized&server=${encodeURIComponent(authState.serverName)}`,
        redirectUri,
      ),
    );
  } catch (error) {
    logger.error("OAuth callback error:", error);

    // Try to clean up state even on error
    await OAuthStateManager.clearState();

    return NextResponse.redirect(
      new URL("/integrations?error=callback_error", redirectUri),
    );
  }
}
