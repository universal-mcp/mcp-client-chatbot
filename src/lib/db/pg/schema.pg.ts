import { ChatMessage, Project } from "app-types/chat";

import { MCPServerConfig } from "app-types/mcp";
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  json,
  uuid,
  boolean,
  unique,
} from "drizzle-orm/pg-core";
import {
  user as UserSchema,
  session as SessionSchema,
  account as AccountSchema,
  verification as VerificationSchema,
  organization as OrganizationSchema,
  member as MemberSchema,
  invitation as InvitationSchema,
} from "./auth.pg";

export const ChatThreadSchema = pgTable("chat_thread", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  title: text("title").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => UserSchema.id),
  organizationId: uuid("organization_id").references(
    () => OrganizationSchema.id,
    { onDelete: "cascade" },
  ),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  projectId: uuid("project_id"),
  isPublic: boolean("is_public").notNull().default(false),
});

export const ChatMessageSchema = pgTable("chat_message", {
  id: text("id").primaryKey().notNull(),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => ChatThreadSchema.id, { onDelete: "cascade" }),
  role: text("role").notNull().$type<ChatMessage["role"]>(),
  parts: json("parts").notNull().array(),
  attachments: json("attachments").array(),
  annotations: json("annotations").array(),
  model: text("model"),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const ProjectSchema = pgTable("project", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  userId: uuid("user_id")
    .notNull()
    .references(() => UserSchema.id),
  organizationId: uuid("organization_id").references(
    () => OrganizationSchema.id,
    { onDelete: "cascade" },
  ),
  instructions: json("instructions").$type<Project["instructions"]>(),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const McpServerSchema = pgTable("mcp_server", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: text("name").notNull(),
  config: json("config").notNull().$type<MCPServerConfig>(),
  enabled: boolean("enabled").notNull().default(true),
  userId: uuid("user_id")
    .notNull()
    .references(() => UserSchema.id),
  organizationId: uuid("organization_id").references(
    () => OrganizationSchema.id,
    { onDelete: "cascade" },
  ),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// OAuth tokens and credentials for MCP servers
export const McpOAuthTokenSchema = pgTable(
  "mcp_oauth_token",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => UserSchema.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(
      () => OrganizationSchema.id,
      { onDelete: "cascade" },
    ),
    mcpServerId: uuid("mcp_server_id")
      .notNull()
      .references(() => McpServerSchema.id, { onDelete: "cascade" }),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    tokenType: text("token_type").notNull().default("Bearer"),
    scope: text("scope"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    uniqueConstraint: unique().on(
      table.userId,
      table.organizationId,
      table.mcpServerId,
    ),
  }),
);

// OAuth client credentials for MCP servers (for dynamic registration)
export const McpOAuthClientSchema = pgTable(
  "mcp_oauth_client",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => UserSchema.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(
      () => OrganizationSchema.id,
      { onDelete: "cascade" },
    ),
    mcpServerId: uuid("mcp_server_id")
      .notNull()
      .references(() => McpServerSchema.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    clientSecret: text("client_secret"), // Optional for public clients
    redirectUri: text("redirect_uri").notNull(),
    authorizationEndpoint: text("authorization_endpoint").notNull(),
    tokenEndpoint: text("token_endpoint").notNull(),
    registrationEndpoint: text("registration_endpoint"),
    isDynamicallyRegistered: boolean("is_dynamically_registered").default(
      false,
    ),
    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    uniqueConstraint: unique().on(
      table.userId,
      table.organizationId,
      table.mcpServerId,
    ),
  }),
);

// OAuth state for CSRF protection during authorization flow
export const McpOAuthStateSchema = pgTable("mcp_oauth_state", {
  id: text("id").primaryKey(), // Using the secure random string as ID
  serverId: uuid("server_id")
    .notNull()
    .references(() => McpServerSchema.id, { onDelete: "cascade" }),
  serverName: text("server_name").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => UserSchema.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").references(
    () => OrganizationSchema.id,
    { onDelete: "cascade" },
  ),
  codeVerifier: text("code_verifier").notNull(),
  redirectUri: text("redirect_uri").notNull(),
  nonce: text("nonce").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Project-specific MCP tool configuration
export const ProjectMcpToolConfigSchema = pgTable(
  "project_mcp_tool_config",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => ProjectSchema.id, { onDelete: "cascade" }),
    mcpServerId: uuid("mcp_server_id").references(() => McpServerSchema.id, {
      onDelete: "cascade",
    }),
    toolName: text("tool_name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    mode: text("mode").notNull().default("auto").$type<"auto" | "manual">(),
    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    uniqueConstraint: unique().on(
      table.projectId,
      table.mcpServerId,
      table.toolName,
    ),
  }),
);

export {
  UserSchema,
  SessionSchema,
  AccountSchema,
  VerificationSchema,
  OrganizationSchema,
  MemberSchema,
  InvitationSchema,
};

export type McpServerEntity = typeof McpServerSchema.$inferSelect;
export type ChatThreadEntity = typeof ChatThreadSchema.$inferSelect;
export type ChatMessageEntity = typeof ChatMessageSchema.$inferSelect;
export type ProjectEntity = typeof ProjectSchema.$inferSelect;
export type UserEntity = typeof UserSchema.$inferSelect;
export type OrganizationEntity = typeof OrganizationSchema.$inferSelect;
export type MemberEntity = typeof MemberSchema.$inferSelect;
export type McpOAuthTokenEntity = typeof McpOAuthTokenSchema.$inferSelect;
export type McpOAuthClientEntity = typeof McpOAuthClientSchema.$inferSelect;
export type McpOAuthStateEntity = typeof McpOAuthStateSchema.$inferSelect;
export type ProjectMcpToolConfigEntity =
  typeof ProjectMcpToolConfigSchema.$inferSelect;
