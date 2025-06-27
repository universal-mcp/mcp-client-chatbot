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
  twoFactor as TwoFactorSchema,
  apikey as ApiKeySchema,
  passkey as PasskeySchema,
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
});

export const ChatMessageSchema = pgTable("chat_message", {
  id: text("id").primaryKey().notNull(),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => ChatThreadSchema.id),
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

// Tool customization table for per-user additional AI instructions
export const McpToolCustomizationSchema = pgTable(
  "mcp_server_tool_custom_instructions",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => UserSchema.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(
      () => OrganizationSchema.id,
      { onDelete: "cascade" },
    ),
    toolName: text("tool_name").notNull(),
    mcpServerId: uuid("mcp_server_id")
      .notNull()
      .references(() => McpServerSchema.id, { onDelete: "cascade" }),
    prompt: text("prompt"),
    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    unique().on(
      table.userId,
      table.organizationId,
      table.toolName,
      table.mcpServerId,
    ),
  ],
);

export const McpServerCustomizationSchema = pgTable(
  "mcp_server_custom_instructions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
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
    prompt: text("prompt"),
    createdAt: timestamp("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    unique().on(table.userId, table.organizationId, table.mcpServerId),
  ],
);

export {
  UserSchema,
  SessionSchema,
  AccountSchema,
  VerificationSchema,
  OrganizationSchema,
  MemberSchema,
  InvitationSchema,
  TwoFactorSchema,
  ApiKeySchema,
  PasskeySchema,
};

export type McpServerEntity = typeof McpServerSchema.$inferSelect;
export type ChatThreadEntity = typeof ChatThreadSchema.$inferSelect;
export type ChatMessageEntity = typeof ChatMessageSchema.$inferSelect;
export type ProjectEntity = typeof ProjectSchema.$inferSelect;
export type UserEntity = typeof UserSchema.$inferSelect;
export type ToolCustomizationEntity =
  typeof McpToolCustomizationSchema.$inferSelect;
export type McpServerCustomizationEntity =
  typeof McpServerCustomizationSchema.$inferSelect;
export type OrganizationEntity = typeof OrganizationSchema.$inferSelect;
export type MemberEntity = typeof MemberSchema.$inferSelect;
