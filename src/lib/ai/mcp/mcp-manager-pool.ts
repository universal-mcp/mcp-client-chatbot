import type { UUID } from "crypto";
import { colorize } from "consola/utils";
import logger from "logger";
import {
  type MCPClientsManager,
  createMCPClientsManager,
} from "./create-mcp-clients-manager";
import { getUnifiedServerCache } from "./unified-server-cache";
import { serverCache } from "lib/cache";

// Use Node.js global to ensure true singleton across all contexts
declare global {
  // eslint-disable-next-line no-var
  var __globalMCPManagerPoolInstance: MCPManagerPool | undefined;
}

interface ManagerEntry {
  manager: MCPClientsManager;
  lastAccessed: number;
  cleanupTimer?: NodeJS.Timeout;
}

class MCPManagerPool {
  private managers = new Map<string, ManagerEntry>();
  private inactivityTimeout = 60 * 60 * 1000; // 1 hour
  private log = logger.withDefaults({
    message: colorize("cyan", "MCP Manager Pool: "),
  });

  constructor() {
    // this.setupProcessHooks();
    setInterval(() => this.performPeriodicCleanup(), 30 * 60 * 1000);
  }

  /* private setupProcessHooks() {
    process.on("SIGINT", () => this.cleanup());
    process.on("SIGTERM", () => this.cleanup());
    process.on("beforeExit", () => this.cleanup());
  } */

  private getCacheKey(userId: UUID, orgId: UUID | null): string {
    return `mcp:${userId}:${orgId || "personal"}`;
  }

  async getManager(
    userId: UUID,
    organizationId: UUID | null,
  ): Promise<MCPClientsManager> {
    const key = this.getCacheKey(userId, organizationId);
    const existingEntry = this.managers.get(key);

    if (existingEntry) {
      this.log.debug(`Reusing existing manager for key: ${key}`);
      this.resetCleanupTimer(existingEntry, key);
      return existingEntry.manager;
    }

    this.log.info(`Creating new manager for key: ${key}`);
    const newManager = await this.createAndInitializeManager(
      userId,
      organizationId,
    );
    this.addManagerToPool(key, newManager);
    return newManager;
  }

