import type { Cache } from "lib/cache/cache.interface";
import type { McpServerSelect } from "app-types/mcp";
import type { UUID } from "crypto";
import logger from "logger";
import { colorize } from "consola/utils";
import { pgMcpRepository } from "lib/db/pg/repositories/mcp-repository.pg";

export interface CachedServerData {
  server: McpServerSelect;
  token?: {
    accessToken: string;
    expiresAt?: Date;
    refreshToken?: string;
  };
  cachedAt: number;
  orgCacheVersion?: number;
}

interface CachedAllServers {
  servers: McpServerSelect[];
  orgCacheVersion?: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes for config
const TOKEN_BUFFER_MS = 5 * 60 * 1000; // 5 minute buffer before token expiry

/**
 * Unified cache for MCP server configurations and OAuth tokens
 * Reduces DB queries by caching both together per server
 */
export class UnifiedServerCache {
  private cache: Cache;
  private log = logger.withDefaults({
    message: colorize("green", `Unified MCP Cache: `),
  });

  constructor(cache: Cache) {
    this.cache = cache;
  }

  private getCacheKey(
    userId: UUID,
    orgId: UUID | null,
    serverId: string,
  ): string {
    return `mcp:unified:${userId}:${orgId || "personal"}:${serverId}`;
  }

  private getAllServersCacheKey(userId: UUID, orgId: UUID | null): string {
    return `mcp:unified:${userId}:${orgId || "personal"}:all`;
  }

  private getOrgCacheVersionKey(orgId: UUID): string {
    return `mcp:org-version:${orgId}`;
  }

  /**
   * Get server data including config and token.
   * This method implements a cache-aside pattern. If the data is in the cache and valid, it's returned.
   * Otherwise, it fetches the server configuration (from cache if available, otherwise DB) and a fresh
   * access token, caches the combined data, and then returns it.
   */
  async getServerData(
    userId: UUID,
    organizationId: UUID | null,
    serverId: string,
    credentialType?: "personal" | "shared",
  ): Promise<CachedServerData | null> {
    const cacheKey = this.getCacheKey(userId, organizationId, serverId);
    const orgCacheVersion = organizationId
      ? await this.getOrganizationCacheVersion(organizationId)
      : undefined;

    let cached: CachedServerData | null = null;
    try {
      cached = (await this.cache.get<CachedServerData>(cacheKey)) || null;

      if (cached) {
        // If part of an org, check if the org version matches
        if (organizationId && cached.orgCacheVersion !== orgCacheVersion) {
          this.log.debug(
            `Organization cache version mismatch for server ${serverId}. Invalidating.`,
          );
          cached = null; // Treat as cache miss
        } else if (cached.token) {
          // Check if token is still valid
          const isTokenValid =
            !cached.token.expiresAt ||
            new Date(cached.token.expiresAt).getTime() - TOKEN_BUFFER_MS >
              Date.now();
          if (isTokenValid) {
            this.log.debug(`Cache hit for server ${serverId}`);
            return cached;
          }
          this.log.debug(`Cached token expired for server ${serverId}`);
        } else if (!organizationId) {
          // Personal workspace cache hit
          this.log.debug(`Cache hit for server ${serverId}`);
          return cached;
        }
      }
    } catch (error) {
      this.log.warn(`Cache error for server ${serverId}:`, error);
    }

    // Use cached server config if available, otherwise fetch from DB.
    const server =
      cached?.server ??
      (await pgMcpRepository.selectById(serverId, userId, organizationId));
    if (!server) {
      this.log.debug(
        `Server not found in cache or DB for serverId: ${serverId}`,
      );
      return null;
    }

    // Get fresh token using the action, as it handles refresh logic.
    this.log.debug(`Fetching fresh token for server ${serverId}`);
    const { getAccessTokenAction } = await import(
      "@/app/api/mcp/oauth/actions"
    );
    const freshToken = await getAccessTokenAction(serverId, credentialType);

    const serverData: CachedServerData = {
      server,
      token: freshToken
        ? {
            accessToken: freshToken.token,
            expiresAt: freshToken.expiresAt || undefined,
          }
        : undefined,
      cachedAt: Date.now(),
      orgCacheVersion,
    };

    // Cache the fresh data
    const ttl = this.calculateTTL(serverData);
    if (ttl > 0) {
      try {
        await this.cache.set(cacheKey, serverData, ttl);
        this.log.debug(
          `Cached server ${serverId} with TTL ${Math.floor(ttl / 1000)}s`,
        );
      } catch (error) {
        this.log.warn(`Failed to cache server ${serverId}:`, error);
      }
    }

    return serverData;
  }

  /**
   * Get all servers for a user/org
   */
  async getAllServers(
    userId: UUID,
    organizationId: UUID | null,
  ): Promise<McpServerSelect[]> {
    const cacheKey = this.getAllServersCacheKey(userId, organizationId);
    const orgCacheVersion = organizationId
      ? await this.getOrganizationCacheVersion(organizationId)
      : undefined;

    try {
      const cached = await this.cache.get<CachedAllServers>(cacheKey);
      if (cached) {
        if (organizationId) {
          if (cached.orgCacheVersion === orgCacheVersion) {
            this.log.debug(
              `Cache hit for getAllServers for org ${organizationId}`,
            );
            return cached.servers;
          }
          this.log.debug(
            `Org version mismatch for getAllServers for org ${organizationId}. Cache miss.`,
          );
        } else {
          this.log.debug("Cache hit for getAllServers for personal workspace");
          return cached.servers;
        }
      }
    } catch (error) {
      this.log.warn("Cache error on getAllServers:", error);
    }

    this.log.debug("Cache miss for getAllServers, loading from DB");
    const servers = await pgMcpRepository.selectAll(userId, organizationId);

    const dataToCache: CachedAllServers = {
      servers,
      orgCacheVersion,
    };

    try {
      await this.cache.set(cacheKey, dataToCache, CACHE_TTL_MS);
    } catch (error) {
      this.log.warn("Failed to cache getAllServers result:", error);
    }

    return servers;
  }

