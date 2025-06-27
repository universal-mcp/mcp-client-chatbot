import { pgDb as db } from "../db.pg";
import { McpServerSchema, McpToolCustomizationSchema } from "../schema.pg";
import { and, eq, isNull } from "drizzle-orm";
import type { McpToolCustomizationRepository } from "@/types/mcp";
import { getSession } from "@/lib/auth/server";

async function getSessionContext() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized: No active session");
  }
  return {
    userId: session.user.id,
    organizationId: session.session.activeOrganizationId || null,
  };
}

export const pgMcpMcpToolCustomizationRepository: McpToolCustomizationRepository =
  {
    async select(key) {
      const { userId, organizationId } = await getSessionContext();

      const [result] = await db
        .select()
        .from(McpToolCustomizationSchema)
        .where(
          and(
            eq(McpToolCustomizationSchema.userId, userId),
            eq(McpToolCustomizationSchema.mcpServerId, key.mcpServerId),
            eq(McpToolCustomizationSchema.toolName, key.toolName),
            organizationId
              ? eq(McpToolCustomizationSchema.organizationId, organizationId)
              : isNull(McpToolCustomizationSchema.organizationId),
          ),
        );
      return result;
    },

    async selectByUserIdAndMcpServerId(key) {
      const { userId, organizationId } = await getSessionContext();

      const rows = await db
        .select()
        .from(McpToolCustomizationSchema)
        .where(
          and(
            eq(McpToolCustomizationSchema.userId, userId),
            eq(McpToolCustomizationSchema.mcpServerId, key.mcpServerId),
            organizationId
              ? eq(McpToolCustomizationSchema.organizationId, organizationId)
              : isNull(McpToolCustomizationSchema.organizationId),
          ),
        );
      return rows;
    },

    async selectByUserId(userId) {
      const { organizationId } = await getSessionContext();

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

    async upsertToolCustomization(data) {
      const { userId, organizationId } = await getSessionContext();

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
          userId,
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

    async deleteToolCustomization(key) {
      const { userId, organizationId } = await getSessionContext();

      await db
        .delete(McpToolCustomizationSchema)
        .where(
          and(
            eq(McpToolCustomizationSchema.mcpServerId, key.mcpServerId),
            eq(McpToolCustomizationSchema.toolName, key.toolName),
            eq(McpToolCustomizationSchema.userId, userId),
            organizationId
              ? eq(McpToolCustomizationSchema.organizationId, organizationId)
              : isNull(McpToolCustomizationSchema.organizationId),
          ),
        );
    },
  };
