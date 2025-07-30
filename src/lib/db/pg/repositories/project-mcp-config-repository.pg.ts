import { pgDb as db } from "../db.pg";
import {
  ProjectMcpToolConfigSchema,
  ProjectSchema,
  UserSchema,
} from "../schema.pg";
import { eq } from "drizzle-orm";
import { generateUUID } from "lib/utils";

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
    // First, delete all existing configs for this project
    await db
      .delete(ProjectMcpToolConfigSchema)
      .where(eq(ProjectMcpToolConfigSchema.projectId, projectId));

    // If no configs are provided, we're done (all tools disabled)
    if (configs.length === 0) {
      return;
    }

    // Insert the new configs
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

    await db.insert(ProjectMcpToolConfigSchema).values(values);
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
