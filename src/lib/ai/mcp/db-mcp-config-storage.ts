import type { MCPConfigStorage } from "./create-mcp-clients-manager";
import { mcpRepository } from "lib/db/repository";
import defaultLogger from "logger";
import { colorize } from "consola/utils";
import { UUID } from "crypto";

const logger = defaultLogger.withDefaults({
  message: colorize("gray", `MCP Config Storage: `),
});

export function createDbBasedMCPConfigsStorage(
  userId: UUID,
  organizationId: UUID | null,
): MCPConfigStorage {
  return {
    async init() {},
    async loadAll() {
      try {
        const servers = await mcpRepository.selectAll(userId, organizationId);
        return servers;
      } catch (error) {
        logger.error("Failed to load MCP configs from database:", error);
        return [];
      }
    },
    async save(server) {
      try {
        return mcpRepository.save(server, userId, organizationId);
      } catch (error) {
        logger.error(
          `Failed to save MCP config "${server.name}" to database:`,
          error,
        );
        throw error;
      }
    },
    async delete(id) {
      try {
        await mcpRepository.deleteById(id, userId, organizationId);
      } catch (error) {
        logger.error(
          `Failed to delete MCP config "${id}" from database:",`,
          error,
        );
        throw error;
      }
    },
    async has(id: string): Promise<boolean> {
      try {
        const server = await mcpRepository.selectById(
          id,
          userId,
          organizationId,
        );
        return !!server;
      } catch (error) {
        logger.error(`Failed to check MCP config "${id}" in database:`, error);
        return false;
      }
    },
    async get(id) {
      return mcpRepository.selectById(id, userId, organizationId);
    },
  };
}
