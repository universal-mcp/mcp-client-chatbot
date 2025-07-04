import { createHash, randomBytes } from "crypto";
import logger from "@/lib/logger";

// Rate limiting for OAuth requests
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;
const requestCounts = new Map<string, { count: number; resetTime: number }>();

// Request timeout settings
const REQUEST_TIMEOUT = 30000; // 30 seconds
const DISCOVERY_TIMEOUT = 10000; // 10 seconds for discovery

// OAuth 2.1 Authorization Server Metadata
export interface AuthorizationServerMetadata {
  issuer?: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  scopes_supported?: string[];
  response_types_supported?: string[];
  grant_types_supported?: string[];
  code_challenge_methods_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
}

// OAuth client registration response
export interface ClientRegistrationResponse {
  client_id: string;
  client_secret?: string;
  client_id_issued_at?: number;
  client_secret_expires_at?: number;
  redirect_uris?: string[];
  grant_types?: string[];
  response_types?: string[];
  scope?: string;
}

// OAuth token response
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

// PKCE parameters
export interface PKCEParams {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
}

// OAuth authorization state
export interface AuthorizationState {
  serverId: string;
  serverName: string;
  userId: string;
  organizationId: string | null;
  codeVerifier: string;
  redirectUri: string;
  nonce: string;
}

export class MCPOAuthClient {
  private static readonly MCP_PROTOCOL_VERSION = "2024-11-05";
  private static readonly REDIRECT_PATH = "/api/mcp/oauth/callback";

  /**
   * Check rate limiting for OAuth requests
   */
  private static checkRateLimit(key: string): boolean {
    const now = Date.now();
    const record = requestCounts.get(key);

    if (!record || now > record.resetTime) {
      requestCounts.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
      return true;
    }

    if (record.count >= MAX_REQUESTS_PER_WINDOW) {
      logger.warn(`Rate limit exceeded for key: ${key}`);
      return false;
    }

    record.count++;
    return true;
  }

