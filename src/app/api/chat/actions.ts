"use server";

import { generateObject, generateText, jsonSchema, type Message } from "ai";

import {
  CREATE_THREAD_TITLE_PROMPT,
  generateExampleToolSchemaPrompt,
} from "lib/ai/prompts";

import type { ChatModel, ChatThread, Project } from "app-types/chat";

import { chatRepository } from "lib/db/repository";
import { customModelProvider } from "lib/ai/models";
import { toAny } from "lib/utils";
import { MCPToolInfo } from "app-types/mcp";
import { serverCache } from "lib/cache";
import { CacheKeys } from "lib/cache/cache-keys";
import { getSessionContext } from "@/lib/auth/session-context";
import logger from "logger";
import { redirect } from "next/navigation";
import { initializeProjectMcpConfigAction } from "@/app/api/mcp/project-config/actions";
import { pgChatRepository } from "@/lib/db/pg/repositories/chat-repository.pg";
import type { ProjectMcpToolConfig } from "app-types/chat";

export async function getUserId() {
  const { userId } = await getSessionContext();
  return userId;
}

export async function generateTitleFromUserMessageAction({
  message,
}: { message: Message }) {
  await getSessionContext();
  const prompt = toAny(message.parts?.at(-1))?.text || "unknown";
  const model = customModelProvider.getTitleModel();
  const { text: title } = await generateText({
    model: model,
    system: CREATE_THREAD_TITLE_PROMPT,
    prompt,
    maxTokens: 30,
  });

  return title.trim();
}

export async function selectThreadWithMessagesAction(threadId: string) {
  const { userId, organizationId } = await getSessionContext();
  const thread = await chatRepository.selectThread(
    threadId,
    userId,
    organizationId,
  );

  if (!thread) {
    logger.error("Thread not found", threadId);
    return redirect("/");
  }
  if (thread.userId !== userId) {
    return redirect("/");
  }
  const messages = await chatRepository.selectMessagesByThreadId(
    threadId,
    userId,
    organizationId,
  );
  return { ...thread, messages: messages ?? [] };
}

export async function getPublicThreadAction(threadId: string) {
  const thread = await chatRepository.getPublicThread(threadId);

  if (!thread) {
    return null;
  }

  const messages = await chatRepository.selectMessagesByThreadId(
    threadId,
    "public",
    null,
  );

  return {
    ...thread,
    messages: messages ?? [],
    isOwner: false,
  };
}

export async function deleteMessageAction(messageId: string) {
  const { userId, organizationId } = await getSessionContext();
  await chatRepository.deleteChatMessage(messageId, userId, organizationId);
}

export async function deleteThreadAction(threadId: string) {
  const { userId, organizationId } = await getSessionContext();
  await chatRepository.deleteThread(threadId, userId, organizationId);
}

export async function deleteMessagesByChatIdAfterTimestampAction(
  messageId: string,
) {
  "use server";
  const { userId, organizationId } = await getSessionContext();
  await chatRepository.deleteMessagesByChatIdAfterTimestamp(
    messageId,
    userId,
    organizationId,
  );
}

export async function selectThreadListByUserIdAction() {
  const { userId, organizationId } = await getSessionContext();
  const threads = await chatRepository.selectThreadsByUserId(
    userId,
    organizationId,
  );
  return threads;
}
export async function selectMessagesByThreadIdAction(threadId: string) {
  const { userId, organizationId } = await getSessionContext();
  const messages = await chatRepository.selectMessagesByThreadId(
    threadId,
    userId,
    organizationId,
  );
  return messages;
}

export async function updateThreadAction(
  id: string,
  thread: Partial<Omit<ChatThread, "createdAt" | "updatedAt" | "userId">>,
) {
  const { userId, organizationId } = await getSessionContext();
  await chatRepository.updateThread(id, thread, userId, organizationId);
}

export async function updateThreadVisibilityAction(
  id: string,
  isPublic: boolean,
) {
  const { userId, organizationId } = await getSessionContext();
  await chatRepository.updateThread(id, { isPublic }, userId, organizationId);
}

export async function deleteThreadsAction() {
  const { userId, organizationId } = await getSessionContext();
  await chatRepository.deleteAllThreads(userId, organizationId);
}

