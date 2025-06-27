import { pgDb as db } from "../db.pg";
import { McpServerSchema, MemberSchema } from "../schema.pg";
import { and, eq, isNull } from "drizzle-orm";
import { generateUUID } from "lib/utils";
import type { MCPRepository } from "app-types/mcp";
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

async function checkAdminPermission(
  userId: string,
  organizationId: string | null,
) {
  // In personal mode, user is always admin
  if (!organizationId) {
    return true;
  }

  // In organization mode, check if user is admin or owner
  const [member] = await db
    .select()
    .from(MemberSchema)
    .where(
      and(
        eq(MemberSchema.userId, userId),
        eq(MemberSchema.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!member) {
    throw new Error("User is not a member of this organization");
  }

  if (member.role !== "admin" && member.role !== "owner") {
    throw new Error("Only organization admins can manage MCP servers");
  }

  return true;
}

export const pgMcpRepository: MCPRepository = {
  async save(server) {
    const { userId, organizationId } = await getSessionContext();
    await checkAdminPermission(userId, organizationId);

    const [result] = await db
      .insert(McpServerSchema)
      .values({
        id: server.id ?? generateUUID(),
        name: server.name,
        config: server.config,
        enabled: true,
        createdBy: userId,
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

  async selectById(id) {
    const { organizationId } = await getSessionContext();

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

  async selectAll() {
    const { organizationId } = await getSessionContext();

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

  async deleteById(id) {
    const { userId, organizationId } = await getSessionContext();
    await checkAdminPermission(userId, organizationId);

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

  async selectByServerName(name) {
    const { organizationId } = await getSessionContext();

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

  async existsByServerName(name) {
    const { organizationId } = await getSessionContext();

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
