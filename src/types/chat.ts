import type { UIMessage, Message } from "ai";
import { z } from "zod";
import { AllowedMCPServerZodSchema } from "./mcp";
import { UserPreferences } from "./user";

export type ChatModel = {
  provider: string;
  model: string;
};

export type ChatThread = {
  id: string;
  title: string;
  createdAt: Date;
  userId: string;
  projectId: string | null;
  isPublic: boolean;
};

export type Project = {
  id: string;
  name: string;
  userId: string;
  instructions: {
    systemPrompt: string;
  };
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectMcpServerConfig = {
  mcpServerId: string;
  enabled: boolean;
};

export type ProjectMcpToolConfig = {
  mcpServerId: string;
  toolName: string;
  enabled: boolean;
  mode: "auto" | "manual";
};

export type ChatMessage = {
  id: string;
  threadId: string;
  role: UIMessage["role"];
  parts: UIMessage["parts"];
  annotations?: ChatMessageAnnotation[];
  attachments?: unknown[];
  model: string | null;
  createdAt: Date;
};

export type ChatMention =
  | {
      type: "tool";
      name: string;
      serverName?: string;
      serverId: string;
    }
  | {
      type: "mcpServer";
      name: string;
      serverId: string;
    }
  | {
      type: "unknown";
      name: string;
    };

export type ChatMessageAnnotation = {
  usageTokens?: number;
  toolChoice?: "auto" | "none" | "manual";
  file?: {
    filename: string;
    content: string;
  };
  [key: string]: any;
};

export const chatApiSchemaRequestBodySchema = z.object({
  id: z.string(),
  projectId: z.string().nullable(),
  message: z.any() as z.ZodType<UIMessage>,
  chatModel: z
    .object({
      provider: z.string(),
      model: z.string(),
    })
    .optional(),
  toolChoice: z.enum(["auto", "none", "manual"]),
  allowedMcpServers: z.record(z.string(), AllowedMCPServerZodSchema).optional(),
  allowedAppDefaultToolkit: z.array(z.string()).optional(),
  llmModel: z.string(),
});

export type ChatApiSchemaRequestBody = z.infer<
  typeof chatApiSchemaRequestBodySchema
>;

export type ToolInvocationUIPart = Extract<
  Exclude<Message["parts"], undefined>[number],
  { type: "tool-invocation" }
>;

export type ChatRepository = {
  insertThread(
    thread: Omit<ChatThread, "createdAt">,
    userId: string,
    organizationId: string | null,
  ): Promise<ChatThread>;

  selectThread(
    id: string,
    userId: string,
    organizationId: string | null,
  ): Promise<ChatThread | null>;

  getPublicThread(
    id: string,
  ): Promise<
    (ChatThread & { userEmail: string | null; userName: string | null }) | null
  >;

  deleteChatMessage(
    id: string,
    userId: string,
    organizationId: string | null,
  ): Promise<void>;

  selectThreadDetails(
    id: string,
    userId: string,
    organizationId: string | null,
  ): Promise<
    | (ChatThread & {
        instructions: Project["instructions"] | null;
        messages: ChatMessage[];
        userPreferences?: UserPreferences;
      })
    | null
  >;

  selectThreadInstructions(
    userId: string,
    threadId: string | null,
    organizationId: string | null,
  ): Promise<{
    instructions: Project["instructions"] | null;
    userPreferences?: UserPreferences;
    threadId?: string;
    projectId?: string;
  }>;
  selectThreadInstructionsByProjectId(
    userId: string,
    projectId: string | null,
    organizationId: string | null,
  ): Promise<{
    instructions: Project["instructions"] | null;
    userPreferences?: UserPreferences;
  }>;

  selectMessagesByThreadId(
    threadId: string,
    userId: string,
    organizationId: string | null,
  ): Promise<ChatMessage[]>;

  selectThreadsByUserId(
    userId: string,
    organizationId: string | null,
  ): Promise<
    (ChatThread & {
      lastMessageAt: number;
    })[]
  >;

  updateThread(
    id: string,
    thread: Partial<Omit<ChatThread, "id" | "createdAt">>,
    userId: string,
    organizationId: string | null,
  ): Promise<ChatThread>;

  upsertThread(
    thread: PartialBy<Omit<ChatThread, "createdAt">, "projectId" | "userId">,
  ): Promise<ChatThread>;

  deleteThread(
    id: string,
    userId: string,
    organizationId: string | null,
  ): Promise<void>;

  insertMessage(
    message: Omit<ChatMessage, "createdAt">,
    userId: string,
    organizationId: string | null,
  ): Promise<ChatMessage>;
  upsertMessage(
    message: Omit<ChatMessage, "createdAt">,
    userId: string,
    organizationId: string | null,
  ): Promise<ChatMessage>;

  deleteMessagesByChatIdAfterTimestamp(
    messageId: string,
    userId: string,
    organizationId: string | null,
  ): Promise<void>;

  deleteNonProjectThreads(
    userId: string,
    organizationId: string | null,
  ): Promise<void>;
  deleteAllThreads(
    userId: string,
    organizationId: string | null,
  ): Promise<void>;

  insertProject(
    project: Omit<Project, "id" | "createdAt" | "updatedAt">,
    userId: string,
    organizationId: string | null,
    mcpConfig?: {
      tools: ProjectMcpToolConfig[];
    },
  ): Promise<Project>;

  selectProjectById(
    id: string,
    userId: string,
    organizationId: string | null,
  ): Promise<
    | (Project & {
        threads: ChatThread[];
      })
    | null
  >;

  selectProjectsByUserId(
    userId: string,
    organizationId: string | null,
  ): Promise<Omit<Project, "instructions">[]>;

  updateProject(
    id: string,
    project: Partial<Pick<Project, "name" | "instructions">>,
    userId: string,
    organizationId: string | null,
  ): Promise<Project>;

  deleteProject(
    id: string,
    userId: string,
    organizationId: string | null,
  ): Promise<void>;

  insertMessages(
    messages: PartialBy<ChatMessage, "createdAt">[],
    userId: string,
    organizationId: string | null,
  ): Promise<ChatMessage[]>;
};

export const ClientToolInvocationZodSchema = z.object({
  action: z.enum(["manual", "direct"]),
  result: z.any().optional(),
});

export type ClientToolInvocation = z.infer<
  typeof ClientToolInvocationZodSchema
>;
