import {
  appendResponseMessages,
  createDataStreamResponse,
  smoothStream,
  streamText,
  type UIMessage,
  formatDataStreamPart,
  appendClientMessage,
  Message,
  Tool,
} from "ai";

import { customModelProvider } from "lib/ai/models";

import { mcpGateway } from "lib/ai/mcp/mcp-gateway";

import { chatRepository } from "lib/db/repository";
import logger from "logger";
import {
  // buildContextServerPrompt,
  buildProjectInstructionsSystemPrompt,
  buildUserSystemPrompt,
} from "lib/ai/prompts";
import { chatApiSchemaRequestBodySchema } from "app-types/chat";

import { errorIf, safe } from "ts-safe";

import {
  appendAnnotations,
  excludeMcpToolExecution,
  handleError,
  manualToolExecuteByLastMessage,
  mergeSystemPrompt,
  convertToMessage,
  extractInProgressToolPart,
  assignToolResult,
  isUserMessage,
  filterToolsByAllowedMCPServers,
  filterToolsByProjectConfig,
  applyProjectToolModes,
} from "./helper";
import { getSessionContext } from "auth/session-context";
import { getProjectMcpToolsAction } from "../mcp/project-config/actions";
import { APP_DEFAULT_TOOL_KIT } from "lib/ai/tools/tool-kit";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { userId, organizationId, user } = await getSessionContext();

    const {
      id,
      message,
      toolChoice,
      allowedMcpServers,
      allowedAppDefaultToolkit,
      projectId,
      llmModel,
    } = chatApiSchemaRequestBodySchema.parse(json);

    const model = customModelProvider.getModel(llmModel);

    let thread = await chatRepository.selectThreadDetails(
      id,
      userId,
      organizationId,
    );

    if (!thread) {
      const newThread = await chatRepository.insertThread(
        {
          id,
          projectId: projectId,
          title: "",
          userId,
          isPublic: false,
        },
        userId,
        organizationId,
      );
      thread = await chatRepository.selectThreadDetails(
        newThread.id,
        userId,
        organizationId,
      );
    }

    if (thread!.userId !== userId) {
      return new Response("Forbidden", { status: 403 });
    }

    // if is false, it means the last message is manual tool execution
    const isLastMessageUserMessage = isUserMessage(message);

    const previousMessages = (thread?.messages ?? []).map(convertToMessage);

    const messages: Message[] = isLastMessageUserMessage
      ? appendClientMessage({
          messages: previousMessages,
          message,
        })
      : previousMessages;

    const manager = await mcpGateway.getManager(userId, organizationId);
    const mcpTools = manager.tools();
    const mcpServers = await manager.getClients();

    // Get project-specific MCP configurations
    const projectMcpConfig = projectId
      ? await (async () => {
          const toolConfigsData = await getProjectMcpToolsAction(projectId);
          const toolConfigMap = new Map(
            toolConfigsData.map((c) => [`${c.mcpServerId}:${c.toolName}`, c]),
          );
          const enabledServerIds = new Set(
            toolConfigsData.map((c) => c.mcpServerId),
          );

          return {
            servers: mcpServers.map((server) => ({
              id: server.id,
              name: server.client.getInfo().name,
              enabled: enabledServerIds.has(server.id),
            })),
            tools: toolConfigMap,
          };
        })()
      : undefined;

    const inProgressToolStep = extractInProgressToolPart(messages.slice(-2));

    const isToolCallAllowed = toolChoice != "none";

    return createDataStreamResponse({
      execute: async (dataStream) => {
        const tools = safe(mcpTools)
          .map(errorIf(() => !isToolCallAllowed && "Not allowed"))
          .map((tools) => {
            // First apply project config filters if in project context
            let filteredTools = tools;

            if (projectMcpConfig) {
              // In project context: only use project-specific server/tool filtering
              filteredTools = filterToolsByProjectConfig(
                filteredTools,
                projectMcpConfig,
              );
            } else {
              // Outside project context: use global allowedMcpServers setting
              filteredTools = filterToolsByAllowedMCPServers(
                filteredTools,
                allowedMcpServers,
              );
            }

            return filteredTools;
          })
          .orElse({});

        const APP_DEFAULT_TOOLS = safe(APP_DEFAULT_TOOL_KIT)
          .map(errorIf(() => !isToolCallAllowed && "Not allowed"))
          .map((tools) => {
            return (
              allowedAppDefaultToolkit?.reduce(
                (acc, key) => {
                  return { ...acc, ...tools[key] };
                },
                {} as Record<string, Tool>,
              ) || {}
            );
          })
          .orElse({});

        if (inProgressToolStep) {
          const toolResult = await manualToolExecuteByLastMessage(
            inProgressToolStep,
            message,
            { ...mcpTools, ...APP_DEFAULT_TOOLS },
            request.signal,
          );
          assignToolResult(inProgressToolStep, toolResult);
          dataStream.write(
            formatDataStreamPart("tool_result", {
              toolCallId: inProgressToolStep.toolInvocation.toolCallId,
              result: toolResult,
            }),
          );
        }

        const userPreferences = thread?.userPreferences || undefined;

        const systemPrompt = mergeSystemPrompt(
          buildUserSystemPrompt(user, userPreferences),
          buildProjectInstructionsSystemPrompt(thread?.instructions),
          // buildContextServerPrompt(),
        );

        const vercelAITools = safe(tools)
          .map((t) => {
            if (!t) return undefined;

            let processedTools = t;

            if (projectMcpConfig) {
              // Step 1: In project context - ONLY use project-specific tool modes
              // Ignore global toolChoice setting entirely
              processedTools = applyProjectToolModes(
                processedTools,
                projectMcpConfig,
              );
            } else {
              // Step 2: Outside project context - use global tool choice setting
              // If global setting is "manual", ALL tools become manual
              if (toolChoice === "manual") {
                processedTools = excludeMcpToolExecution(t);
              }
            }

            const finalTools = {
              ...processedTools,
              ...APP_DEFAULT_TOOLS,
            };

            return finalTools;
          })
          .unwrap();

        const result = streamText({
          model,
          system: systemPrompt,
          messages,
          maxSteps: 40,
          experimental_transform: smoothStream({ chunking: "word" }),
          maxRetries: 3,
          tools: vercelAITools,
          toolChoice: "auto",
          onFinish: async ({ response, usage }) => {
            const appendMessages = appendResponseMessages({
              messages: messages.slice(-1),
              responseMessages: response.messages,
            });
            if (isLastMessageUserMessage) {
              await chatRepository.upsertMessage(
                {
                  threadId: id,
                  model: null,
                  role: "user",
                  parts: message.parts,
                  attachments: message.experimental_attachments,
                  id: message.id,
                  annotations: appendAnnotations(message.annotations, {
                    usageTokens: usage.promptTokens,
                  }),
                },
                userId,
                organizationId,
              );
            }
            const assistantMessage = appendMessages.at(-1);
            if (assistantMessage) {
              const annotations = appendAnnotations(
                assistantMessage.annotations,
                {
                  usageTokens: usage.completionTokens,
                  toolChoice,
                },
              );
              dataStream.writeMessageAnnotation(annotations.at(-1)!);
              await chatRepository.upsertMessage(
                {
                  model: null,
                  threadId: id,
                  role: assistantMessage.role,
                  id: assistantMessage.id,
                  parts: assistantMessage.parts as UIMessage["parts"],
                  attachments: assistantMessage.experimental_attachments,
                  annotations,
                },
                userId,
                organizationId,
              );
            }
          },
        });
        result.consumeStream();
        result.mergeIntoDataStream(dataStream, {
          sendReasoning: true,
        });
      },
      onError: handleError,
    });
  } catch (error: any) {
    logger.error(error);
    return new Response(error.message, { status: 500 });
  }
}
