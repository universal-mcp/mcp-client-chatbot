import type { MCPServerConfig, VercelAIMcpTool } from "app-types/mcp";
import { createMCPClient, type MCPClient } from "./create-mcp-client";
import { Locker } from "lib/utils";
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
    // Extract credentialType from config - all servers are remote with URLs
    const credentialType = (serverConfig as any).credentialType || "personal";

    const client = createMCPClient(name, serverConfig, {
      serverId: id, // Pass the server ID for OAuth token lookup
      credentialType: credentialType, // Pass credential type for OAuth optimization
      accessToken: accessToken, // Pass the access token directly
      tokenExpiry: tokenExpiry, // Pass token expiry for OAuth status tracking
    });

    // Connect first before adding to the map to ensure consistent state
    await client.fetchAndUpdateTools();

    // Only add to clients map after successful connection
    this.clients.set(id, { client, name });

    return client;
  }

  /**
   * Removes a client by id, disconnecting it
   */
  async removeClient(id: string) {
    this.clients.delete(id);
  }

  async cleanup() {
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

export function createMCPClientsManager(): MCPClientsManager {
  return new MCPClientsManager();
}
