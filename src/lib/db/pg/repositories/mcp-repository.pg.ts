import { pgDb as db } from "../db.pg";
import {
  McpServerSchema,
  McpOAuthClientSchema,
  McpOAuthTokenSchema,
  McpOAuthStateSchema,
  type McpOAuthStateEntity,
  type McpOAuthClientEntity,
  type McpOAuthTokenEntity,
} from "../schema.pg";
import { and, eq, isNull, lte } from "drizzle-orm";
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
        target: McpServerSchema.id,
        set: {
          config: server.config,
          name: server.name,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result;
  },

  async selectById(id, userId: string, organizationId: string | null) {
    const [result] = await db
      .select()
      .from(McpServerSchema)
      .where(
        and(
          eq(McpServerSchema.id, id),
          organizationId
            ? // In organization context: allow access to any server in the org
              eq(McpServerSchema.organizationId, organizationId)
            : // In personal context: only allow access to user's personal servers
              and(
                eq(McpServerSchema.userId, userId),
                isNull(McpServerSchema.organizationId),
              ),
        ),
      );
    return result;
  },

  async selectAll(userId: string, organizationId: string | null) {
    const results = await db
      .select()
      .from(McpServerSchema)
      .where(
        organizationId
          ? // In organization context: show all servers for this organization
            eq(McpServerSchema.organizationId, organizationId)
          : // In personal context: show only user's personal servers
            and(
              eq(McpServerSchema.userId, userId),
              isNull(McpServerSchema.organizationId),
            ),
      );
    return results;
  },

  async deleteById(id, userId: string, organizationId: string | null) {
    // Verify the server exists in the current context
    const [server] = await db
      .select({ id: McpServerSchema.id })
      .from(McpServerSchema)
      .where(
        and(
          eq(McpServerSchema.id, id),
          organizationId
            ? // In organization context: can delete any server in the org
              eq(McpServerSchema.organizationId, organizationId)
            : // In personal context: can only delete own personal servers
              and(
                eq(McpServerSchema.userId, userId),
                isNull(McpServerSchema.organizationId),
              ),
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
    userId: string,
    organizationId: string | null,
  ) {
    const [result] = await db
      .select()
      .from(McpServerSchema)
      .where(
        and(
          eq(McpServerSchema.name, name),
          organizationId
            ? // In organization context: find any server with this name in the org
              eq(McpServerSchema.organizationId, organizationId)
            : // In personal context: find user's personal server with this name
              and(
                eq(McpServerSchema.userId, userId),
                isNull(McpServerSchema.organizationId),
              ),
        ),
      );
    return result;
  },

  async existsByServerName(
    name,
    userId: string,
    organizationId: string | null,
  ) {
    const [result] = await db
      .select({ id: McpServerSchema.id })
      .from(McpServerSchema)
      .where(
        and(
          eq(McpServerSchema.name, name),
          organizationId
            ? // In organization context: check if name exists in org
              eq(McpServerSchema.organizationId, organizationId)
            : // In personal context: check if name exists in user's personal servers
              and(
                eq(McpServerSchema.userId, userId),
                isNull(McpServerSchema.organizationId),
              ),
        ),
      );

    return !!result;
  },
};

// --- MCP OAuth State Repository ---
export const pgMcpOAuthStateRepository = {
  async save(state: McpOAuthStateEntity) {
    return db.insert(McpOAuthStateSchema).values(state).returning();
  },

  async findById(id: string) {
    const [result] = await db
      .select()
      .from(McpOAuthStateSchema)
      .where(eq(McpOAuthStateSchema.id, id));
    return result;
  },

  async deleteById(id: string) {
    return db.delete(McpOAuthStateSchema).where(eq(McpOAuthStateSchema.id, id));
  },

  async cleanupExpired() {
    return db
      .delete(McpOAuthStateSchema)
      .where(lte(McpOAuthStateSchema.expiresAt, new Date()));
  },
};

// --- MCP OAuth Client Repository ---
export const pgMcpOAuthClientRepository = {
  async findByServerId(
    mcpServerId: string,
    userId: string,
    organizationId: string | null,
  ) {
    const [result] = await db
      .select()
      .from(McpOAuthClientSchema)
      .where(
        and(
          eq(McpOAuthClientSchema.mcpServerId, mcpServerId),
          eq(McpOAuthClientSchema.userId, userId),
          organizationId
            ? eq(McpOAuthClientSchema.organizationId, organizationId)
            : isNull(McpOAuthClientSchema.organizationId),
        ),
      );
    return result;
  },

  async save(
    client: Omit<McpOAuthClientEntity, "id" | "createdAt" | "updatedAt">,
  ) {
    const [result] = await db
      .insert(McpOAuthClientSchema)
      .values({
        ...client,
        id: generateUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result;
  },
};

// --- MCP OAuth Token Repository ---
export const pgMcpOAuthTokenRepository = {
  async findByServerId(
    mcpServerId: string,
    userId: string,
    organizationId: string | null,
  ) {
    const [result] = await db
      .select()
      .from(McpOAuthTokenSchema)
      .where(
        and(
          eq(McpOAuthTokenSchema.mcpServerId, mcpServerId),
          eq(McpOAuthTokenSchema.userId, userId),
          organizationId
            ? eq(McpOAuthTokenSchema.organizationId, organizationId)
            : isNull(McpOAuthTokenSchema.organizationId),
        ),
      );
    return result;
  },

  async save(
    token: Omit<McpOAuthTokenEntity, "id" | "createdAt" | "updatedAt">,
  ) {
    const values = {
      ...token,
      id: generateUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return db
      .insert(McpOAuthTokenSchema)
      .values(values)
      .onConflictDoUpdate({
        target: [
          McpOAuthTokenSchema.userId,
          McpOAuthTokenSchema.mcpServerId,
          McpOAuthTokenSchema.organizationId,
        ],
        set: {
          accessToken: token.accessToken,
          refreshToken: token.refreshToken,
          tokenType: token.tokenType,
          scope: token.scope,
          expiresAt: token.expiresAt,
          updatedAt: new Date(),
        },
      })
      .returning();
  },

  async deleteByServerId(
    mcpServerId: string,
    userId: string,
    organizationId: string | null,
  ) {
    return db
      .delete(McpOAuthTokenSchema)
      .where(
        and(
          eq(McpOAuthTokenSchema.mcpServerId, mcpServerId),
          eq(McpOAuthTokenSchema.userId, userId),
          organizationId
            ? eq(McpOAuthTokenSchema.organizationId, organizationId)
            : isNull(McpOAuthTokenSchema.organizationId),
        ),
      );
  },
};
