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
  buildMcpServerCustomizationsSystemPrompt,
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
  filterToolsByMentions,
  handleError,
  manualToolExecuteByLastMessage,
  mergeSystemPrompt,
  convertToMessage,
  extractInProgressToolPart,
  assignToolResult,
  isUserMessage,
  getAllowedDefaultToolkit,
  filterToolsByAllowedMCPServers,
  filterMcpServerCustomizations,
  filterToolsByProjectConfig,
  applyProjectToolModes,
} from "./helper";
import {
  generateTitleFromUserMessageAction,
  rememberMcpServerCustomizationsAction,
} from "./actions";
import { getSessionContext } from "auth/session-context";
import { getProjectMcpConfigAction } from "../mcp/project-config/actions";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { userId, organizationId, user } = await getSessionContext();

    const {
      id,
      message,
      chatModel,
      toolChoice,
      allowedAppDefaultToolkit,
      allowedMcpServers,
      projectId,
    } = chatApiSchemaRequestBodySchema.parse(json);

    const model = customModelProvider.getModel(chatModel);

    let thread = await chatRepository.selectThreadDetails(
      id,
      userId,
      organizationId,
    );

    if (!thread) {
      const title = await generateTitleFromUserMessageAction({
        message,
      });
      const newThread = await chatRepository.insertThread(
        {
          id,
          projectId: projectId ?? null,
          title,
          userId,
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

    if (!thread) {
      return new Response("Thread not found", { status: 404 });
    }

    const annotations = (message?.annotations as ChatMessageAnnotation[]) ?? [];

    const manager = await mcpGateway.getManager(userId, organizationId);
    const mcpTools = manager.tools();

    // Get project-specific MCP configurations
    const projectMcpConfig = projectId
      ? await getProjectMcpConfigAction(projectId)
      : undefined;

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

        // Handle mentions in both contexts (mentions can exist everywhere)
        if (mentions.length) {
          return filterToolsByMentions(filteredTools, mentions);
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

        const userPreferences = thread?.userPreferences || undefined;

        const mcpServerCustomizations = await safe()
          .map(() => {
            if (Object.keys(tools ?? {}).length === 0)
              throw new Error("No tools found");
            return rememberMcpServerCustomizationsAction(userId);
          })
          .map((v) => filterMcpServerCustomizations(tools!, v))
          .orElse({});

        const systemPrompt = mergeSystemPrompt(
          buildUserSystemPrompt(user, userPreferences),
          buildProjectInstructionsSystemPrompt(thread?.instructions),
          buildMcpServerCustomizationsSystemPrompt(mcpServerCustomizations),
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
              ...getAllowedDefaultToolkit(allowedAppDefaultToolkit),
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
            const appendMessages = appendResponseMessages({
              messages: messages.slice(-1),
              responseMessages: response.messages,
            });
            if (isLastMessageUserMessage) {
              await chatRepository.insertMessage(
                {
                  threadId: thread!.id,
                  model: chatModel?.model ?? null,
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
                  model: chatModel?.model ?? null,
                  threadId: thread!.id,
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
