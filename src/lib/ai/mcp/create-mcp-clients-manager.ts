import type { MCPServerConfig, VercelAIMcpTool } from "app-types/mcp";
import { createMCPClient, type MCPClient } from "./create-mcp-client";
import { Locker } from "lib/utils";
import { safe } from "ts-safe";
import { createMCPToolId } from "./mcp-tool-id";

export class MCPClientsManager {
  protected clients = new Map<
    string,
    {
      client: MCPClient;
      name: string;
    }
  >();
  private initializedLock = new Locker();

  constructor(
    private autoDisconnectSeconds: number = 60 * 30, // 30 minutes
  ) {
    process.on("SIGINT", this.cleanup.bind(this));
    process.on("SIGTERM", this.cleanup.bind(this));
  }

  async init() {
    return safe(() => this.initializedLock.lock())
      .ifOk(() => this.cleanup())
      .watch(() => this.initializedLock.unlock())
      .unwrap();
  }

  /**
   * Returns all tools from all clients as a flat object
   */
  tools(): Record<string, VercelAIMcpTool> {
    return Object.fromEntries(
      Array.from(this.clients.entries())
        .filter(([_, { client }]) => client.getInfo().toolInfo.length > 0)
        .flatMap(([id, { client }]) =>
          Object.entries(client.tools).map(([name, tool]) => [
            createMCPToolId(client.getInfo().name, name),
            {
              ...tool,
              _originToolName: name,
              _mcpServerName: client.getInfo().name,
              _mcpServerId: id,
            },
          ]),
        ),
    );
  }
  /**
   * Creates and adds a new client instance
   */
  async addClient(
    id: string,
    name: string,
    serverConfig: MCPServerConfig,
    accessToken?: string,
    tokenExpiry?: Date,
  ) {
    if (this.clients.has(id)) {
      const prevClient = this.clients.get(id)!;
      // Properly await the disconnect to ensure clean state
      await prevClient.client.disconnect();
    }

    // Extract credentialType from config - all servers are remote with URLs
    const credentialType = (serverConfig as any).credentialType || "personal";

    const client = createMCPClient(name, serverConfig, {
      autoDisconnectSeconds: this.autoDisconnectSeconds,
      serverId: id, // Pass the server ID for OAuth token lookup
      credentialType: credentialType, // Pass credential type for OAuth optimization
      accessToken: accessToken, // Pass the access token directly
      tokenExpiry: tokenExpiry, // Pass token expiry for OAuth status tracking
    });

    // Connect first before adding to the map to ensure consistent state
    await client.connect();

    // Only add to clients map after successful connection
    this.clients.set(id, { client, name });

    return client;
  }

  /**
   * Removes a client by id, disconnecting it
   */
  async removeClient(id: string) {
    const client = this.clients.get(id);
    this.clients.delete(id);
    if (client) {
      await client.client.disconnect();
    }
  }

  /**
   * Refreshes an existing client with a new configuration
   */
  async refreshClient(
    id: string,
    name: string,
    serverConfig: MCPServerConfig,
    accessToken?: string,
    tokenExpiry?: Date,
  ) {
    const prevClient = this.clients.get(id);
    if (!prevClient) {
      throw new Error(`Client ${id} not found`);
    }
    // Disconnect old client and wait for it to complete
    await prevClient.client.disconnect();
    return this.addClient(id, name, serverConfig, accessToken, tokenExpiry);
  }

  async cleanup() {
    const clients = Array.from(this.clients.values());
    await Promise.allSettled(clients.map(({ client }) => client.disconnect()));
    this.clients.clear();
  }

  async getClients() {
    await this.initializedLock.wait();
    return Array.from(this.clients.entries()).map(([id, { client }]) => ({
      id,
      client: client,
    }));
  }
  async getClient(id: string) {
    await this.initializedLock.wait();
    return this.clients.get(id);
  }
}

export function createMCPClientsManager(
  autoDisconnectSeconds: number = 60 * 30, // 30 minutes
): MCPClientsManager {
  return new MCPClientsManager(autoDisconnectSeconds);
}
