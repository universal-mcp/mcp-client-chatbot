import {
  MCPClientsManager,
  createMCPClientsManager,
} from "./create-mcp-clients-manager";
import { getUnifiedServerCache } from "./unified-server-cache";
import { serverCache } from "lib/cache";
import { mcpRepository } from "lib/db/repository";
import { pgMcpOAuthTokenRepository } from "lib/db/pg/repositories/mcp-repository.pg";
import logger from "logger";
import { colorize } from "consola/utils";
import type { UUID } from "crypto";
import type { McpServerInsert, McpServerSelect } from "app-types/mcp";

// Use Node.js global to ensure true singleton across all contexts
declare global {
  const __globalMCPManagerInstance: GlobalMCPManager | undefined;
}

interface ManagerEntry {
  manager: MCPClientsManager;
  lastAccessed: number;
  cleanupTimer?: NodeJS.Timeout;
}

/**
 * Global MCP Manager that centralizes all storage and cache operations
 * while maintaining singleton instances of MCPClientsManager per user/organization
 */
class GlobalMCPManager {
  private managers = new Map<string, ManagerEntry>();
  private inactivityTimeout = 60 * 60 * 1000; // 1 hour
  private log = logger.withDefaults({
    message: colorize("blue", `Global MCP Manager: `),
  });
  private unifiedCache = getUnifiedServerCache(serverCache);

  constructor() {
    // Cleanup on process exit
    process.on("SIGINT", this.cleanup.bind(this));
    process.on("SIGTERM", this.cleanup.bind(this));
    process.on("beforeExit", this.cleanup.bind(this));

    // Periodic cleanup check every 30 minutes
    setInterval(
      () => {
        this.performPeriodicCleanup();
      },
      30 * 60 * 1000,
    );
  }

  private getCacheKey(userId: UUID, orgId: UUID | null): string {
    return `mcp:${userId}:${orgId || "personal"}`;
  }

  /**
   * Get or create a manager instance for a user/organization
   */
  async getManager(
    userId: UUID,
    organizationId: UUID | null,
  ): Promise<MCPClientsManager> {
    const key = this.getCacheKey(userId, organizationId);
    const entry = this.managers.get(key);

    if (entry) {
      // Update last accessed time
      entry.lastAccessed = Date.now();

      // Reset cleanup timer
      if (entry.cleanupTimer) {
        clearTimeout(entry.cleanupTimer);
      }
      entry.cleanupTimer = setTimeout(() => {
        this.cleanupManager(key);
      }, this.inactivityTimeout);

      this.log.debug(`Reusing existing manager for key: ${key}`);
      return entry.manager;
    }

    // Create new manager
    this.log.info(`Creating new manager for key: ${key}`);

    // Load configs from storage
    const configs = await this.unifiedCache.getAllServers(
      userId,
      organizationId,
    );

    // Create manager without storage (we'll handle storage here)
    const manager = createMCPClientsManager();

    try {
      await manager.init();

      // Add all configs to the manager with their respective tokens
      for (const config of configs) {
        // Fetch access token for this specific server
        const tokenResult = await this.unifiedCache.getAccessToken(
          userId,
          organizationId,
          config.id,
          (config.config as any).credentialType || "personal",
        );

        await manager.addClient(
          config.id,
          config.name,
          config.config,
          tokenResult?.token,
          tokenResult?.expiresAt,
        );
      }
    } catch (error) {
      this.log.error(`Failed to initialize manager for key ${key}:`, error);
      throw error;
    }

    // Store manager with metadata
    const newEntry: ManagerEntry = {
      manager,
      lastAccessed: Date.now(),
      cleanupTimer: setTimeout(() => {
        this.cleanupManager(key);
      }, this.inactivityTimeout),
    };

    this.managers.set(key, newEntry);
    this.log.info(
      `Manager created successfully for key: ${key}. Total managers: ${this.managers.size}`,
    );

    return manager;
  }

  /**
   * Save/create a new server
   */
  async saveServer(
    userId: UUID,
    organizationId: UUID | null,
    server: McpServerInsert,
  ): Promise<McpServerSelect> {
    // Save to DB directly
    const result = await mcpRepository.save(server, userId, organizationId);

    // Invalidate cache
    await this.unifiedCache.invalidateAllServersCache(userId, organizationId);

    // Get or create manager instance. This ensures a manager is running.
    const manager = await this.getManager(userId, organizationId);

    // Fetch access token for the new server
    const tokenResult = await this.unifiedCache.getAccessToken(
      userId,
      organizationId,
      result.id,
      (result.config as any).credentialType || "personal",
    );

    // Explicitly add the new client to the manager with its token
    await manager.addClient(
      result.id,
      result.name,
      result.config,
      tokenResult?.token,
      tokenResult?.expiresAt,
    );

    return result;
  }

