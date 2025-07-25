import { NextRequest } from "next/server";
import { getSessionContext } from "@/lib/auth/session-context";
import { AllowedMCPServer, VercelAIMcpTool } from "app-types/mcp";
import { chatRepository } from "lib/db/repository";
import {
  filterToolsByAllowedMCPServers,
  filterToolsByProjectConfig,
  mergeSystemPrompt,
} from "../helper";
import {
  buildProjectInstructionsSystemPrompt,
  buildSpeechSystemPrompt,
} from "lib/ai/prompts";
import { errorIf, safe } from "ts-safe";
import { mcpGateway } from "lib/ai/mcp/mcp-gateway";
import { getProjectMcpToolsAction } from "../../mcp/project-config/actions";

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY is not set" }),
        {
          status: 500,
        },
      );
    }

    const { userId, organizationId, user } = await getSessionContext();

    const { voice, allowedMcpServers, toolChoice, threadId, projectId } =
      (await request.json()) as {
        model: string;
        voice: string;
        allowedMcpServers: Record<string, AllowedMCPServer>;
        toolChoice: "auto" | "none" | "manual";
        projectId?: string;
        threadId?: string;
      };

    const mcpClientsManager = await mcpGateway.getManager(
      userId,
      organizationId,
    );
    const mcpTools = mcpClientsManager.tools();
    const mcpServers = await mcpClientsManager.getClients();

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

    const tools = safe(mcpTools)
      .map(errorIf(() => toolChoice === "none" && "Not allowed"))
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

    const { instructions, userPreferences } = projectId
      ? await chatRepository.selectThreadInstructionsByProjectId(
          userId,
          projectId,
          organizationId,
        )
      : await chatRepository.selectThreadInstructions(
          userId,
          threadId ?? null,
          organizationId,
        );

    const openAITools = Object.entries(tools ?? {}).map(([name, tool]) => {
      return vercelAIToolToOpenAITool(tool as VercelAIMcpTool, name);
    });

    const systemPrompt = mergeSystemPrompt(
      buildSpeechSystemPrompt(user, userPreferences),
      buildProjectInstructionsSystemPrompt(instructions),
    );

    const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        model: "gpt-4o-realtime-preview",
        voice: voice || "alloy",
        input_audio_transcription: {
          model: "whisper-1",
        },
        instructions: systemPrompt,
        tools: [...openAITools],
      }),
    });

    return new Response(r.body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}

function vercelAIToolToOpenAITool(tool: VercelAIMcpTool, name: string) {
  return {
    name,
    type: "function",
    description: tool.description,
    parameters: tool.parameters?.jsonSchema ?? {
      type: "object",
      properties: {},
      required: [],
    },
  };
}