  private async createAndInitializeManager(
    userId: UUID,
    organizationId: UUID | null,
  ): Promise<MCPClientsManager> {
    const unifiedCache = getUnifiedServerCache(serverCache);
    const configs = await unifiedCache.getAllServers(userId, organizationId);
    const manager = createMCPClientsManager();

    for (const config of configs) {
      const tokenResult = await unifiedCache.getAccessToken(
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
    return manager;
  }

  private addManagerToPool(key: string, manager: MCPClientsManager) {
    const newEntry: ManagerEntry = {
      manager,
      lastAccessed: Date.now(),
      cleanupTimer: setTimeout(
        () => this.cleanupManager(key),
        this.inactivityTimeout,
      ),
    };
    this.managers.set(key, newEntry);
    this.log.info(
      `Manager created successfully for key: ${key}. Total managers: ${this.managers.size}`,
    );
  }

  private resetCleanupTimer(entry: ManagerEntry, key: string) {
    entry.lastAccessed = Date.now();
    if (entry.cleanupTimer) {
      clearTimeout(entry.cleanupTimer);
    }
    entry.cleanupTimer = setTimeout(
      () => this.cleanupManager(key),
      this.inactivityTimeout,
    );
  }

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

  async cleanup() {
    this.log.info(`Cleaning up all ${this.managers.size} managers`);
    const cleanupPromises = Array.from(this.managers.entries()).map(
      ([key, entry]) => {
        if (entry.cleanupTimer) {
          clearTimeout(entry.cleanupTimer);
        }
        return entry.manager
          .cleanup()
          .catch((error) =>
            this.log.error(`Error cleaning up manager ${key}:`, error),
          );
      },
    );
    await Promise.all(cleanupPromises);
    this.managers.clear();
    this.log.info("All managers cleaned up");
  }

  getStats() {
    return {
      totalManagers: this.managers.size,
      managers: Array.from(this.managers.entries()).map(([key, entry]) => ({
        key,
        lastAccessed: new Date(entry.lastAccessed).toISOString(),
        ageMinutes: Math.floor((Date.now() - entry.lastAccessed) / 60000),
      })),
    };
  }

  /**
   * Refreshes a specific server's client in all active managers for an organization.
   * This is used when a shared resource like a token is updated.
   *
   * @param organizationId The UUID of the organization.
   * @param serverId The ID of the server to refresh.
   */
  async refreshServerInOrganizationManagers(
    organizationId: UUID,
    serverId: string,
  ) {
    this.log.info(
      `Refreshing server ${serverId} in all managers for organization: ${organizationId}`,
    );
    const unifiedCache = getUnifiedServerCache(serverCache);
    const keysToRefresh: string[] = [];

    // Find all manager keys for the specified organization
    for (const key of this.managers.keys()) {
      const parts = key.split(":");
      if (parts.length === 3 && parts[2] === organizationId) {
        keysToRefresh.push(key);
      }
    }

    if (keysToRefresh.length === 0) {
      this.log.info(
        `No active managers found for organization ${organizationId} to refresh.`,
      );
      return;
    }

    this.log.info(
      `Found ${keysToRefresh.length} active managers to refresh for server ${serverId}.`,
    );

    for (const key of keysToRefresh) {
      const [_, userId] = key.split(":");
      const entry = this.managers.get(key);
      if (!entry) continue;

      this.log.debug(`Refreshing server ${serverId} for manager key: ${key}`);
      try {
        // Fetch the updated server data. The organization's cache version has already
        // been invalidated, so this will be a fresh fetch.
        const serverData = await unifiedCache.getServerData(
          userId as UUID,
          organizationId,
          serverId,
        );

        if (!serverData?.server) {
          this.log.warn(
            `Could not find server ${serverId} while refreshing manager ${key}. Removing client.`,
          );
          await entry.manager.removeClient(serverId);
          continue;
        }

        const { server, token } = serverData;
        await entry.manager.addClient(
          server.id,
          server.name,
          server.config,
          token?.accessToken,
          token?.expiresAt,
        );
        this.log.debug(
          `Successfully refreshed server ${serverId} for manager ${key}.`,
        );
      } catch (error) {
        this.log.error(
          `Failed to refresh server ${serverId} for manager ${key}:`,
          error,
        );
      }
    }
  }

  /**
   * Invalidates and reloads all managers associated with a specific organization.
   * This is crucial when organizational settings (e.g., shared credentials) are updated.
   *
   * @param organizationId The UUID of the organization to invalidate.
   */
  async invalidateOrganizationManagers(organizationId: UUID) {
    this.log.info(
      `Invalidating all managers for organization: ${organizationId}`,
    );
    const keysToReload: string[] = [];

    // Find all managers associated with the organization
    for (const key of this.managers.keys()) {
      const parts = key.split(":");
      // Key format: "mcp:userId:orgId"
      if (parts.length === 3 && parts[2] === organizationId) {
        keysToReload.push(key);
      }
    }

    if (keysToReload.length === 0) {
      this.log.info(
        `No active managers found for organization ${organizationId} to invalidate.`,
      );
      return;
    }

    this.log.info(
      `Found ${keysToReload.length} active managers to reload for organization ${organizationId}.`,
    );

    // Reload each manager
    for (const key of keysToReload) {
      const [_, userId, orgId] = key.split(":");
      this.log.debug(`Reloading manager for key: ${key}`);

      // First, clean up the old manager
      await this.cleanupManager(key);

      // Then, create a new one, which will fetch the updated configuration
      // The manager will be re-added to the pool on its first access via getManager
      // To ensure it's reloaded immediately, we can call getManager here.
      await this.getManager(userId as UUID, orgId as UUID);
      this.log.debug(`Manager for key ${key} has been reloaded.`);
    }
  }
}

// Export singleton instance
const mcpManagerPool = (() => {
  const key = "__globalMCPManagerPoolInstance";
  const g = global as any;
  if (!g[key]) {
    g[key] = new MCPManagerPool();
  }
  return g[key] as MCPManagerPool;
})();

export { mcpManagerPool };
