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

import { and, desc, eq, gte, isNull, sql, inArray } from "drizzle-orm";
import { pgUserRepository } from "./user-repository.pg";
import { UserPreferences } from "app-types/user";
import { pgProjectMcpConfigRepository } from "./project-mcp-config-repository.pg";

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
    const threadOwnerSubquery = db
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

    await db
      .delete(ChatMessageSchema)
      .where(
        and(
          eq(ChatMessageSchema.id, id),
          inArray(ChatMessageSchema.threadId, threadOwnerSubquery),
        ),
      );
  },

  getPublicThread: async (id: string): Promise<ChatThread | null> => {
    const [result] = await db
      .select()
      .from(ChatThreadSchema)
      .where(
        and(eq(ChatThreadSchema.id, id), eq(ChatThreadSchema.isPublic, true)),
      );
    return result;
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
      id: thread.id,
      title: thread.title,
      userId: thread.userId,
      createdAt: thread.createdAt,
      projectId: thread.projectId,
      isPublic: thread.isPublic,
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
    _userId: string,
    _organizationId: string | null,
  ): Promise<ChatMessage[]> => {
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
        isPublic: ChatThreadSchema.isPublic,
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
        isPublic: row.isPublic,
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
        isPublic: thread.isPublic,
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
    await db
      .delete(ChatThreadSchema)
      .where(
        and(
          eq(ChatThreadSchema.id, id),
          eq(ChatThreadSchema.userId, userId),
          organizationId
            ? eq(ChatThreadSchema.organizationId, organizationId)
            : isNull(ChatThreadSchema.organizationId),
        ),
      );
  },

  insertMessage: async (
    message: Omit<ChatMessage, "createdAt">,
    _userId: string,
    _organizationId: string | null,
  ): Promise<ChatMessage> => {
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
    _userId: string,
    _organizationId: string | null,
  ): Promise<ChatMessage> => {
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
        lastMessageAt: sql<string>`MAX(${ChatMessageSchema.createdAt})`.as(
          "last_message_at",
        ),
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
      )
      .leftJoin(
        ChatMessageSchema,
        eq(ChatThreadSchema.id, ChatMessageSchema.threadId),
      )
      .groupBy(ProjectSchema.id, ChatThreadSchema.id)
      .orderBy(desc(sql`last_message_at`), desc(ChatThreadSchema.createdAt));
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
    const threadIds = await db
      .select({ id: ChatThreadSchema.id })
      .from(ChatThreadSchema)
      .where(eq(ChatThreadSchema.projectId, id));
    await Promise.all(
      threadIds.map((threadId) =>
        pgChatRepository.deleteThread(threadId.id, userId, organizationId),
      ),
    );

    await db
      .delete(ProjectSchema)
      .where(
        and(
          eq(ProjectSchema.id, id),
          eq(ProjectSchema.userId, userId),
          organizationId
            ? eq(ProjectSchema.organizationId, organizationId)
            : isNull(ProjectSchema.organizationId),
        ),
      );
  },

  insertMessages: async (
    messages: PartialBy<ChatMessage, "createdAt">[],
    _userId: string,
    _organizationId: string | null,
  ): Promise<ChatMessage[]> => {
    // For bulk operations, we assume they're for the same thread and verify once
    if (messages.length === 0) return [];

    const result = await db
      .insert(ChatMessageSchema)
      .values(messages)
      .returning();
    return result as ChatMessage[];
  },

  getProjectInstructionsAndUserPreferences: async (
    userId: string,
    projectId: string | null,
    organizationId: string | null,
  ): Promise<{
    instructions: Project["instructions"] | null;
    userPreferences: UserPreferences | undefined;
  }> => {
    const joinConditions = [
      eq(ProjectSchema.id, projectId!),
      eq(ProjectSchema.userId, userId),
      organizationId
        ? eq(ProjectSchema.organizationId, organizationId)
        : isNull(ProjectSchema.organizationId),
    ];

    const [result] = await db
      .select({
        userPreferences: UserSchema.preferences,
        projectInstructions: ProjectSchema.instructions,
      })
      .from(UserSchema)
      .leftJoin(ProjectSchema, projectId ? and(...joinConditions) : sql`false`)
      .where(eq(UserSchema.id, userId))
      .limit(1);

    if (!result) {
      throw new Error("User not found");
    }

    return {
      instructions: result.projectInstructions ?? null,
      userPreferences: result.userPreferences ?? undefined,
    };
  },
};