  /**
   * Update token for a specific server
   */
  async updateServerToken(
    userId: UUID,
    organizationId: UUID | null,
    serverId: string,
    token: {
      accessToken: string;
      expiresAt?: Date;
      refreshToken?: string;
    },
  ) {
    const cacheKey = this.getCacheKey(userId, organizationId, serverId);

    try {
      // Get existing cached data
      const existing = await this.cache.get<CachedServerData>(cacheKey);

      if (existing) {
        // Update only the token
        existing.token = token;
        existing.cachedAt = Date.now();

        const ttl = this.calculateTTL(existing);
        if (ttl > 0) {
          await this.cache.set(cacheKey, existing, ttl);
          this.log.info(`Updated token for server ${serverId}`);
        }
      } else {
        // If not cached, just invalidate to force reload
        await this.invalidateServer(userId, organizationId, serverId);
      }
    } catch (error) {
      this.log.warn(`Failed to update token for server ${serverId}:`, error);
    }
  }

  /**
   * Invalidate cache for a specific server
   */
  async invalidateServer(
    userId: UUID,
    organizationId: UUID | null,
    serverId: string,
  ) {
    const serverKey = this.getCacheKey(userId, organizationId, serverId);

    try {
      await this.cache.delete(serverKey);
      this.log.info(`Invalidated cache for server ${serverId}`);
    } catch (error) {
      this.log.warn(
        `Failed to invalidate cache for server ${serverId}:`,
        error,
      );
    }
  }

  /**
   * Invalidate the "all servers" cache for a user
   */
  async invalidateAllServersCache(userId: UUID, organizationId: UUID | null) {
    const allKey = this.getAllServersCacheKey(userId, organizationId);

    try {
      await this.cache.delete(allKey);
      this.log.info(`Invalidated all servers cache for user ${userId}`);
    } catch (error) {
      this.log.warn(
        `Failed to invalidate all servers cache for user ${userId}:`,
        error,
      );
    }
  }

  /**
   * Invalidates the cache for an entire organization by updating its version.
   * This will cause all subsequent requests for this org's data to miss the cache.
   */
  async invalidateOrganizationCache(organizationId: UUID) {
    const cacheKey = this.getOrgCacheVersionKey(organizationId);
    const newVersion = Date.now();
    try {
      await this.cache.set(cacheKey, newVersion, 24 * 60 * 60 * 1000); // 24 hours
      this.log.info(
        `Invalidated organization cache for ${organizationId} with new version ${newVersion}`,
      );
    } catch (error) {
      this.log.warn(
        `Failed to invalidate organization cache for ${organizationId}:`,
        error,
      );
    }
  }

  private async getOrganizationCacheVersion(
    organizationId: UUID,
  ): Promise<number> {
    const cacheKey = this.getOrgCacheVersionKey(organizationId);
    try {
      const version = await this.cache.get<number>(cacheKey);
      if (version) {
        return version;
      }
    } catch (error) {
      this.log.warn(
        `Could not retrieve organization cache version for ${organizationId}:`,
        error,
      );
    }
    // If no version is found, create one.
    const newVersion = Date.now();
    try {
      await this.cache.set(cacheKey, newVersion, 24 * 60 * 60 * 1000); // 24 hours
    } catch (error) {
      this.log.warn(
        `Failed to set initial organization cache version for ${organizationId}:`,
        error,
      );
    }
    return newVersion;
  }

  /**
   * Get access token for a server (cache-first approach)
   */
  async getAccessToken(
    userId: UUID,
    organizationId: UUID | null,
    serverId: string,
    credentialType?: "personal" | "shared",
  ): Promise<{ token: string; expiresAt?: Date } | null> {
    // getServerData now handles getting a fresh token if needed.
    const serverData = await this.getServerData(
      userId,
      organizationId,
      serverId,
      credentialType,
    );

    if (serverData?.token) {
      return {
        token: serverData.token.accessToken,
        expiresAt: serverData.token.expiresAt,
      };
    }

    return null;
  }

  /**
   * Calculate appropriate TTL based on token expiry
   */
  private calculateTTL(serverData: CachedServerData): number {
    if (serverData.token?.expiresAt) {
      const expiryTime = new Date(serverData.token.expiresAt).getTime();
      const now = Date.now();
      const tokenTTL = Math.max(0, expiryTime - now - TOKEN_BUFFER_MS);

      // Use the shorter of config TTL or token TTL
      return Math.min(CACHE_TTL_MS, tokenTTL);
    }

    // No token or non-expiring token, use config TTL
    return CACHE_TTL_MS;
  }
}

// Singleton instance
let unifiedCacheInstance: UnifiedServerCache | null = null;

/**
 * Get or create the unified cache instance
 */
export function getUnifiedServerCache(cache: Cache): UnifiedServerCache {
  if (!unifiedCacheInstance) {
    unifiedCacheInstance = new UnifiedServerCache(cache);
  }
  return unifiedCacheInstance;
}
