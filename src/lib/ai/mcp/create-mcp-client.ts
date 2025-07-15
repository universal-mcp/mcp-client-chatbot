import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  type MCPServerInfo,
  MCPRemoteConfigZodSchema,
  type MCPServerConfig,
  type MCPToolInfo,
  type MCPOAuthStatus,
} from "app-types/mcp";
import { jsonSchema, Tool, tool, ToolExecutionOptions } from "ai";
import logger from "logger";
import type { ConsolaInstance } from "consola";
import { colorize } from "consola/utils";
import {
  createDebounce,
  errorToString,
  isNull,
  Locker,
  toAny,
} from "lib/utils";

import { safe } from "ts-safe";

type ClientOptions = {
  autoDisconnectSeconds?: number;
  serverId?: string; // MCP server ID for OAuth token lookup
  credentialType?: "personal" | "shared"; // Credential type for OAuth optimization
  accessToken?: string; // Pre-fetched access token to avoid redundant lookups
  tokenExpiry?: Date; // Token expiry date for OAuth status tracking
};

/**
 * Client class for Model Context Protocol (MCP) server connections
 */
export class MCPClient {
  private client?: Client;
  private error?: unknown;
  private isConnected = false;
  private log: ConsolaInstance;
  private locker = new Locker();
  private serverId?: string;
  private oauthStatus: MCPOAuthStatus;
  // Information about available tools from the server
  toolInfo: MCPToolInfo[] = [];
  // Tool instances that can be used for AI functions
  tools: { [key: string]: Tool } = {};

  constructor(
    private name: string,
    private serverConfig: MCPServerConfig,
    private options: ClientOptions = {},
    private disconnectDebounce = createDebounce(),
  ) {
    this.log = logger.withDefaults({
      message: colorize("cyan", `MCP Client ${this.name}: `),
    });
    this.serverId = options.serverId;
    // Initialize OAuth status - will be updated during connection
    this.oauthStatus = {
      required: false,
      isAuthorized: false,
      hasToken: false,
      tokenExpiry: undefined,
    };
  }

  getInfo(): MCPServerInfo {
    return {
      name: this.name,
      config: this.serverConfig,
      status: this.locker.isLocked
        ? "loading"
        : this.isConnected
          ? "connected"
          : "disconnected",
      error: this.error,
      toolInfo: this.toolInfo,
      oauthStatus: this.oauthStatus,
    };
  }

  private scheduleAutoDisconnect() {
    if (this.options.autoDisconnectSeconds) {
      this.disconnectDebounce(() => {
        this.disconnect();
      }, this.options.autoDisconnectSeconds * 1000);
    }
  }

  /**
   * Connect to the MCP server
   * Do not throw Error
   * @returns this
   */
  async connect() {
    if (this.locker.isLocked) {
      await this.locker.wait();
      return this.client;
    }
    if (this.isConnected) {
      return this.client;
    }
    try {
      const startedAt = Date.now();
      this.locker.lock();

      const client = new Client({
        name: "mcp-chatbot-client",
        version: "1.0.0",
      });

      // All servers are remote-only now
      const config = MCPRemoteConfigZodSchema.parse(this.serverConfig);
      const abortController = new AbortController();
      const url = new URL(config.url);

      // Prepare headers with OAuth authorization if available
      const headers: Record<string, string> = { ...config.headers };

      // Reset OAuth status for this connection attempt
      this.oauthStatus.required = false;
      this.oauthStatus.isAuthorized = false;
      this.oauthStatus.hasToken = false;
      this.oauthStatus.tokenExpiry = undefined;

      // Add OAuth authorization header if we have an access token
      if (this.options.accessToken) {
        headers["Authorization"] = `Bearer ${this.options.accessToken}`;
        headers["X-OAuth-Server-ID"] = this.serverId || "unknown"; // Add server ID for debugging
        headers["X-Request-Source"] = "mcp-client-chatbot"; // Add source identifier
        this.log.info("Added OAuth authorization header to request");
        this.oauthStatus.hasToken = true;
        this.oauthStatus.tokenExpiry = this.options.tokenExpiry;
      } else if (this.serverId) {
        this.log.warn(
          `No access token provided for server: ${this.name}. Server may require authorization.`,
        );
        // Add a header to indicate no token was provided
        headers["X-OAuth-Status"] = "no-token";
      } else {
        // No server ID provided, likely a legacy configuration
        this.log.debug("No server ID provided for OAuth token lookup");
      }

      try {
        const transport = new StreamableHTTPClientTransport(url, {
          requestInit: {
            headers,
            signal: abortController.signal,
          },
        });
        transport.onclose = () => {
          this.isConnected = false;
          this.client = undefined;
        };
        await client.connect(transport);
        // Connection successful - we're authorized regardless of whether we had a token
        this.oauthStatus.isAuthorized = true;
        this.oauthStatus.required = this.oauthStatus.hasToken; // OAuth was required if we needed a token
      } catch (streamError) {
        this.log.info(
          "Streamable HTTP connection failed, falling back to SSE transport",
        );
        try {
          const transport = new SSEClientTransport(url, {
            requestInit: {
              headers,
              signal: abortController.signal,
            },
          });
          transport.onclose = () => {
            this.isConnected = false;
            this.client = undefined;
          };
          await client.connect(transport);
          // Connection successful - we're authorized regardless of whether we had a token
          this.oauthStatus.isAuthorized = true;
          this.oauthStatus.required = this.oauthStatus.hasToken; // OAuth was required if we needed a token
        } catch (sseError) {
          if (
            errorToString(sseError).includes("401") ||
            errorToString(streamError).includes("401")
          ) {
            // 401 error indicates OAuth is required
            this.oauthStatus.required = true;
            this.oauthStatus.isAuthorized = false;
          }
          throw sseError;
        }
      }

      this.log.info(
        `Connected to MCP server in ${((Date.now() - startedAt) / 1000).toFixed(2)}s`,
      );
      this.isConnected = true;
      this.error = undefined;
      this.client = client;
      const toolResponse = await client.listTools();
      this.toolInfo = toolResponse.tools.map(
        (tool) =>
          ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          }) as MCPToolInfo,
      );

