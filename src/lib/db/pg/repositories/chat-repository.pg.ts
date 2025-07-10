import {
  ChatMessage,
  ChatRepository,
  ChatThread,
  Project,
  ProjectMcpToolConfig,
} from "app-types/chat";

import { pgDb as db } from "../db.pg";
import {
  ChatMessageSchema,
  ChatThreadSchema,
  ProjectSchema,
  UserSchema,
} from "../schema.pg";

import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { pgUserRepository } from "./user-repository.pg";
import { UserPreferences } from "app-types/user";
import { pgProjectMcpConfigRepository } from "./project-mcp-config-repository.pg";
import { ProjectEntity } from "../schema.pg";

export const pgChatRepository: ChatRepository = {
  insertThread: async (
    thread: Omit<ChatThread, "createdAt">,
    userId: string,
    organizationId: string | null,
  ): Promise<ChatThread> => {
    const [result] = await db
      .insert(ChatThreadSchema)
      .values({
        title: thread.title,
        userId,
        organizationId,
        projectId: thread.projectId,
        id: thread.id,
      })
      .returning();
    return result;
  },

  deleteChatMessage: async (
    id: string,
    userId: string,
    organizationId: string | null,
  ): Promise<void> => {
    // Verify the message belongs to a thread in the user's current organization context
    const messageThread = await db
      .select({ threadId: ChatMessageSchema.threadId })
      .from(ChatMessageSchema)
      .innerJoin(
        ChatThreadSchema,
        eq(ChatMessageSchema.threadId, ChatThreadSchema.id),
      )
      .where(
        and(
          eq(ChatMessageSchema.id, id),
          eq(ChatThreadSchema.userId, userId),
          organizationId
            ? eq(ChatThreadSchema.organizationId, organizationId)
            : isNull(ChatThreadSchema.organizationId),
        ),
      )
      .limit(1);

    if (!messageThread.length) {
      throw new Error("Message not found or access denied");
    }

    await db.delete(ChatMessageSchema).where(eq(ChatMessageSchema.id, id));
  },

  selectThread: async (
    id: string,
    userId: string,
    organizationId: string | null,
  ): Promise<ChatThread | null> => {
    const [result] = await db
      .select()
      .from(ChatThreadSchema)
      .where(
        and(
          eq(ChatThreadSchema.id, id),
          eq(ChatThreadSchema.userId, userId),
          organizationId
            ? eq(ChatThreadSchema.organizationId, organizationId)
            : isNull(ChatThreadSchema.organizationId),
        ),
      );
    return result;
  },

  selectThreadDetails: async (
    id: string,
    userId: string,
    organizationId: string | null,
  ) => {
    if (!id) {
      return null;
    }

    const [thread] = await db
      .select()
      .from(ChatThreadSchema)
      .leftJoin(ProjectSchema, eq(ChatThreadSchema.projectId, ProjectSchema.id))
      .leftJoin(UserSchema, eq(ChatThreadSchema.userId, UserSchema.id))
      .where(
        and(
          eq(ChatThreadSchema.id, id),
          eq(ChatThreadSchema.userId, userId),
          organizationId
            ? eq(ChatThreadSchema.organizationId, organizationId)
            : isNull(ChatThreadSchema.organizationId),
        ),
      );

    if (!thread) {
      return null;
    }

    const messages = await pgChatRepository.selectMessagesByThreadId(
      id,
      userId,
      organizationId,
    );
    return {
      id: thread.chat_thread.id,
      title: thread.chat_thread.title,
      userId: thread.chat_thread.userId,
      createdAt: thread.chat_thread.createdAt,
      projectId: thread.chat_thread.projectId,
      instructions: thread.project?.instructions ?? null,
      userPreferences: thread.user?.preferences ?? undefined,
      messages,
    };
  },

  selectThreadInstructionsByProjectId: async (
    userId: string,
    projectId: string | null,
    organizationId: string | null,
  ) => {
    const result = {
      instructions: null as Project["instructions"] | null,
      userPreferences: undefined as UserPreferences | undefined,
    };

    const user = await pgUserRepository.findById(userId);

    if (!user) throw new Error("User not found");

    result.userPreferences = user.preferences;

    if (projectId) {
      const [project] = await db
        .select()
        .from(ProjectSchema)
        .where(
          and(
            eq(ProjectSchema.id, projectId),
            eq(ProjectSchema.userId, userId),
            organizationId
              ? eq(ProjectSchema.organizationId, organizationId)
              : isNull(ProjectSchema.organizationId),
          ),
        );

      if (project) {
        result.instructions = project.instructions;
      }
    }

    return result;
  },

  selectThreadInstructions: async (
    userId: string,
    threadId: string | null,
    organizationId: string | null,
  ) => {
    const result = {
      instructions: null as Project["instructions"] | null,
      userPreferences: undefined as UserPreferences | undefined,
      threadId: undefined as string | undefined,
      projectId: undefined as string | undefined,
    };

    const user = await pgUserRepository.findById(userId);

    if (!user) throw new Error("User not found");

    result.userPreferences = user.preferences;

    if (threadId) {
      const [thread] = await db
        .select({
          threadId: ChatThreadSchema.id,
          projectId: ChatThreadSchema.projectId,
          instructions: ProjectSchema.instructions,
        })
        .from(ChatThreadSchema)
        .leftJoin(
          ProjectSchema,
          eq(ChatThreadSchema.projectId, ProjectSchema.id),
        )
        .where(
          and(
            eq(ChatThreadSchema.id, threadId),
            eq(ChatThreadSchema.userId, userId),
            organizationId
              ? eq(ChatThreadSchema.organizationId, organizationId)
              : isNull(ChatThreadSchema.organizationId),
          ),
        );
      if (thread) {
        result.instructions = thread.instructions;
        result.projectId = thread.projectId ?? undefined;
        result.threadId = thread.threadId;
      }
    }
    return result;
  },

  selectMessagesByThreadId: async (
    threadId: string,
    userId: string,
    organizationId: string | null,
  ): Promise<ChatMessage[]> => {
    // Verify thread belongs to current user and organization context
    const threadCheck = await db
      .select({ id: ChatThreadSchema.id })
      .from(ChatThreadSchema)
      .where(
        and(
          eq(ChatThreadSchema.id, threadId),
          eq(ChatThreadSchema.userId, userId),
          organizationId
            ? eq(ChatThreadSchema.organizationId, organizationId)
            : isNull(ChatThreadSchema.organizationId),
        ),
      )
      .limit(1);

    if (!threadCheck.length) {
      throw new Error("Thread not found or access denied");
    }

    const result = await db
      .select()
      .from(ChatMessageSchema)
      .where(eq(ChatMessageSchema.threadId, threadId))
      .orderBy(ChatMessageSchema.createdAt);
    return result as ChatMessage[];
  },

  selectThreadsByUserId: async (
    userId: string,
    organizationId: string | null,
  ): Promise<
    (ChatThread & {
      lastMessageAt: number;
    })[]
  > => {
    const threadWithLatestMessage = await db
      .select({
        threadId: ChatThreadSchema.id,
        title: ChatThreadSchema.title,
        createdAt: ChatThreadSchema.createdAt,
        userId: ChatThreadSchema.userId,
        projectId: ChatThreadSchema.projectId,
        lastMessageAt: sql<string>`MAX(${ChatMessageSchema.createdAt})`.as(
          "last_message_at",
        ),
      })
      .from(ChatThreadSchema)
      .leftJoin(
        ChatMessageSchema,
        eq(ChatThreadSchema.id, ChatMessageSchema.threadId),
      )
      .where(
        and(
          eq(ChatThreadSchema.userId, userId),
          organizationId
            ? eq(ChatThreadSchema.organizationId, organizationId)
            : isNull(ChatThreadSchema.organizationId),
        ),
      )
      .groupBy(ChatThreadSchema.id)
      .orderBy(desc(sql`last_message_at`));

    return threadWithLatestMessage.map((row) => {
      return {
        id: row.threadId,
        title: row.title,
        userId: row.userId,
        projectId: row.projectId,
        createdAt: row.createdAt,
        lastMessageAt: row.lastMessageAt
          ? new Date(row.lastMessageAt).getTime()
          : 0,
      };
    });
  },

  updateThread: async (
    id: string,
    thread: Partial<Omit<ChatThread, "id" | "createdAt">>,
    userId: string,
    organizationId: string | null,
  ): Promise<ChatThread> => {
    const [result] = await db
      .update(ChatThreadSchema)
      .set({
        projectId: thread.projectId,
        title: thread.title,
      })
      .where(
        and(
          eq(ChatThreadSchema.id, id),
          eq(ChatThreadSchema.userId, userId),
          organizationId
            ? eq(ChatThreadSchema.organizationId, organizationId)
            : isNull(ChatThreadSchema.organizationId),
        ),
      )
      .returning();
    return result;
  },

  deleteThread: async (
    id: string,
    userId: string,
    organizationId: string | null,
  ): Promise<void> => {
    // Verify thread belongs to current user and organization context
    const threadCheck = await db
      .select({ id: ChatThreadSchema.id })
      .from(ChatThreadSchema)
      .where(
        and(
          eq(ChatThreadSchema.id, id),
          eq(ChatThreadSchema.userId, userId),
          organizationId
            ? eq(ChatThreadSchema.organizationId, organizationId)
            : isNull(ChatThreadSchema.organizationId),
        ),
      )
      .limit(1);

    if (!threadCheck.length) {
      throw new Error("Thread not found or access denied");
    }

    await db
      .delete(ChatMessageSchema)
      .where(eq(ChatMessageSchema.threadId, id));

    await db.delete(ChatThreadSchema).where(eq(ChatThreadSchema.id, id));
  },

  insertMessage: async (
    message: Omit<ChatMessage, "createdAt">,
    userId: string,
    organizationId: string | null,
  ): Promise<ChatMessage> => {
    // Verify thread belongs to current user and organization context
    const threadCheck = await db
      .select({ id: ChatThreadSchema.id })
      .from(ChatThreadSchema)
      .where(
        and(
          eq(ChatThreadSchema.id, message.threadId),
          eq(ChatThreadSchema.userId, userId),
          organizationId
            ? eq(ChatThreadSchema.organizationId, organizationId)
            : isNull(ChatThreadSchema.organizationId),
        ),
      )
      .limit(1);

    if (!threadCheck.length) {
      throw new Error("Thread not found or access denied");
    }

    const entity = {
      ...message,
      id: message.id,
    };
    const [result] = await db
      .insert(ChatMessageSchema)
      .values(entity)
      .returning();
    return result as ChatMessage;
  },

  upsertMessage: async (
    message: Omit<ChatMessage, "createdAt">,
    userId: string,
    organizationId: string | null,
  ): Promise<ChatMessage> => {
    // Verify thread belongs to current user and organization context
    const threadCheck = await db
      .select({ id: ChatThreadSchema.id })
      .from(ChatThreadSchema)
      .where(
        and(
          eq(ChatThreadSchema.id, message.threadId),
          eq(ChatThreadSchema.userId, userId),
          organizationId
            ? eq(ChatThreadSchema.organizationId, organizationId)
            : isNull(ChatThreadSchema.organizationId),
        ),
      )
      .limit(1);

    if (!threadCheck.length) {
      throw new Error("Thread not found or access denied");
    }

    const result = await db
      .insert(ChatMessageSchema)
      .values(message)
      .onConflictDoUpdate({
        target: [ChatMessageSchema.id],
        set: {
          parts: message.parts,
          annotations: message.annotations,
          attachments: message.attachments,
          model: message.model,
        },
      })
      .returning();
    return result[0] as ChatMessage;
  },

  deleteMessagesByChatIdAfterTimestamp: async (
    messageId: string,
    userId: string,
    organizationId: string | null,
  ): Promise<void> => {
    const [message] = await db
      .select()
      .from(ChatMessageSchema)
      .innerJoin(
        ChatThreadSchema,
        eq(ChatMessageSchema.threadId, ChatThreadSchema.id),
      )
      .where(
        and(
          eq(ChatMessageSchema.id, messageId),
          eq(ChatThreadSchema.userId, userId),
          organizationId
            ? eq(ChatThreadSchema.organizationId, organizationId)
            : isNull(ChatThreadSchema.organizationId),
        ),
      );
    if (!message) {
      return;
    }
    // Delete messages that are in the same thread AND created before or at the same time as the target message
    await db
      .delete(ChatMessageSchema)
      .where(
        and(
          eq(ChatMessageSchema.threadId, message.chat_message.threadId),
          gte(ChatMessageSchema.createdAt, message.chat_message.createdAt),
        ),
      );
  },

  deleteNonProjectThreads: async (
    userId: string,
    organizationId: string | null,
  ): Promise<void> => {
    const threadIds = await db
      .select({ id: ChatThreadSchema.id })
      .from(ChatThreadSchema)
      .where(
        and(
          eq(ChatThreadSchema.userId, userId),
          isNull(ChatThreadSchema.projectId),
          organizationId
            ? eq(ChatThreadSchema.organizationId, organizationId)
            : isNull(ChatThreadSchema.organizationId),
        ),
      );
    await Promise.all(
      threadIds.map((threadId) =>
        pgChatRepository.deleteThread(threadId.id, userId, organizationId),
      ),
    );
  },

  deleteAllThreads: async (
    userId: string,
    organizationId: string | null,
  ): Promise<void> => {
    const threadIds = await db
      .select({ id: ChatThreadSchema.id })
      .from(ChatThreadSchema)
      .where(
        and(
          eq(ChatThreadSchema.userId, userId),
          organizationId
            ? eq(ChatThreadSchema.organizationId, organizationId)
            : isNull(ChatThreadSchema.organizationId),
        ),
      );
    await Promise.all(
      threadIds.map((threadId) =>
        pgChatRepository.deleteThread(threadId.id, userId, organizationId),
      ),
    );
  },

  insertProject: async (
    project: Omit<Project, "id" | "createdAt" | "updatedAt">,
    userId: string,
    organizationId: string | null,
    mcpConfig?: {
      tools: ProjectMcpToolConfig[];
    },
  ): Promise<Project> => {
    const [newProject] = await db
      .insert(ProjectSchema)
      .values({ ...project, userId, organizationId })
      .returning();

    if (mcpConfig && mcpConfig.tools.length > 0) {
      await pgProjectMcpConfigRepository.bulkSetProjectMcpToolConfigs(
        newProject.id,
        mcpConfig.tools,
      );
    }

    return newProject as Project;
  },

  selectProjectById: async (
    id: string,
    userId: string,
    organizationId: string | null,
  ): Promise<
    | (Project & {
        threads: ChatThread[];
      })
    | null
  > => {
    const result = await db
      .select({
        project: ProjectSchema,
        thread: ChatThreadSchema,
      })
      .from(ProjectSchema)
      .where(
        and(
          eq(ProjectSchema.id, id),
          eq(ProjectSchema.userId, userId),
          organizationId
            ? eq(ProjectSchema.organizationId, organizationId)
            : isNull(ProjectSchema.organizationId),
        ),
      )
      .leftJoin(
        ChatThreadSchema,
        eq(ProjectSchema.id, ChatThreadSchema.projectId),
      );
    const project = result[0] ? result[0].project : null;
    const threads = result.map((row) => row.thread!).filter(Boolean);
    if (!project) {
      return null;
    }
    return { ...(project as Project), threads };
  },

  selectProjectsByUserId: async (
    userId: string,
    organizationId: string | null,
  ): Promise<Omit<Project, "instructions">[]> => {
    const result = await db
      .select({
        id: ProjectSchema.id,
        name: ProjectSchema.name,
        createdAt: ProjectSchema.createdAt,
        updatedAt: ProjectSchema.updatedAt,
        userId: ProjectSchema.userId,
        lastThreadAt:
          sql<string>`COALESCE(MAX(${ChatThreadSchema.createdAt}), '1970-01-01')`.as(
            `last_thread_at`,
          ),
      })
      .from(ProjectSchema)
      .leftJoin(
        ChatThreadSchema,
        eq(ProjectSchema.id, ChatThreadSchema.projectId),
      )
      .where(
        and(
          eq(ProjectSchema.userId, userId),
          organizationId
            ? eq(ProjectSchema.organizationId, organizationId)
            : isNull(ProjectSchema.organizationId),
        ),
      )
      .groupBy(ProjectSchema.id)
      .orderBy(desc(sql`last_thread_at`), desc(ProjectSchema.createdAt));
    return result;
  },

  updateProject: async (
    id: string,
    project: Partial<Pick<Project, "name" | "instructions">>,
    userId: string,
    organizationId: string | null,
  ): Promise<Project> => {
    const [result] = await db
      .update(ProjectSchema)
      .set(project)
      .where(
        and(
          eq(ProjectSchema.id, id),
          eq(ProjectSchema.userId, userId),
          organizationId
            ? eq(ProjectSchema.organizationId, organizationId)
            : isNull(ProjectSchema.organizationId),
        ),
      )
      .returning();
    return result as Project;
  },

  deleteProject: async (
    id: string,
    userId: string,
    organizationId: string | null,
  ): Promise<void> => {
    // Verify project belongs to current user and organization context
    const projectCheck = await db
      .select({ id: ProjectSchema.id })
      .from(ProjectSchema)
      .where(
        and(
          eq(ProjectSchema.id, id),
          eq(ProjectSchema.userId, userId),
          organizationId
            ? eq(ProjectSchema.organizationId, organizationId)
            : isNull(ProjectSchema.organizationId),
        ),
      )
      .limit(1);

    if (!projectCheck.length) {
      throw new Error("Project not found or access denied");
    }

    const threadIds = await db
      .select({ id: ChatThreadSchema.id })
      .from(ChatThreadSchema)
      .where(eq(ChatThreadSchema.projectId, id));
    await Promise.all(
      threadIds.map((threadId) =>
        pgChatRepository.deleteThread(threadId.id, userId, organizationId),
      ),
    );

    await db.delete(ProjectSchema).where(eq(ProjectSchema.id, id));
  },

  insertMessages: async (
    messages: PartialBy<ChatMessage, "createdAt">[],
    userId: string,
    organizationId: string | null,
  ): Promise<ChatMessage[]> => {
    // For bulk operations, we assume they're for the same thread and verify once
    if (messages.length === 0) return [];

    const threadId = messages[0].threadId;

    // Verify thread belongs to current user and organization context
    const threadCheck = await db
      .select({ id: ChatThreadSchema.id })
      .from(ChatThreadSchema)
      .where(
        and(
          eq(ChatThreadSchema.id, threadId),
          eq(ChatThreadSchema.userId, userId),
          organizationId
            ? eq(ChatThreadSchema.organizationId, organizationId)
            : isNull(ChatThreadSchema.organizationId),
        ),
      )
      .limit(1);

    if (!threadCheck.length) {
      throw new Error("Thread not found or access denied");
    }

    const result = await db
      .insert(ChatMessageSchema)
      .values(messages)
      .returning();
    return result as ChatMessage[];
  },
};