  /**
   * Refresh a specific server for a user
   */
  async refreshServer(
    userId: UUID,
    organizationId: UUID | null,
    serverId: string,
  ) {
    try {
      this.log.info(`Refreshing server ${serverId} for user ${userId}`);

      // Invalidate cache for this specific server
      await this.unifiedCache.invalidateServer(
        userId,
        organizationId,
        serverId,
      );

      const serverData = await this.unifiedCache.getServerData(
        userId,
        organizationId,
        serverId,
      );

      const server = serverData?.server || null;

      // Get the latest server config
      if (!server) {
        throw new Error(`Server ${serverId} not found`);
      }

      const manager = await this.getManager(userId, organizationId);

      // Fetch access token for the server
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
    } catch (error) {
      this.log.error(`Failed to refresh server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a server
   */
  async deleteServer(
    userId: UUID,
    organizationId: UUID | null,
    serverId: string,
  ): Promise<void> {
    // Delete from DB
    await mcpRepository.deleteById(serverId, userId, organizationId);

    // Invalidate cache
    await this.unifiedCache.invalidateServer(userId, organizationId, serverId);
    await this.unifiedCache.invalidateAllServersCache(userId, organizationId);

    const key = this.getCacheKey(userId, organizationId);
    const entry = this.managers.get(key);

    // If a manager is active for this user/org, remove the client.
    if (entry) {
      await entry.manager.removeClient(serverId);
    }
  }

  /**
   * Get access token for a specific server
   */
  async getAccessToken(
    userId: UUID,
    organizationId: UUID | null,
    serverId: string,
    credentialType?: "personal" | "shared",
  ) {
    return this.unifiedCache.getAccessToken(
      userId,
      organizationId,
      serverId,
      credentialType,
    );
  }

  /**
   * Saves an access token for a specific server and refreshes the client.
   */
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
  }

  /**
   * Revokes all access tokens for a specific server and refreshes the client.
   */
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
  }

  /**
   * Cleanup a specific manager
   */
  private async cleanupManager(key: string) {
    const entry = this.managers.get(key);
    if (!entry) return;

    this.log.info(`Cleaning up manager for key: ${key}`);

    if (entry.cleanupTimer) {
      clearTimeout(entry.cleanupTimer);
    }

    try {
      await entry.manager.cleanup();
    } catch (error) {
      this.log.error(`Error cleaning up manager for key ${key}:`, error);
    }

    this.managers.delete(key);
    this.log.info(
      `Manager cleaned up. Remaining managers: ${this.managers.size}`,
    );
  }

  /**
   * Perform periodic cleanup of inactive managers
   */
  private async performPeriodicCleanup() {
    const now = Date.now();
    const keysToCleanup: string[] = [];

    for (const [key, entry] of this.managers.entries()) {
      if (now - entry.lastAccessed > this.inactivityTimeout) {
        keysToCleanup.push(key);
      }
    }

    if (keysToCleanup.length > 0) {
      this.log.info(
        `Periodic cleanup: cleaning up ${keysToCleanup.length} inactive managers`,
      );
      await Promise.all(keysToCleanup.map((key) => this.cleanupManager(key)));
    }
  }

  /**
   * Cleanup all managers (on process exit)
   */
  async cleanup() {
    this.log.info(`Cleaning up all ${this.managers.size} managers`);

    const cleanupPromises: Promise<void>[] = [];

    for (const [key, entry] of this.managers.entries()) {
      if (entry.cleanupTimer) {
        clearTimeout(entry.cleanupTimer);
      }
      cleanupPromises.push(
        entry.manager.cleanup().catch((error) => {
          this.log.error(`Error cleaning up manager ${key}:`, error);
        }),
      );
    }

    await Promise.all(cleanupPromises);
    this.managers.clear();
    this.log.info("All managers cleaned up");
  }

  /**
   * Get statistics about the manager pool
   */
  getStats() {
    const stats = {
      totalManagers: this.managers.size,
      managers: Array.from(this.managers.entries()).map(([key, entry]) => ({
        key,
        lastAccessed: new Date(entry.lastAccessed).toISOString(),
        ageMinutes: Math.floor((Date.now() - entry.lastAccessed) / 60000),
      })),
    };
    return stats;
  }
}

// Export singleton instance using global storage to ensure true singleton
export const globalMCPManager = (() => {
  const key = "__globalMCPManagerInstance";
  const g = global as any; // Type assertion to avoid TS errors
  if (!g[key]) {
    g[key] = new GlobalMCPManager();
  }
  return g[key];
})();

// Export function for getting manager (convenience)
export async function getGlobalMCPManager(
  userId: UUID,
  organizationId: UUID | null,
): Promise<MCPClientsManager> {
  return globalMCPManager.getManager(userId, organizationId);
}