      // Create AI SDK tool wrappers for each MCP tool
      this.tools = toolResponse.tools.reduce((prev, _tool) => {
        const parameters = jsonSchema(
          toAny({
            ..._tool.inputSchema,
            properties: _tool.inputSchema.properties ?? {},
            additionalProperties: false,
          }),
        );
        prev[_tool.name] = tool({
          parameters,
          description: _tool.description,
          execute: (params, options: ToolExecutionOptions) => {
            options?.abortSignal?.throwIfAborted();
            return this.callTool(_tool.name, params);
          },
        });
        return prev;
      }, {});
      this.scheduleAutoDisconnect();
    } catch (error) {
      this.log.error(error);
      this.isConnected = false;
      this.error = error;
      if (errorToString(error).includes("401")) {
        // 401 error indicates OAuth is required
        this.oauthStatus.required = true;
        this.oauthStatus.isAuthorized = false;
        // Keep existing hasToken value since we may have tried with a token
      }
    }

    this.locker.unlock();
    return this.client;
  }

  async disconnect() {
    this.log.info("Disconnecting from MCP server");
    await this.locker.wait();
    this.isConnected = false;
    const client = this.client;
    this.client = undefined;
    await client?.close().catch((e) => {
      // AbortError is expected when closing SSE connections - don't log it as an error
      if (e?.name !== "AbortError") {
        this.log.error(e);
      }
    });
  }

  async callTool(toolName: string, input?: unknown) {
    return safe(async () => {
      if (this.client && this.isConnected) {
        try {
          // Proactively check the connection by making a lightweight request.
          // If this fails, we'll assume the connection is dead and force a reconnect.
          const toolResponse = await this.client.listTools();
          console.log("toolResponse", toolResponse);
        } catch (error) {
          this.log.warn(
            "Connection check failed, assuming disconnected. Forcing reconnect.",
            errorToString(error),
          );
          this.isConnected = false;
          this.client = undefined; // Ensure we get a new client instance
        }
      }
    })
      .ifOk(() => {
        if (this.error) {
          throw new Error(
            "MCP Server is currently in an error state. Please check the configuration and try refreshing the server.",
          );
        }
      })
      .ifOk(() => this.scheduleAutoDisconnect()) // disconnect if autoDisconnectSeconds is set
      .map(async () => {
        const client = await this.connect();
        return client?.callTool({
          name: toolName,
          arguments: input as Record<string, unknown>,
        });
      })
      .ifOk((v) => {
        if (isNull(v)) {
          throw new Error("Tool call failed with null");
        }
        return v;
      })
      .ifOk(() => this.scheduleAutoDisconnect())
      .watch((status) => {
        if (!status.isOk) {
          this.log.error("Tool call failed", toolName, status.error);
        } else if (status.value?.isError) {
          this.log.error("Tool call failed", toolName, status.value.content);
        }
      })
      .ifFail((error) => {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: {
                  message: errorToString(error),
                  name: error?.name,
                },
              }),
            },
          ],
          isError: true,
        };
      })
      .unwrap();
  }
}

/**
 * Factory function to create a new MCP client
 */
export const createMCPClient = (
  name: string,
  serverConfig: MCPServerConfig,
  options: ClientOptions = {},
): MCPClient => new MCPClient(name, serverConfig, options);
