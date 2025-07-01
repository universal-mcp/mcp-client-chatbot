import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  type MCPServerInfo,
  MCPRemoteConfigZodSchema,
  MCPStdioConfigZodSchema,
  type MCPServerConfig,
  type MCPToolInfo,
} from "app-types/mcp";
import { jsonSchema, Tool, tool, ToolExecutionOptions } from "ai";
import { isMaybeRemoteConfig, isMaybeStdioConfig } from "./is-mcp-config";
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
import { IS_MCP_SERVER_REMOTE_ONLY } from "lib/const";
import { getAccessTokenAction } from "@/app/api/mcp/oauth/actions";

type ClientOptions = {
  autoDisconnectSeconds?: number;
  serverId?: string; // MCP server ID for OAuth token lookup
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
  private oauthRequired?: boolean;
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
      oauthRequired: this.oauthRequired,
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

      // Create appropriate transport based on server config type
      if (isMaybeStdioConfig(this.serverConfig)) {
        this.oauthRequired = false; // Stdio transport does not use OAuth
        // Skip stdio transport
        if (IS_MCP_SERVER_REMOTE_ONLY) {
          throw new Error("Stdio transport is not supported");
        }

        const config = MCPStdioConfigZodSchema.parse(this.serverConfig);
        const transport = new StdioClientTransport({
          command: config.command,
          args: config.args,
          // Merge process.env with config.env, ensuring PATH is preserved and filtering out undefined values
          env: Object.entries({ ...process.env, ...config.env }).reduce(
            (acc, [key, value]) => {
              if (value !== undefined) {
                acc[key] = value;
              }
              return acc;
            },
            {} as Record<string, string>,
          ),
          cwd: process.cwd(),
        });

        await client.connect(transport);
      } else if (isMaybeRemoteConfig(this.serverConfig)) {
        const config = MCPRemoteConfigZodSchema.parse(this.serverConfig);
        const abortController = new AbortController();
        const url = new URL(config.url);

        // Prepare headers with OAuth authorization if available
        const headers: Record<string, string> = { ...config.headers };
        let hasAuthToken = false;

        // Add OAuth authorization header if we have a server ID and access token
        if (this.serverId) {
          try {
            const accessToken = await getAccessTokenAction(this.serverId);
            if (accessToken) {
              headers["Authorization"] = `Bearer ${accessToken}`;
              headers["X-OAuth-Server-ID"] = this.serverId; // Add server ID for debugging
              headers["X-Request-Source"] = "mcp-client-chatbot"; // Add source identifier
              this.log.info("Added OAuth authorization header to request");
              hasAuthToken = true;
            } else {
              this.log.warn(
                `No valid OAuth token available for server: ${this.name}. Server may require authorization.`,
              );
              // Add a header to indicate we attempted OAuth but no token was available
              headers["X-OAuth-Status"] = "no-token";
            }
          } catch (error) {
            this.log.warn("Failed to get OAuth access token:", error);
            headers["X-OAuth-Status"] = "error";
            // Continue without authorization - the server will return 401 if auth is required
          }
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
          await client.connect(transport);
          this.oauthRequired = hasAuthToken;
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
            this.oauthRequired = hasAuthToken;
          } catch (sseError) {
            if (
              errorToString(sseError).includes("401") ||
              errorToString(streamError).includes("401")
            ) {
              this.oauthRequired = true;
            }
            throw sseError;
          }
        }
      } else {
        throw new Error("Invalid server config");
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
      if (this.oauthRequired !== true && errorToString(error).includes("401")) {
        this.oauthRequired = true;
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
    await client?.close().catch((e) => this.log.error(e));
  }
  async callTool(toolName: string, input?: unknown) {
    return safe(() => this.log.info("tool call", toolName))

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