export async function generateExampleToolSchemaAction(options: {
  model?: ChatModel;
  toolInfo: MCPToolInfo;
  prompt?: string;
}) {
  const model = customModelProvider.getModel(undefined);

  const schema = jsonSchema(
    toAny({
      ...options.toolInfo.inputSchema,
      properties: options.toolInfo.inputSchema?.properties ?? {},
      additionalProperties: false,
    }),
  );
  const { object } = await generateObject({
    model,
    schema,
    prompt: generateExampleToolSchemaPrompt({
      toolInfo: options.toolInfo,
      prompt: options.prompt,
    }),
  });

  return object;
}

export async function selectProjectListByUserIdAction() {
  const { userId, organizationId } = await getSessionContext();
  const projects = await chatRepository.selectProjectsByUserId(
    userId,
    organizationId,
  );
  return projects;
}

export async function insertProjectAction(project: {
  name: string;
  instructions?: Project["instructions"];
  mcpConfig?: {
    tools: ProjectMcpToolConfig[];
  };
}) {
  const { userId, organizationId } = await getSessionContext();

  const newProject = await pgChatRepository.insertProject(
    {
      name: project.name,
      instructions: project.instructions ?? { systemPrompt: "" },
      userId,
    },
    userId,
    organizationId,
    project.mcpConfig,
  );

  return newProject;
}

export async function insertProjectWithThreadAction({
  name,
  instructions,
  threadId,
}: {
  name: string;
  instructions?: Project["instructions"];
  threadId: string;
}) {
  const { userId, organizationId } = await getSessionContext();
  const project = await chatRepository.insertProject(
    {
      name,
      userId,
      instructions: instructions ?? {
        systemPrompt: "",
      },
    },
    userId,
    organizationId,
  );

  // Initialize MCP configurations for the new project
  await initializeProjectMcpConfigAction(project.id);

  await chatRepository.updateThread(
    threadId,
    {
      projectId: project.id,
    },
    userId,
    organizationId,
  );
  await serverCache.delete(CacheKeys.thread(threadId));
  return project;
}

export async function selectProjectByIdAction(id: string) {
  const { userId, organizationId } = await getSessionContext();
  const project = await chatRepository.selectProjectById(
    id,
    userId,
    organizationId,
  );
  return project;
}

export async function updateProjectAction(
  id: string,
  project: Partial<Pick<Project, "name" | "instructions">>,
) {
  const { userId, organizationId } = await getSessionContext();
  const updatedProject = await chatRepository.updateProject(
    id,
    project,
    userId,
    organizationId,
  );
  await serverCache.delete(CacheKeys.project(id));
  return updatedProject;
}

export async function deleteProjectAction(id: string) {
  const { userId, organizationId } = await getSessionContext();
  await serverCache.delete(CacheKeys.project(id));
  await chatRepository.deleteProject(id, userId, organizationId);
}

export async function rememberProjectInstructionsAction(
  projectId: string,
): Promise<Project["instructions"] | null> {
  const { userId, organizationId } = await getSessionContext();
  const key = CacheKeys.project(projectId);
  const cachedProject = await serverCache.get<Project>(key);
  if (cachedProject) {
    return cachedProject.instructions;
  }
  const project = await chatRepository.selectProjectById(
    projectId,
    userId,
    organizationId,
  );
  if (!project) {
    return null;
  }
  await serverCache.set(key, project);
  return project.instructions;
}

export async function rememberThreadAction(threadId: string) {
  const { userId, organizationId } = await getSessionContext();
  const key = CacheKeys.thread(threadId);
  const cachedThread = await serverCache.get<ChatThread>(key);
  if (cachedThread) {
    return cachedThread;
  }
  const thread = await chatRepository.selectThread(
    threadId,
    userId,
    organizationId,
  );
  if (!thread) {
    return null;
  }
  await serverCache.set(key, thread);
  return thread;
}

export async function updateProjectNameAction(id: string, name: string) {
  const { userId, organizationId } = await getSessionContext();
  const updatedProject = await chatRepository.updateProject(
    id,
    { name },
    userId,
    organizationId,
  );
  await serverCache.delete(CacheKeys.project(id));
  return updatedProject;
}
