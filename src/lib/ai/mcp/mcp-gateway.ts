import { mcpManagerPool } from "./mcp-manager-pool";
import { getUnifiedServerCache } from "./unified-server-cache";
import { serverCache } from "lib/cache";
import { mcpRepository } from "lib/db/repository";
import { pgMcpOAuthTokenRepository } from "lib/db/pg/repositories/mcp-repository.pg";
import logger from "logger";
import { colorize } from "consola/utils";
import type { UUID } from "crypto";
import type { McpServerInsert, McpServerSelect } from "app-types/mcp";
import type { MCPClientsManager } from "./create-mcp-clients-manager";

// Use Node.js global to ensure true singleton across all contexts
declare global {
  // eslint-disable-next-line no-var
  var __globalMCPGatewayInstance: MCPGateway | undefined;
}

class MCPGateway {
  private log = logger.withDefaults({
    message: colorize("blue", "MCP Gateway: "),
  });
  private unifiedCache = getUnifiedServerCache(serverCache);

  async getManager(
    userId: UUID,
    organizationId: UUID | null,
  ): Promise<MCPClientsManager> {
    return mcpManagerPool.getManager(userId, organizationId);
  }

  async saveServer(
    userId: UUID,
    organizationId: UUID | null,
    server: McpServerInsert,
  ): Promise<McpServerSelect> {
    const result = await mcpRepository.save(server, userId, organizationId);
    await this.unifiedCache.invalidateAllServersCache(userId, organizationId);

    const manager = await this.getManager(userId, organizationId);
    const tokenResult = await this.unifiedCache.getAccessToken(
      userId,
      organizationId,
      result.id,
      (result.config as any).credentialType || "personal",
    );

    await manager.addClient(
      result.id,
      result.name,
      result.config,
      tokenResult?.token,
      tokenResult?.expiresAt,
    );

    // If the change affects an organization, invalidate its managers
    if (organizationId) {
      await this.invalidateOrganizationCache(organizationId);
    }

    return result;
  }

  async refreshServer(
    userId: UUID,
    organizationId: UUID | null,
    serverId: string,
  ) {
    this.log.info(`Refreshing server ${serverId} for user ${userId}`);
    await this.unifiedCache.invalidateServer(userId, organizationId, serverId);

    const serverData = await this.unifiedCache.getServerData(
      userId,
      organizationId,
      serverId,
    );
    const server = serverData?.server;
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    const manager = await this.getManager(userId, organizationId);
    const tokenResult = await this.unifiedCache.getAccessToken(
      userId,
      organizationId,
      serverId,
      (server.config as any).credentialType || "personal",
    );

    await manager.addClient(
      serverId,
      server.name,
      server.config,
      tokenResult?.token,
      tokenResult?.expiresAt,
    );
  }

  async deleteServer(
    userId: UUID,
    organizationId: UUID | null,
    serverId: string,
  ): Promise<void> {
    await mcpRepository.deleteById(serverId, userId, organizationId);

    await this.unifiedCache.invalidateServer(userId, organizationId, serverId);
    await this.unifiedCache.invalidateAllServersCache(userId, organizationId);

    const manager = await mcpManagerPool.getManager(userId, organizationId);
    await manager.removeClient(serverId);

    if (organizationId) {
      await this.invalidateOrganizationCache(organizationId);
    }
  }

  async saveAccessToken(
    userId: UUID,
    organizationId: UUID | null,
    mcpServerId: string,
    accessToken: string,
    refreshToken: string | null,
    tokenType: string,
    scope: string | null,
    expiresAt: Date | null,
  ) {
    this.log.info(`Saving token for server ${mcpServerId}`);
    await pgMcpOAuthTokenRepository.save({
      userId,
      organizationId,
      mcpServerId,
      accessToken,
      refreshToken,
      tokenType,
      scope,
      expiresAt,
    });
    await this.unifiedCache.invalidateServer(
      userId,
      organizationId,
      mcpServerId,
    );
    await this.refreshServer(userId, organizationId, mcpServerId);
    if (organizationId) {
      const serverData = await this.unifiedCache.getServerData(
        userId,
        organizationId,
        mcpServerId,
      );
      if (
        serverData?.server &&
        (serverData.server.config as any)?.credentialType === "shared"
      ) {
        // Invalidate the persistent cache first
        await this.unifiedCache.invalidateOrganizationCache(organizationId);
        // Then, refresh the specific server in all active managers
        await mcpManagerPool.refreshServerInOrganizationManagers(
          organizationId,
          mcpServerId,
        );
      }
    }
  }

  async revokeAccessToken(
    userId: UUID,
    organizationId: UUID | null,
    serverId: string,
    credentialType?: "personal" | "shared",
  ) {
    this.log.info(`Revoking token for server ${serverId}`);
    await pgMcpOAuthTokenRepository.deleteByServerId(
      serverId,
      userId,
      organizationId,
      credentialType,
    );
    await this.unifiedCache.invalidateServer(userId, organizationId, serverId);
    await this.refreshServer(userId, organizationId, serverId);
    if (organizationId && credentialType === "shared") {
      // Invalidate the persistent cache first
      await this.unifiedCache.invalidateOrganizationCache(organizationId);
      // Then, refresh the specific server in all active managers
      await mcpManagerPool.refreshServerInOrganizationManagers(
        organizationId,
        serverId,
      );
    }
  }

  async invalidateOrganizationCache(organizationId: UUID) {
    this.log.info(
      `Invalidating cache and managers for organization ${organizationId}`,
    );
    // Invalidate the persistent cache for the entire organization
    await this.unifiedCache.invalidateOrganizationCache(organizationId);
    // Invalidate all active in-memory manager instances for the organization
    await mcpManagerPool.invalidateOrganizationManagers(organizationId);
  }

  getStats() {
    return mcpManagerPool.getStats();
  }
}

const mcpGateway = (() => {
  const key = "__globalMCPGatewayInstance";
  const g = global as any;
  if (!g[key]) {
    g[key] = new MCPGateway();
  }
  return g[key] as MCPGateway;
})();

export { mcpGateway };