  /**
   * Create fetch with timeout and standard headers
   */
  private static async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number = REQUEST_TIMEOUT,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "User-Agent": "MCP-Client-Chatbot/1.0",
          Accept: "application/json",
          "Cache-Control": "no-cache",
          ...options.headers,
        },
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Validate URL security (HTTPS required in production)
   */
  static validateSecureUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);

      // In production, require HTTPS
      if (
        process.env.NODE_ENV === "production" &&
        urlObj.protocol !== "https:"
      ) {
        logger.error(`Insecure URL not allowed in production: ${url}`);
        return false;
      }

      // Allow localhost for development
      if (urlObj.hostname === "localhost" || urlObj.hostname === "127.0.0.1") {
        return true;
      }

      return urlObj.protocol === "https:";
    } catch {
      return false;
    }
  }

  /**
   * Generate PKCE parameters for OAuth 2.1 with S256 challenge method
   */
  static generatePKCEParams(): PKCEParams {
    // Generate 128 bytes of random data and base64url encode (43 characters)
    const codeVerifier = randomBytes(32)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    // Create SHA256 hash and base64url encode
    const codeChallenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    return {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: "S256",
    };
  }

  /**
   * Generate random state parameter for CSRF protection
   */
  static generateState(): string {
    return randomBytes(16).toString("hex");
  }

  /**
   * Get authorization base URL from MCP server URL
   */
  static getAuthorizationBaseUrl(mcpServerUrl: string): string {
    const url = new URL(mcpServerUrl);
    return `${url.protocol}//${url.host}`;
  }

  /**
   * Discover OAuth authorization server metadata
   */
  static async discoverMetadata(
    mcpServerUrl: string,
  ): Promise<AuthorizationServerMetadata | null> {
    const baseUrl = this.getAuthorizationBaseUrl(mcpServerUrl);
    const metadataUrl = `${baseUrl}/.well-known/oauth-authorization-server`;

    // Validate URL security
    if (!this.validateSecureUrl(metadataUrl)) {
      logger.error(`Insecure metadata URL rejected: ${metadataUrl}`);
      return null;
    }

    // Rate limiting check
    if (!this.checkRateLimit(`discovery:${baseUrl}`)) {
      logger.error("Rate limit exceeded for metadata discovery");
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    try {
      logger.info(`Discovering OAuth metadata at: ${metadataUrl}`);

      const response = await this.fetchWithTimeout(
        metadataUrl,
        {
          method: "GET",
          headers: {
            "MCP-Protocol-Version": this.MCP_PROTOCOL_VERSION,
          },
        },
        DISCOVERY_TIMEOUT,
      );

      if (!response.ok) {
        logger.warn(
          `Metadata discovery failed with status ${response.status}, falling back to default endpoints`,
        );
        return null;
      }

      const metadata = (await response.json()) as AuthorizationServerMetadata;

      // Validate discovered metadata
      if (!metadata.authorization_endpoint || !metadata.token_endpoint) {
        logger.error("Invalid metadata: missing required endpoints");
        return null;
      }

      // Validate endpoint URLs
      if (
        !this.validateSecureUrl(metadata.authorization_endpoint) ||
        !this.validateSecureUrl(metadata.token_endpoint)
      ) {
        logger.error("Insecure endpoints in metadata");
        return null;
      }

      logger.info("Successfully discovered OAuth metadata");
      return metadata;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        logger.error("Metadata discovery timed out");
      } else {
        logger.error("Metadata discovery failed:", error);
      }
      return null;
    }
  }

  /**
   * Get OAuth endpoints (discovered or fallback)
   */
  static async getOAuthEndpoints(mcpServerUrl: string): Promise<{
    authorizationEndpoint: string;
    tokenEndpoint: string;
    registrationEndpoint?: string;
  }> {
    const baseUrl = this.getAuthorizationBaseUrl(mcpServerUrl);
    const metadata = await this.discoverMetadata(mcpServerUrl);

    if (metadata) {
      return {
        authorizationEndpoint: metadata.authorization_endpoint,
        tokenEndpoint: metadata.token_endpoint,
        registrationEndpoint: metadata.registration_endpoint,
      };
    }

    // Fallback to default endpoints as per specification
    logger.info("Using fallback OAuth endpoints");
    return {
      authorizationEndpoint: `${baseUrl}/authorize`,
      tokenEndpoint: `${baseUrl}/token`,
      registrationEndpoint: `${baseUrl}/register`,
    };
  }

  /**
   * Perform dynamic client registration
   */
  static async registerClient(
    registrationEndpoint: string,
    redirectUri: string,
  ): Promise<ClientRegistrationResponse | null> {
    // Validate URLs
    if (!this.validateSecureUrl(registrationEndpoint)) {
      logger.error(
        `Insecure registration endpoint rejected: ${registrationEndpoint}`,
      );
      return null;
    }

    if (!this.validateRedirectUri(redirectUri)) {
      logger.error(`Invalid redirect URI: ${redirectUri}`);
      return null;
    }

    // Rate limiting
    const baseUrl = this.getAuthorizationBaseUrl(registrationEndpoint);
    if (!this.checkRateLimit(`registration:${baseUrl}`)) {
      logger.error("Rate limit exceeded for client registration");
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    try {
      logger.info(
        `Attempting dynamic client registration at: ${registrationEndpoint}`,
      );

      const registrationData = {
        client_name: "Wingmen",
        redirect_uris: [redirectUri],
        grant_types: ["authorization_code"],
        response_types: ["code"],
        token_endpoint_auth_method: "none", // Public client
        application_type: "web",
        // Additional security metadata
        software_id: "Wingmen",
        software_version: process.env.npm_package_version || "1.0.0",
      };

      const response = await this.fetchWithTimeout(registrationEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "MCP-Protocol-Version": this.MCP_PROTOCOL_VERSION,
        },
        body: JSON.stringify(registrationData),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        logger.error(
          `Dynamic client registration failed with status ${response.status}: ${errorText}`,
        );
        return null;
      }

      const clientData = (await response.json()) as ClientRegistrationResponse;

      // Validate client registration response
      if (!clientData.client_id || typeof clientData.client_id !== "string") {
        logger.error("Invalid client registration response: missing client_id");
        return null;
      }

      logger.info("Dynamic client registration successful");
      return clientData;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        logger.error("Client registration timed out");
      } else {
        logger.error("Dynamic client registration failed:", error);
      }
      return null;
    }
  }

  /**
   * Build authorization URL with PKCE parameters
   */
  static buildAuthorizationUrl(
    authorizationEndpoint: string,
    clientId: string,
    redirectUri: string,
    pkceParams: PKCEParams,
    state: string,
    scope?: string,
  ): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: pkceParams.codeChallenge,
      code_challenge_method: "S256",
      state: state,
    });

    if (scope) {
      params.set("scope", scope);
    }

    return `${authorizationEndpoint}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  static async exchangeCodeForToken(
    tokenEndpoint: string,
    clientId: string,
    clientSecret: string | undefined,
    code: string,
    redirectUri: string,
    codeVerifier: string,
  ): Promise<TokenResponse | null> {
    // Validate inputs
    if (!this.validateSecureUrl(tokenEndpoint)) {
      logger.error(`Insecure token endpoint rejected: ${tokenEndpoint}`);
      return null;
    }

    if (!this.validateRedirectUri(redirectUri)) {
      logger.error(`Invalid redirect URI: ${redirectUri}`);
      return null;
    }

    if (!code || !clientId || !codeVerifier) {
      logger.error("Missing required parameters for token exchange");
      return null;
    }

    // Rate limiting
    const baseUrl = this.getAuthorizationBaseUrl(tokenEndpoint);
    if (!this.checkRateLimit(`token:${baseUrl}:${clientId}`)) {
      logger.error("Rate limit exceeded for token exchange");
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    try {
      logger.info("Exchanging authorization code for access token");

      const tokenData = new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: codeVerifier,
      });

      const headers: Record<string, string> = {
        "Content-Type": "application/x-www-form-urlencoded",
        "MCP-Protocol-Version": this.MCP_PROTOCOL_VERSION,
      };

      // Add client secret if available (for confidential clients)
      if (clientSecret) {
        const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
          "base64",
        );
        headers["Authorization"] = `Basic ${credentials}`;
      }

      const response = await this.fetchWithTimeout(tokenEndpoint, {
        method: "POST",
        headers,
        body: tokenData,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        logger.error(
          `Token exchange failed with status ${response.status}: ${errorText}`,
        );
        return null;
      }

      const tokens = await response.json();

      // Validate token response
      if (!this.validateTokenResponse(tokens)) {
        logger.error("Invalid token response format");
        return null;
      }

      logger.info("Successfully exchanged code for tokens");
      return tokens;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        logger.error("Token exchange timed out");
      } else {
        logger.error("Token exchange failed:", error);
      }
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshToken(
    tokenEndpoint: string,
    clientId: string,
    clientSecret: string | undefined,
    refreshToken: string,
  ): Promise<TokenResponse | null> {
    // Validate inputs
    if (!this.validateSecureUrl(tokenEndpoint)) {
      logger.error(`Insecure token endpoint rejected: ${tokenEndpoint}`);
      return null;
    }

    if (!refreshToken || !clientId) {
      logger.error("Missing required parameters for token refresh");
      return null;
    }

    // Rate limiting
    const baseUrl = this.getAuthorizationBaseUrl(tokenEndpoint);
    if (!this.checkRateLimit(`refresh:${baseUrl}:${clientId}`)) {
      logger.error("Rate limit exceeded for token refresh");
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    try {
      logger.info("Refreshing access token");

      const tokenData = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
      });

      const headers: Record<string, string> = {
        "Content-Type": "application/x-www-form-urlencoded",
        "MCP-Protocol-Version": this.MCP_PROTOCOL_VERSION,
      };

      if (clientSecret) {
        const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
          "base64",
        );
        headers["Authorization"] = `Basic ${credentials}`;
      }

      const response = await this.fetchWithTimeout(tokenEndpoint, {
        method: "POST",
        headers,
        body: tokenData,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        logger.error(
          `Token refresh failed with status ${response.status}: ${errorText}`,
        );
        return null;
      }

      const tokens = await response.json();

      // Validate token response
      if (!this.validateTokenResponse(tokens)) {
        logger.error("Invalid token response format");
        return null;
      }

      logger.info("Successfully refreshed access token");
      return tokens;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        logger.error("Token refresh timed out");
      } else {
        logger.error("Token refresh failed:", error);
      }
      return null;
    }
  }

  /**
   * Get redirect URI for OAuth callback
   */
  static getRedirectUri(): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return `${baseUrl}${this.REDIRECT_PATH}`;
  }

  /**
   * Enhanced URL validation for redirect URIs
   */
  static validateRedirectUri(redirectUri: string): boolean {
    if (!this.validateSecureUrl(redirectUri)) {
      return false;
    }

    // Additional checks
    try {
      const parsed = new URL(redirectUri);

      // Prevent open redirects
      if (parsed.pathname.includes("..") || parsed.pathname.includes("//")) {
        return false;
      }

      // Ensure it's our callback endpoint
      if (!parsed.pathname.endsWith("/api/mcp/oauth/callback")) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Enhanced token validation
   */
  static validateTokenResponse(
    tokenResponse: any,
  ): tokenResponse is TokenResponse {
    return (
      tokenResponse &&
      typeof tokenResponse.access_token === "string" &&
      tokenResponse.access_token.length > 0 &&
      typeof tokenResponse.token_type === "string" &&
      tokenResponse.token_type.toLowerCase() === "bearer"
    );
  }
}
