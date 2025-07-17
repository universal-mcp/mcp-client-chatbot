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
import { errorToString, Locker, toAny } from "lib/utils";

type ClientOptions = {
  serverId?: string; // MCP server ID for OAuth token lookup
  credentialType?: "personal" | "shared"; // Credential type for OAuth optimization
  accessToken?: string; // Pre-fetched access token to avoid redundant lookups
  tokenExpiry?: Date; // Token expiry date for OAuth status tracking
};

/**
 * Client class for Model Context Protocol (MCP) server connections
 */
export class MCPClient {
  private error?: unknown;
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
      error: this.error,
      toolInfo: this.toolInfo,
      oauthStatus: this.oauthStatus,
    };
  }

  /**
   * Establishes a connection to the MCP server.
   * @returns A promise that resolves to the connected client.
   */
  private async _connect(): Promise<Client> {
    const startedAt = Date.now();
    const client = new Client({
      name: "wingmen-mcp-client",
      version: "1.0.0",
    });

    const config = MCPRemoteConfigZodSchema.parse(this.serverConfig);
    const abortController = new AbortController();
    const url = new URL(config.url);

    const headers: Record<string, string> = { ...config.headers };

    // Reset OAuth status for this connection attempt
    this.oauthStatus.required = false;
    this.oauthStatus.isAuthorized = false;
    this.oauthStatus.hasToken = false;
    this.oauthStatus.tokenExpiry = undefined;

    if (this.options.accessToken) {
      headers["Authorization"] = `Bearer ${this.options.accessToken}`;
      headers["X-OAuth-Server-ID"] = this.serverId || "unknown";
      headers["X-Request-Source"] = "wingmen-mcp-client";
      this.log.info("Added OAuth authorization header to request");
      this.oauthStatus.hasToken = true;
      this.oauthStatus.tokenExpiry = this.options.tokenExpiry;
    } else if (this.serverId) {
      this.log.warn(
        `No access token provided for server: ${this.name}. Server may require authorization.`,
      );
      headers["X-OAuth-Status"] = "no-token";
    } else {
      this.log.debug("No server ID provided for OAuth token lookup");
    }

    try {
      const transport = new StreamableHTTPClientTransport(url, {
        requestInit: {
          headers,
          signal: abortController.signal,
        },
      });
      await client.connect(transport);
      this.oauthStatus.isAuthorized = true;
      this.oauthStatus.required = this.oauthStatus.hasToken;
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
        await client.connect(transport);
        this.oauthStatus.isAuthorized = true;
        this.oauthStatus.required = this.oauthStatus.hasToken;
      } catch (sseError) {
        if (
          errorToString(sseError).includes("401") ||
          errorToString(streamError).includes("401")
        ) {
          this.oauthStatus.required = true;
          this.oauthStatus.isAuthorized = false;
        }
        throw sseError;
      }
    }

    this.log.info(
      `Connected to MCP server in ${((Date.now() - startedAt) / 1000).toFixed(2)}s`,
    );
    return client;
  }

  /**
   * Fetches tool definitions from the server and updates the client state.
   */
  async fetchAndUpdateTools() {
    if (this.locker.isLocked) {
      await this.locker.wait();
      return;
    }
    let client: Client | undefined;
    try {
      this.locker.lock();
      client = await this._connect();
      this.error = undefined;

      const toolResponse = await client.listTools();
      this.toolInfo = toolResponse.tools.map(
        (tool) =>
          ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          }) as MCPToolInfo,
      );

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
    } catch (error) {
      this.log.error(error);
      this.error = error;
      if (errorToString(error).includes("401")) {
        this.oauthStatus.required = true;
        this.oauthStatus.isAuthorized = false;
      }
    } finally {
      this.locker.unlock();
      // Disconnect immediately after fetching tools to remain stateless
      if (client) {
        await client.close().catch((e) => {
          if (e?.name !== "AbortError") {
            this.log.error(e);
          }
        });
      }
    }
  }

  async callTool(toolName: string, input?: unknown) {
    const client = await this._connect();
    try {
      return await client.callTool({
        name: toolName,
        arguments: input as Record<string, unknown>,
      });
    } finally {
      // Ensure disconnection after the tool call
      await client.close().catch((e) => {
        // AbortError is expected when closing SSE connections - don't log it as an error
        if (e?.name !== "AbortError") {
          this.log.error(e);
        }
      });
    }
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
