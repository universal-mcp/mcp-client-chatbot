import { pgDb as db } from "../db.pg";
import {
  ProjectMcpToolConfigSchema,
  McpServerSchema,
  ProjectSchema,
  UserSchema,
} from "../schema.pg";
import { and, eq } from "drizzle-orm";
import { generateUUID } from "lib/utils";
import { sql } from "drizzle-orm";
import { isNull } from "drizzle-orm";

export type ProjectMcpToolConfig = {
  mcpServerId: string;
  toolName: string;
  enabled: boolean;
  mode: "auto" | "manual";
};

export const pgProjectMcpConfigRepository = {
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

  async bulkSetProjectMcpToolConfigs(
    projectId: string,
    configs: ProjectMcpToolConfig[],
  ): Promise<void> {
    if (configs.length === 0) {
      // If no configs are provided, it means all tools for this project should be disabled.
      // So, we delete all existing configs for the project.
      await db
        .delete(ProjectMcpToolConfigSchema)
        .where(eq(ProjectMcpToolConfigSchema.projectId, projectId));
      return;
    }

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

    // Perform the bulk insert/update
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

    // Delete any tools that are not in the provided configs list for the affected servers
    const serverIds = [...new Set(configs.map((c) => c.mcpServerId))];
    if (serverIds.length > 0) {
      const toolNames = configs.map((c) => c.toolName);
      await db
        .delete(ProjectMcpToolConfigSchema)
        .where(
          and(
            eq(ProjectMcpToolConfigSchema.projectId, projectId),
            sql`${ProjectMcpToolConfigSchema.mcpServerId} in ${serverIds}`,
            sql`${ProjectMcpToolConfigSchema.toolName} not in ${toolNames}`,
          ),
        );
    }
  },

  async getProjectMcpConfig(
    projectId: string,
    userId: string,
    organizationId: string | null,
  ) {
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

    const toolConfigs = await this.getProjectMcpTools(projectId);
    const toolConfigMap = new Map(
      toolConfigs.map((c) => [`${c.mcpServerId}:${c.toolName}`, c]),
    );
    const enabledServerIds = new Set(toolConfigs.map((c) => c.mcpServerId));

    return {
      servers: availableServers.map((server) => ({
        id: server.id,
        name: server.name,
        enabled: enabledServerIds.has(server.id),
      })),
      tools: toolConfigMap,
    };
  },

  async initializeProjectDefaults(): Promise<void> {
    return Promise.resolve();
  },

  async isMcpServerInUse(mcpServerId: string): Promise<boolean> {
    const result = await db
      .select({ id: ProjectMcpToolConfigSchema.id })
      .from(ProjectMcpToolConfigSchema)
      .where(eq(ProjectMcpToolConfigSchema.mcpServerId, mcpServerId))
      .limit(1);

    return result.length > 0;
  },

  async getProjectsUsingMcpServer(
    mcpServerId: string,
  ): Promise<{ name: string; userEmail: string | null }[]> {
    const result = await db
      .selectDistinct({
        name: ProjectSchema.name,
        userEmail: UserSchema.email,
      })
      .from(ProjectMcpToolConfigSchema)
      .innerJoin(
        ProjectSchema,
        eq(ProjectMcpToolConfigSchema.projectId, ProjectSchema.id),
      )
      .innerJoin(UserSchema, eq(ProjectSchema.userId, UserSchema.id))
      .where(eq(ProjectMcpToolConfigSchema.mcpServerId, mcpServerId));

    return result;
  },
};
