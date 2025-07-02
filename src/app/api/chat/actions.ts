"use server";

import {
  generateObject,
  generateText,
  jsonSchema,
  LanguageModel,
  type Message,
} from "ai";

import {
  CREATE_THREAD_TITLE_PROMPT,
  generateExampleToolSchemaPrompt,
} from "lib/ai/prompts";

import type { ChatModel, ChatThread, Project } from "app-types/chat";

import {
  chatRepository,
  mcpMcpToolCustomizationRepository,
  mcpServerCustomizationRepository,
} from "lib/db/repository";
import { customModelProvider } from "lib/ai/models";
import { toAny } from "lib/utils";
import { McpServerCustomizationsPrompt, MCPToolInfo } from "app-types/mcp";
import { serverCache } from "lib/cache";
import { CacheKeys } from "lib/cache/cache-keys";
import { getSessionContext } from "@/lib/auth/session-context";
import logger from "logger";
import { redirect } from "next/navigation";

export async function getUserId() {
  const { userId } = await getSessionContext();
  return userId;
}

export async function generateTitleFromUserMessageAction({
  message,
  model,
}: { message: Message; model: LanguageModel }) {
  await getSessionContext();
  const prompt = toAny(message.parts?.at(-1))?.text || "unknown";

  const { text: title } = await generateText({
    model,
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

export async function deleteThreadsAction() {
  const { userId, organizationId } = await getSessionContext();
  await chatRepository.deleteAllThreads(userId, organizationId);
}

export async function generateExampleToolSchemaAction(options: {
  model?: ChatModel;
  toolInfo: MCPToolInfo;
  prompt?: string;
}) {
  const model = customModelProvider.getModel(options.model);

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

export async function insertProjectAction({
  name,
  instructions,
}: {
  name: string;
  instructions?: Project["instructions"];
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
  return project;
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

export async function rememberMcpServerCustomizationsAction(userId: string) {
  const key = CacheKeys.mcpServerCustomizations(userId);

  const cachedMcpServerCustomizations =
    await serverCache.get<Record<string, McpServerCustomizationsPrompt>>(key);
  if (cachedMcpServerCustomizations) {
    return cachedMcpServerCustomizations;
  }

  const { organizationId } = await getSessionContext();
  const mcpServerCustomizations =
    await mcpServerCustomizationRepository.selectByUserId(
      userId,
      organizationId,
    );
  const mcpToolCustomizations =
    await mcpMcpToolCustomizationRepository.selectByUserId(
      userId,
      organizationId,
    );

  const serverIds: string[] = [
    ...mcpServerCustomizations.map(
      (mcpServerCustomization) => mcpServerCustomization.mcpServerId,
    ),
    ...mcpToolCustomizations.map(
      (mcpToolCustomization) => mcpToolCustomization.mcpServerId,
    ),
  ];

  const prompts = Array.from(new Set(serverIds)).reduce(
    (acc, serverId) => {
      const sc = mcpServerCustomizations.find((v) => v.mcpServerId == serverId);
      const tc = mcpToolCustomizations.filter(
        (mcpToolCustomization) => mcpToolCustomization.mcpServerId === serverId,
      );
      const data: McpServerCustomizationsPrompt = {
        name: sc?.serverName || tc[0]?.serverName || "",
        id: serverId,
        prompt: sc?.prompt || "",
        tools: tc.reduce(
          (acc, v) => {
            acc[v.toolName] = v.prompt || "";
            return acc;
          },
          {} as Record<string, string>,
        ),
      };
      acc[serverId] = data;
      return acc;
    },
    {} as Record<string, McpServerCustomizationsPrompt>,
  );

  serverCache.set(key, prompts, 1000 * 60 * 30); // 30 minutes
  return prompts;
}
