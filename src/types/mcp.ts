import { Tool } from "ai";
import { z } from "zod";

export const MCPRemoteConfigZodSchema = z.object({
  url: z.string().url().describe("The URL of the SSE endpoint"),
  headers: z.record(z.string(), z.string()).optional(),
});

export const MCPStdioConfigZodSchema = z.object({
  command: z.string().min(1).describe("The command to run"),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
});

export const AllowedMCPServerZodSchema = z.object({
  tools: z.array(z.string()),
  // resources: z.array(z.string()).optional(),
});

export type AllowedMCPServer = z.infer<typeof AllowedMCPServerZodSchema>;

export type MCPRemoteConfig = z.infer<typeof MCPRemoteConfigZodSchema>;
export type MCPStdioConfig = z.infer<typeof MCPStdioConfigZodSchema>;

export type MCPServerConfig = MCPRemoteConfig | MCPStdioConfig;

export type MCPToolInfo = {
  name: string;
  description: string;
  inputSchema?: {
    type?: any;
    properties?: Record<string, any>;
    required?: string[];
  };
};

export type MCPServerInfo = {
  name: string;
  config: MCPServerConfig;
  error?: unknown;
  status: "connected" | "disconnected" | "loading";
  toolInfo: MCPToolInfo[];
};

export type McpServerInsert = {
  name: string;
  config: MCPServerConfig;
  id?: string;
};
export type McpServerSelect = {
  name: string;
  config: MCPServerConfig;
  id: string;
};

export type VercelAIMcpTool = Tool & {
  _mcpServerName: string;
  _mcpServerId: string;
  _originToolName: string;
};

export interface MCPRepository {
  save(
    server: McpServerInsert,
    userId: string,
    organizationId: string | null,
  ): Promise<McpServerSelect>;
  selectById(
    id: string,
    userId: string,
    organizationId: string | null,
  ): Promise<McpServerSelect | null>;
  selectByServerName(
    name: string,
    userId: string,
    organizationId: string | null,
  ): Promise<McpServerSelect | null>;
  selectAll(
    userId: string,
    organizationId: string | null,
  ): Promise<McpServerSelect[]>;
  deleteById(
    id: string,
    userId: string,
    organizationId: string | null,
  ): Promise<void>;
  existsByServerName(
    name: string,
    userId: string,
    organizationId: string | null,
  ): Promise<boolean>;
}

export const McpToolCustomizationZodSchema = z.object({
  toolName: z.string().min(1),
  mcpServerId: z.string().min(1),
  prompt: z.string().max(1000).optional().nullable(),
});

export type McpToolCustomization = {
  id: string;
  userId: string;
  toolName: string;
  mcpServerId: string;
  prompt?: string | null;
};

export type McpToolCustomizationRepository = {
  select(
    key: {
      userId: string;
      mcpServerId: string;
      toolName: string;
    },
    organizationId: string | null,
  ): Promise<McpToolCustomization | null>;
  selectByUserIdAndMcpServerId: (
    key: {
      userId: string;
      mcpServerId: string;
    },
    organizationId: string | null,
  ) => Promise<McpToolCustomization[]>;
  selectByUserId: (
    userId: string,
    organizationId: string | null,
  ) => Promise<(McpToolCustomization & { serverName: string })[]>;
  upsertToolCustomization: (
    data: PartialBy<McpToolCustomization, "id">,
    organizationId: string | null,
  ) => Promise<McpToolCustomization>;
  deleteToolCustomization: (
    key: {
      userId: string;
      mcpServerId: string;
      toolName: string;
    },
    organizationId: string | null,
  ) => Promise<void>;
};

export const McpServerCustomizationZodSchema = z.object({
  mcpServerId: z.string().min(1),
  prompt: z.string().max(3000).optional().nullable(),
});

export type McpServerCustomization = {
  id: string;
  userId: string;
  mcpServerId: string;
  prompt?: string | null;
};

export type McpServerCustomizationRepository = {
  selectByUserIdAndMcpServerId: (
    key: {
      userId: string;
      mcpServerId: string;
    },
    organizationId: string | null,
  ) => Promise<(McpServerCustomization & { serverName: string }) | null>;
  selectByUserId: (
    userId: string,
    organizationId: string | null,
  ) => Promise<(McpServerCustomization & { serverName: string })[]>;
  upsertMcpServerCustomization: (
    data: PartialBy<McpServerCustomization, "id">,
    organizationId: string | null,
  ) => Promise<McpServerCustomization>;
  deleteMcpServerCustomizationByMcpServerIdAndUserId: (
    key: {
      mcpServerId: string;
      userId: string;
    },
    organizationId: string | null,
  ) => Promise<void>;
};

export type McpServerCustomizationsPrompt = {
  name: string;
  id: string;
  prompt?: string;
  tools?: {
    [toolName: string]: string;
  };
};
