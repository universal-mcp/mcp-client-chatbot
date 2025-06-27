import { McpServerCustomizationRepository } from "app-types/mcp";
import { pgDb as db } from "../db.pg";
import { McpServerCustomizationSchema, McpServerSchema } from "../schema.pg";
import { and, eq, isNull } from "drizzle-orm";

export type McpServerCustomization = {
  id: string;
  userId: string;
  mcpServerName: string;
  customInstructions?: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export const pgMcpServerCustomizationRepository: McpServerCustomizationRepository =
  {
    async selectByUserIdAndMcpServerId(
      key: {
        userId: string;
        mcpServerId: string;
      },
      organizationId: string | null,
    ) {
      const [result] = await db
        .select({
          id: McpServerCustomizationSchema.id,
          userId: McpServerCustomizationSchema.userId,
          mcpServerId: McpServerCustomizationSchema.mcpServerId,
          prompt: McpServerCustomizationSchema.prompt,
          serverName: McpServerSchema.name,
        })
        .from(McpServerCustomizationSchema)
        .innerJoin(
          McpServerSchema,
          and(
            eq(McpServerCustomizationSchema.mcpServerId, McpServerSchema.id),
            // Ensure the MCP server also belongs to the same organization context
            organizationId
              ? eq(McpServerSchema.organizationId, organizationId)
              : isNull(McpServerSchema.organizationId),
          ),
        )
        .where(
          and(
            eq(McpServerCustomizationSchema.userId, key.userId),
            eq(McpServerCustomizationSchema.mcpServerId, key.mcpServerId),
            organizationId
              ? eq(McpServerCustomizationSchema.organizationId, organizationId)
              : isNull(McpServerCustomizationSchema.organizationId),
          ),
        );
      return result ?? null;
    },

    async selectByUserId(userId: string, organizationId: string | null) {
      return db
        .select({
          id: McpServerCustomizationSchema.id,
          userId: McpServerCustomizationSchema.userId,
          mcpServerId: McpServerCustomizationSchema.mcpServerId,
          prompt: McpServerCustomizationSchema.prompt,
          serverName: McpServerSchema.name,
        })
        .from(McpServerCustomizationSchema)
        .innerJoin(
          McpServerSchema,
          and(
            eq(McpServerCustomizationSchema.mcpServerId, McpServerSchema.id),
            // Ensure the MCP server also belongs to the same organization context
            organizationId
              ? eq(McpServerSchema.organizationId, organizationId)
              : isNull(McpServerSchema.organizationId),
          ),
        )
        .where(
          and(
            eq(McpServerCustomizationSchema.userId, userId),
            organizationId
              ? eq(McpServerCustomizationSchema.organizationId, organizationId)
              : isNull(McpServerCustomizationSchema.organizationId),
          ),
        );
    },

    async upsertMcpServerCustomization(
      data: { userId: string; mcpServerId: string; prompt?: string | null },
      organizationId: string | null,
    ) {
      // Verify the MCP server belongs to the current organization context
      const [server] = await db
        .select()
        .from(McpServerSchema)
        .where(
          and(
            eq(McpServerSchema.id, data.mcpServerId),
            organizationId
              ? eq(McpServerSchema.organizationId, organizationId)
              : isNull(McpServerSchema.organizationId),
          ),
        )
        .limit(1);

      if (!server) {
        throw new Error("MCP server not found or access denied");
      }

      const now = new Date();
      const [result] = await db
        .insert(McpServerCustomizationSchema)
        .values({
          userId: data.userId,
          organizationId,
          mcpServerId: data.mcpServerId,
          prompt: data.prompt,
        })
        .onConflictDoUpdate({
          target: [
            McpServerCustomizationSchema.userId,
            McpServerCustomizationSchema.organizationId,
            McpServerCustomizationSchema.mcpServerId,
          ],
          set: {
            prompt: data.prompt ?? null,
            updatedAt: now,
          },
        })
        .returning();
      return result as any;
    },

    async deleteMcpServerCustomizationByMcpServerIdAndUserId(
      key: {
        mcpServerId: string;
        userId: string;
      },
      organizationId: string | null,
    ) {
      await db
        .delete(McpServerCustomizationSchema)
        .where(
          and(
            eq(McpServerCustomizationSchema.mcpServerId, key.mcpServerId),
            eq(McpServerCustomizationSchema.userId, key.userId),
            organizationId
              ? eq(McpServerCustomizationSchema.organizationId, organizationId)
              : isNull(McpServerCustomizationSchema.organizationId),
          ),
        );
    },
  };
