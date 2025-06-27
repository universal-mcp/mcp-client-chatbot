import { pgDb as db } from "../db.pg";
import { McpServerSchema, McpToolCustomizationSchema } from "../schema.pg";
import { and, eq, isNull } from "drizzle-orm";
import type { McpToolCustomizationRepository } from "@/types/mcp";

export const pgMcpMcpToolCustomizationRepository: McpToolCustomizationRepository =
  {
    async select(
      key: {
        userId: string;
        mcpServerId: string;
        toolName: string;
      },
      organizationId: string | null,
    ) {
      const [result] = await db
        .select()
        .from(McpToolCustomizationSchema)
        .where(
          and(
            eq(McpToolCustomizationSchema.userId, key.userId),
            eq(McpToolCustomizationSchema.mcpServerId, key.mcpServerId),
            eq(McpToolCustomizationSchema.toolName, key.toolName),
            organizationId
              ? eq(McpToolCustomizationSchema.organizationId, organizationId)
              : isNull(McpToolCustomizationSchema.organizationId),
          ),
        );
      return result;
    },

    async selectByUserIdAndMcpServerId(
      key: {
        userId: string;
        mcpServerId: string;
      },
      organizationId: string | null,
    ) {
      const rows = await db
        .select()
        .from(McpToolCustomizationSchema)
        .where(
          and(
            eq(McpToolCustomizationSchema.userId, key.userId),
            eq(McpToolCustomizationSchema.mcpServerId, key.mcpServerId),
            organizationId
              ? eq(McpToolCustomizationSchema.organizationId, organizationId)
              : isNull(McpToolCustomizationSchema.organizationId),
          ),
        );
      return rows;
    },

    async selectByUserId(userId: string, organizationId: string | null) {
      return db
        .select({
          id: McpToolCustomizationSchema.id,
          userId: McpToolCustomizationSchema.userId,
          toolName: McpToolCustomizationSchema.toolName,
          mcpServerId: McpToolCustomizationSchema.mcpServerId,
          prompt: McpToolCustomizationSchema.prompt,
          serverName: McpServerSchema.name,
        })
        .from(McpToolCustomizationSchema)
        .innerJoin(
          McpServerSchema,
          and(
            eq(McpToolCustomizationSchema.mcpServerId, McpServerSchema.id),
            // Ensure the MCP server also belongs to the same organization context
            organizationId
              ? eq(McpServerSchema.organizationId, organizationId)
              : isNull(McpServerSchema.organizationId),
          ),
        )
        .where(
          and(
            eq(McpToolCustomizationSchema.userId, userId),
            organizationId
              ? eq(McpToolCustomizationSchema.organizationId, organizationId)
              : isNull(McpToolCustomizationSchema.organizationId),
          ),
        );
    },

    async upsertToolCustomization(
      data: {
        userId: string;
        mcpServerId: string;
        toolName: string;
        prompt?: string | null;
      },
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
        .insert(McpToolCustomizationSchema)
        .values({
          userId: data.userId,
          organizationId,
          toolName: data.toolName,
          mcpServerId: data.mcpServerId,
          prompt: data.prompt,
        })
        .onConflictDoUpdate({
          target: [
            McpToolCustomizationSchema.userId,
            McpToolCustomizationSchema.organizationId,
            McpToolCustomizationSchema.toolName,
            McpToolCustomizationSchema.mcpServerId,
          ],
          set: {
            prompt: data.prompt ?? null,
            updatedAt: now,
          },
        })
        .returning();
      return result as any;
    },

    async deleteToolCustomization(
      key: {
        mcpServerId: string;
        toolName: string;
        userId: string;
      },
      organizationId: string | null,
    ) {
      await db
        .delete(McpToolCustomizationSchema)
        .where(
          and(
            eq(McpToolCustomizationSchema.mcpServerId, key.mcpServerId),
            eq(McpToolCustomizationSchema.toolName, key.toolName),
            eq(McpToolCustomizationSchema.userId, key.userId),
            organizationId
              ? eq(McpToolCustomizationSchema.organizationId, organizationId)
              : isNull(McpToolCustomizationSchema.organizationId),
          ),
        );
    },
  };
