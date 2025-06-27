import { pgDb as db } from "../db.pg";
import { McpServerSchema } from "../schema.pg";
import { and, eq, isNull } from "drizzle-orm";
import { generateUUID } from "lib/utils";
import type { MCPRepository } from "app-types/mcp";

export const pgMcpRepository: MCPRepository = {
  async save(server, userId: string, organizationId: string | null) {
    const [result] = await db
      .insert(McpServerSchema)
      .values({
        id: server.id ?? generateUUID(),
        name: server.name,
        config: server.config,
        enabled: true,
        userId,
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [McpServerSchema.id],
        set: {
          config: server.config,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result;
  },

  async selectById(id, _userId: string, organizationId: string | null) {
    const [result] = await db
      .select()
      .from(McpServerSchema)
      .where(
        and(
          eq(McpServerSchema.id, id),
          organizationId
            ? eq(McpServerSchema.organizationId, organizationId)
            : isNull(McpServerSchema.organizationId),
        ),
      );
    return result;
  },

  async selectAll(_userId: string, organizationId: string | null) {
    const results = await db
      .select()
      .from(McpServerSchema)
      .where(
        organizationId
          ? eq(McpServerSchema.organizationId, organizationId)
          : isNull(McpServerSchema.organizationId),
      );
    return results;
  },

  async deleteById(id, _userId: string, organizationId: string | null) {
    // Verify the server belongs to the current organization context
    const [server] = await db
      .select()
      .from(McpServerSchema)
      .where(
        and(
          eq(McpServerSchema.id, id),
          organizationId
            ? eq(McpServerSchema.organizationId, organizationId)
            : isNull(McpServerSchema.organizationId),
        ),
      )
      .limit(1);

    if (!server) {
      throw new Error("MCP server not found or access denied");
    }

    await db.delete(McpServerSchema).where(eq(McpServerSchema.id, id));
  },

  async selectByServerName(
    name,
    _userId: string,
    organizationId: string | null,
  ) {
    const [result] = await db
      .select()
      .from(McpServerSchema)
      .where(
        and(
          eq(McpServerSchema.name, name),
          organizationId
            ? eq(McpServerSchema.organizationId, organizationId)
            : isNull(McpServerSchema.organizationId),
        ),
      );
    return result;
  },

  async existsByServerName(
    name,
    _userId: string,
    organizationId: string | null,
  ) {
    const [result] = await db
      .select({ id: McpServerSchema.id })
      .from(McpServerSchema)
      .where(
        and(
          eq(McpServerSchema.name, name),
          organizationId
            ? eq(McpServerSchema.organizationId, organizationId)
            : isNull(McpServerSchema.organizationId),
        ),
      );

    return !!result;
  },
};
