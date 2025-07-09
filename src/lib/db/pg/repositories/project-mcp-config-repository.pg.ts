import { pgDb as db } from "../db.pg";
import {
  ProjectMcpServerConfigSchema,
  ProjectMcpToolConfigSchema,
  McpServerSchema,
} from "../schema.pg";
import { and, eq } from "drizzle-orm";
import { generateUUID } from "lib/utils";
import { sql } from "drizzle-orm";
import { isNull } from "drizzle-orm";

export type ProjectMcpServerConfig = {
  mcpServerId: string;
  enabled: boolean;
};

export type ProjectMcpToolConfig = {
  mcpServerId: string;
  toolName: string;
  enabled: boolean;
  mode: "auto" | "manual";
};

export const pgProjectMcpConfigRepository = {
  // --- Server Config Functions ---

  async getProjectMcpServers(
    projectId: string,
  ): Promise<ProjectMcpServerConfig[]> {
    const configs = await db
      .select({
        mcpServerId: ProjectMcpServerConfigSchema.mcpServerId,
        enabled: ProjectMcpServerConfigSchema.enabled,
      })
      .from(ProjectMcpServerConfigSchema)
      .where(eq(ProjectMcpServerConfigSchema.projectId, projectId));

    return configs;
  },

  async bulkSetProjectMcpServerConfigs(
    projectId: string,
    configs: ProjectMcpServerConfig[],
  ): Promise<void> {
    if (configs.length === 0) return;

    const values = configs.map((config) => ({
      id: generateUUID(),
      projectId,
      mcpServerId: config.mcpServerId,
      enabled: config.enabled,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await db
      .insert(ProjectMcpServerConfigSchema)
      .values(values)
      .onConflictDoUpdate({
        target: [
          ProjectMcpServerConfigSchema.projectId,
          ProjectMcpServerConfigSchema.mcpServerId,
        ],
        set: {
          enabled: sql`excluded.enabled`,
          updatedAt: new Date(),
        },
      });
  },

  async getProjectMcpTools(projectId: string): Promise<ProjectMcpToolConfig[]> {
    const configs = await db
      .select({
        mcpServerId: ProjectMcpToolConfigSchema.mcpServerId,
        toolName: ProjectMcpToolConfigSchema.toolName,
        enabled: ProjectMcpToolConfigSchema.enabled,
        mode: ProjectMcpToolConfigSchema.mode,
      })
      .from(ProjectMcpToolConfigSchema)
      .where(eq(ProjectMcpToolConfigSchema.projectId, projectId));

    return configs;
  },

  async getProjectMcpToolsByServer(
    projectId: string,
    mcpServerId: string,
  ): Promise<ProjectMcpToolConfig[]> {
    const configs = await db
      .select({
        mcpServerId: ProjectMcpToolConfigSchema.mcpServerId,
        toolName: ProjectMcpToolConfigSchema.toolName,
        enabled: ProjectMcpToolConfigSchema.enabled,
        mode: ProjectMcpToolConfigSchema.mode,
      })
      .from(ProjectMcpToolConfigSchema)
      .where(
        and(
          eq(ProjectMcpToolConfigSchema.projectId, projectId),
          eq(ProjectMcpToolConfigSchema.mcpServerId, mcpServerId),
        ),
      );

    return configs;
  },

  async setProjectMcpToolConfig(
    projectId: string,
    mcpServerId: string,
    toolName: string,
    config: { enabled: boolean; mode: "auto" | "manual" },
  ): Promise<void> {
    await db
      .insert(ProjectMcpToolConfigSchema)
      .values({
        id: generateUUID(),
        projectId,
        mcpServerId,
        toolName,
        enabled: config.enabled,
        mode: config.mode,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          ProjectMcpToolConfigSchema.projectId,
          ProjectMcpToolConfigSchema.mcpServerId,
          ProjectMcpToolConfigSchema.toolName,
        ],
        set: {
          enabled: config.enabled,
          mode: config.mode,
          updatedAt: new Date(),
        },
      });
  },

  async bulkSetProjectMcpToolConfigs(
    projectId: string,
    configs: ProjectMcpToolConfig[],
  ): Promise<void> {
    if (configs.length === 0) return;

    const values = configs.map((config) => ({
      id: generateUUID(),
      projectId,
      mcpServerId: config.mcpServerId,
      toolName: config.toolName,
      enabled: config.enabled,
      mode: config.mode,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await db
      .insert(ProjectMcpToolConfigSchema)
      .values(values)
      .onConflictDoUpdate({
        target: [
          ProjectMcpToolConfigSchema.projectId,
          ProjectMcpToolConfigSchema.mcpServerId,
          ProjectMcpToolConfigSchema.toolName,
        ],
        set: {
          enabled: sql`excluded.enabled`,
          mode: sql`excluded.mode`,
          updatedAt: new Date(),
        },
      });
  },

  async getProjectMcpConfig(
    projectId: string,
    userId: string,
    organizationId: string | null,
  ) {
    // Get all MCP servers accessible in the current context
    const availableServers = await db
      .select({
        id: McpServerSchema.id,
        name: McpServerSchema.name,
      })
      .from(McpServerSchema)
      .where(
        organizationId
          ? eq(McpServerSchema.organizationId, organizationId)
          : and(
              eq(McpServerSchema.userId, userId),
              isNull(McpServerSchema.organizationId),
            ),
      );

    // Get project-specific server configs
    const serverConfigs = await this.getProjectMcpServers(projectId);
    const serverConfigMap = new Map(
      serverConfigs.map((c) => [c.mcpServerId, c]),
    );

    // Get project-specific tool configs
    const toolConfigs = await this.getProjectMcpTools(projectId);
    const toolConfigMap = new Map(
      toolConfigs.map((c) => [`${c.mcpServerId}:${c.toolName}`, c]),
    );

    // Combine available servers with their configs
    return {
      servers: availableServers.map((server) => ({
        id: server.id,
        name: server.name,
        enabled: serverConfigMap.get(server.id)?.enabled ?? true, // Default to enabled
      })),
      tools: toolConfigMap,
    };
  },

  // Initialize default configs for a new project
  async initializeProjectDefaults(
    projectId: string,
    userId: string,
    organizationId: string | null,
  ): Promise<void> {
    // Get all available MCP servers
    const availableServers = await db
      .select({
        id: McpServerSchema.id,
      })
      .from(McpServerSchema)
      .where(
        organizationId
          ? eq(McpServerSchema.organizationId, organizationId)
          : and(
              eq(McpServerSchema.userId, userId),
              isNull(McpServerSchema.organizationId),
            ),
      );

    // Create default configs (all servers enabled by default)
    if (availableServers.length > 0) {
      const serverConfigs = availableServers.map((server) => ({
        mcpServerId: server.id,
        enabled: true,
      }));

      await this.bulkSetProjectMcpServerConfigs(projectId, serverConfigs);
    }
  },
};
