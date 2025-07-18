import {
  appendResponseMessages,
  createDataStreamResponse,
  smoothStream,
  streamText,
  type UIMessage,
  formatDataStreamPart,
  appendClientMessage,
  Message,
} from "ai";

import { customModelProvider, isToolCallUnsupportedModel } from "lib/ai/models";

import { mcpGateway } from "lib/ai/mcp/mcp-gateway";

import { chatRepository } from "lib/db/repository";
import logger from "logger";
import {
  // buildContextServerPrompt,
  buildProjectInstructionsSystemPrompt,
  buildUserSystemPrompt,
} from "lib/ai/prompts";
import {
  chatApiSchemaRequestBodySchema,
  ChatMention,
  ChatMessageAnnotation,
} from "app-types/chat";

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
import { generateTitleFromUserMessageAction } from "./actions";
import { getSessionContext } from "auth/session-context";
import { getProjectMcpToolsAction } from "../mcp/project-config/actions";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { userId, organizationId, user } = await getSessionContext();

    const { id, message, toolChoice, allowedMcpServers, projectId } =
      chatApiSchemaRequestBodySchema.parse(json);

    const model = customModelProvider.getModel(undefined);

    const thread = await chatRepository.selectThreadDetails(
      id,
      userId,
      organizationId,
    );

    if (thread && thread.userId !== userId) {
      return new Response("Forbidden", { status: 403 });
    }

    const isNewThread = !thread;

    // if is false, it means the last message is manual tool execution
    const isLastMessageUserMessage = isUserMessage(message);

    const previousMessages = (thread?.messages ?? []).map(convertToMessage);

    const annotations = (message?.annotations as ChatMessageAnnotation[]) ?? [];

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

    // Get project instructions and user preferences in a single query
    const { instructions: projectInstructions, userPreferences } =
      await chatRepository.getProjectInstructionsAndUserPreferences(
        userId,
        projectId,
        organizationId,
      );

    const mentions = annotations
      .flatMap((annotation) => annotation.mentions)
      .filter(Boolean) as ChatMention[];

    const isToolCallAllowed =
      (!isToolCallUnsupportedModel(model) && toolChoice != "none") ||
      mentions.length > 0;

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
      .orElse(undefined);

    const messages: Message[] = isLastMessageUserMessage
      ? appendClientMessage({
          messages: previousMessages,
          message,
        })
      : previousMessages;

    return createDataStreamResponse({
      execute: async (dataStream) => {
        const inProgressToolStep = extractInProgressToolPart(
          messages.slice(-2),
        );

        if (inProgressToolStep) {
          const toolResult = await manualToolExecuteByLastMessage(
            inProgressToolStep,
            message,
            mcpTools,
          );
          assignToolResult(inProgressToolStep, toolResult);
          dataStream.write(
            formatDataStreamPart("tool_result", {
              toolCallId: inProgressToolStep.toolInvocation.toolCallId,
              result: toolResult,
            }),
          );
        }

        const systemPrompt = mergeSystemPrompt(
          buildUserSystemPrompt(user, userPreferences),
          buildProjectInstructionsSystemPrompt(projectInstructions),
          // buildContextServerPrompt(),
        );

        // Precompute toolChoice to avoid repeated tool calls
        const computedToolChoice =
          isToolCallAllowed && mentions.length > 0 && inProgressToolStep
            ? "required"
            : "auto";

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
            };

            return finalTools;
          })
          .unwrap();

        const result = streamText({
          model,
          system: systemPrompt,
          messages,
          maxSteps: 10,
          experimental_continueSteps: true,
          experimental_transform: smoothStream({ chunking: "word" }),
          maxRetries: 0,
          tools: vercelAITools,
          toolChoice: computedToolChoice,
          onFinish: async ({ response, usage }) => {
            if (isNewThread) {
              const title = await generateTitleFromUserMessageAction({
                message,
              });
              await chatRepository.insertThread(
                {
                  id,
                  projectId: projectId,
                  title,
                  userId,
                  isPublic: false,
                },
                userId,
                organizationId,
              );
            }
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
