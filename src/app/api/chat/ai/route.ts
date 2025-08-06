import { streamObject } from "ai";

import { customModelProvider } from "lib/ai/models";
import {
  buildAssistantGenerationPrompt,
  buildAssistantGenerationFromThreadPrompt,
} from "lib/ai/prompts";
import globalLogger from "logger";

import { colorize } from "consola/utils";
import { AssistantGenerateSchema } from "app-types/chat";
import { z } from "zod";
import { loadAppDefaultTools } from "../helper";
import { safe } from "ts-safe";
import { objectFlow } from "lib/utils";
import { mcpGateway } from "lib/ai/mcp/mcp-gateway";
import { getSessionContext } from "auth/session-context";
import { selectThreadWithMessagesAction } from "../actions";
import { convertToCoreMessages } from "ai";

const logger = globalLogger.withDefaults({
  message: colorize("blackBright", `Agent Generate API: `),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();

    const { message = "hello", threadId } = json as {
      message: string;
      threadId?: string;
    };

    const { userId, organizationId, user } = await getSessionContext();
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const toolNames = new Set<string>();

    await safe(loadAppDefaultTools)
      .ifOk((appTools) => {
        objectFlow(appTools).forEach((_, toolName) => {
          toolNames.add(toolName);
        });
      })
      .unwrap();

    const manager = await mcpGateway.getManager(userId, organizationId);
    const mcpTools = manager.tools();

    await safe(mcpTools)
      .ifOk((tools) => {
        objectFlow(tools).forEach((mcp) => {
          toolNames.add(mcp._originToolName);
        });
      })
      .unwrap();

    const dynamicAssistantSchema = AssistantGenerateSchema.extend({
      tools: z
        .array(
          z.enum(
            Array.from(toolNames).length > 0
              ? ([
                  Array.from(toolNames)[0],
                  ...Array.from(toolNames).slice(1),
                ] as [string, ...string[]])
              : ([""] as [string]),
          ),
        )
        .describe("Assistant allowed tools name")
        .optional()
        .default([]),
    });

    let system: string;
    let prompt: string;

    if (threadId) {
      // Generate assistant from thread history
      const thread = await selectThreadWithMessagesAction(threadId);

      if (!thread) {
        return new Response("Thread not found", { status: 404 });
      }

      // Check if user owns this thread
      if (thread.userId !== userId) {
        return new Response("Unauthorized", { status: 401 });
      }

      const messages = convertToCoreMessages(
        thread.messages.map((v) => ({
          content: "",
          role: v.role,
          parts: v.parts,
        })),
      );

      system = buildAssistantGenerationFromThreadPrompt(Array.from(toolNames));

      // Build prompt with conversation history and user's additional requirements
      prompt = `Generate an assistant based on this conversation history:\n\n${JSON.stringify(messages, null, 2)}`;

      // If user provided additional requirements, include them
      if (message && message.trim() !== "") {
        prompt += `\n\nAdditional requirements from user: ${message}`;
      }
    } else {
      // Generate assistant from user description
      system = buildAssistantGenerationPrompt(Array.from(toolNames));
      prompt = message;
    }
    const result = streamObject({
      model: customModelProvider.getModel(),
      system,
      prompt,
      schema: dynamicAssistantSchema,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    logger.error(error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
