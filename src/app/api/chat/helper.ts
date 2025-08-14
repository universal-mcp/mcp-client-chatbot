import {
  LoadAPIKeyError,
  Message,
  Tool,
  ToolInvocation,
  tool as createTool,
} from "ai";
import {
  ChatMessage,
  ChatMessageAnnotation,
  ClientToolInvocationZodSchema,
  ToolInvocationUIPart,
} from "app-types/chat";
import { errorToString, objectFlow, toAny } from "lib/utils";
import { callMcpToolAction } from "../mcp/actions";
import { safe } from "ts-safe";
import logger from "logger";
import {
  AllowedMCPServer,
  McpServerCustomizationsPrompt,
  VercelAIMcpTool,
} from "app-types/mcp";
import { MANUAL_REJECT_RESPONSE_PROMPT } from "lib/ai/prompts";
import { APP_DEFAULT_TOOL_KIT } from "lib/ai/tools/tool-kit";
import { AppDefaultToolkit } from "lib/ai/tools";

export function filterToolsByAllowedMCPServers(
  tools: Record<string, VercelAIMcpTool>,
  allowedMcpServers?: Record<string, AllowedMCPServer>,
): Record<string, VercelAIMcpTool> {
  if (!allowedMcpServers) {
    return tools;
  }
  return objectFlow(tools).filter((_tool) => {
    if (!allowedMcpServers[_tool._mcpServerId]?.tools) return true;
    return allowedMcpServers[_tool._mcpServerId].tools.includes(
      _tool._originToolName,
    );
  });
}

export function filterToolsByProjectConfig(
  tools: Record<string, VercelAIMcpTool>,
  projectConfig?: {
    servers: Array<{ id: string; name: string; enabled: boolean }>;
    tools: Map<
      string,
      {
        mcpServerId: string;
        toolName: string;
        enabled: boolean;
        mode: "auto" | "manual";
      }
    >;
  },
): Record<string, VercelAIMcpTool> {
  if (!projectConfig) {
    return tools;
  }

  // Filter out tools from disabled servers
  const enabledServerIds = new Set(
    projectConfig.servers
      .filter((server) => server.enabled)
      .map((server) => server.id),
  );

  return objectFlow(tools).filter((_tool) => {
    // Check if server is enabled
    if (!enabledServerIds.has(_tool._mcpServerId)) {
      return false;
    }

    // Check if specific tool is enabled
    const toolConfigKey = `${_tool._mcpServerId}:${_tool._originToolName}`;
    const toolConfig = projectConfig.tools.get(toolConfigKey);

    // If no specific config exists, default to disabled
    return toolConfig?.enabled ?? false;
  });
}

export function applyProjectToolModes(
  tools: Record<string, VercelAIMcpTool>,
  projectConfig?: {
    servers: Array<{ id: string; name: string; enabled: boolean }>;
    tools: Map<
      string,
      {
        mcpServerId: string;
        toolName: string;
        enabled: boolean;
        mode: "auto" | "manual";
      }
    >;
  },
): Record<string, VercelAIMcpTool> {
  if (!projectConfig) {
    return tools;
  }

  console.log("🔧 Processing tools for modes:", Object.keys(tools));

  // Apply manual mode to individual tools based on their configuration
  return objectFlow(tools).map((_tool, _toolName) => {
    const toolConfigKey = `${_tool._mcpServerId}:${_tool._originToolName}`;
    const toolConfig = projectConfig.tools.get(toolConfigKey);

    console.log(`🔧 Tool ${_tool._originToolName}:`, {
      toolConfigKey,
      mode: toolConfig?.mode ?? "auto (default)",
      hasExecute: !!_tool.execute,
    });

    // If tool is configured as manual, remove its execute function
    if (toolConfig?.mode === "manual") {
      console.log(`🔧 Converting ${_tool._originToolName} to manual mode`);
      // Create a new tool without the execute function but preserve MCP metadata
      const manualTool = createTool({
        parameters: _tool.parameters,
        description: _tool.description,
      });

      // Preserve the MCP metadata
      const result = {
        ...manualTool,
        _mcpServerName: _tool._mcpServerName,
        _mcpServerId: _tool._mcpServerId,
        _originToolName: _tool._originToolName,
      } as VercelAIMcpTool;

      console.log(
        `🔧 Manual tool ${_tool._originToolName} hasExecute:`,
        !!result.execute,
      );
      return result;
    }

    console.log(
      `🔧 Keeping ${_tool._originToolName} in auto mode, hasExecute:`,
      !!_tool.execute,
    );
    return _tool;
  });
}

export function getProjectToolMode(
  toolName: string,
  mcpServerId: string,
  projectConfig?: {
    servers: Array<{ id: string; name: string; enabled: boolean }>;
    tools: Map<
      string,
      {
        mcpServerId: string;
        toolName: string;
        enabled: boolean;
        mode: "auto" | "manual";
      }
    >;
  },
): "auto" | "manual" {
  if (!projectConfig) {
    return "auto";
  }

  const toolConfigKey = `${mcpServerId}:${toolName}`;
  const toolConfig = projectConfig.tools.get(toolConfigKey);

  return toolConfig?.mode ?? "auto";
}

export function excludeToolExecution(
  tool: Record<string, Tool>,
): Record<string, Tool> {
  return objectFlow(tool).map((value) => {
    return createTool({
      parameters: value.parameters,
      description: value.description,
    });
  });
}

export function excludeMcpToolExecution(
  tools: Record<string, VercelAIMcpTool>,
): Record<string, VercelAIMcpTool> {
  return objectFlow(tools).map((_tool) => {
    const manualTool = createTool({
      parameters: _tool.parameters,
      description: _tool.description,
    });

    // Preserve the MCP metadata
    return {
      ...manualTool,
      _mcpServerName: _tool._mcpServerName,
      _mcpServerId: _tool._mcpServerId,
      _originToolName: _tool._originToolName,
    } as VercelAIMcpTool;
  });
}

export function appendAnnotations(
  annotations: any[] = [],
  annotationsToAppend: ChatMessageAnnotation[] | ChatMessageAnnotation,
): ChatMessageAnnotation[] {
  const newAnnotations = Array.isArray(annotationsToAppend)
    ? annotationsToAppend
    : [annotationsToAppend];
  return [...annotations, ...newAnnotations];
}

export function mergeSystemPrompt(...prompts: (string | undefined)[]): string {
  const filteredPrompts = prompts
    .map((prompt) => (prompt ? prompt.trim() : ""))
    .filter(Boolean);
  return filteredPrompts.join("\n\n");
}

export function manualToolExecuteByLastMessage(
  part: ToolInvocationUIPart,
  message: Message,
  tools: Record<string, VercelAIMcpTool | (Tool & { __$ref__?: string })>,
  abortSignal?: AbortSignal,
) {
  const { args, toolName } = part.toolInvocation;

  const manulConfirmation = (message.parts as ToolInvocationUIPart[]).find(
    (_part) => {
      return _part.toolInvocation?.toolCallId == part.toolInvocation.toolCallId;
    },
  )?.toolInvocation as Extract<ToolInvocation, { state: "result" }>;

  const tool = tools[toolName];

  if (!manulConfirmation?.result) return MANUAL_REJECT_RESPONSE_PROMPT;
  return safe(() => {
    if (!tool) throw new Error(`tool not found: ${toolName}`);
    return ClientToolInvocationZodSchema.parse(manulConfirmation?.result);
  })
    .map((result) => {
      const value = result?.result;

      if (result.action == "direct") {
        return value;
      } else if (result.action == "manual") {
        if (!value) return MANUAL_REJECT_RESPONSE_PROMPT;
        if ((tool as any).__$ref__ === "mcp") {
          const mcpTool = tool as VercelAIMcpTool;
          return callMcpToolAction(
            mcpTool._mcpServerId,
            mcpTool._originToolName,
            args,
          );
        }
        return tool.execute!(args, {
          toolCallId: part.toolInvocation.toolCallId,
          abortSignal: abortSignal ?? new AbortController().signal,
          messages: [],
        });
      }
      throw new Error("Invalid Client Tool Invocation Action " + result.action);
    })
    .ifFail((error) => ({
      isError: true,
      statusMessage: `tool call fail: ${toolName}`,
      error: errorToString(error),
    }))
    .unwrap();
}

export function handleError(error: any) {
  if (LoadAPIKeyError.isInstance(error)) {
    return error.message;
  }

  logger.error(error);
  logger.error(error.name);
  return errorToString(error.message);
}

// Credits & tokens conversion helpers
// Adjust the ratio as needed. By default, 1 credit = 10000 tokens (prompt + completion combined)
const TOKENS_PER_CREDIT = 10000;

export function convertTokensToCredits(totalTokensUsed: number): number {
  if (!Number.isFinite(totalTokensUsed) || totalTokensUsed <= 0) return 0;
  return Math.ceil(totalTokensUsed / TOKENS_PER_CREDIT);
}

export function estimateMaxCompletionTokensFromCredits(
  availableCredits: number,
  safetyRatio: number = 0.8,
): number {
  if (!Number.isFinite(availableCredits) || availableCredits <= 0) return 0;
  const budgetTokens = Math.floor(availableCredits * TOKENS_PER_CREDIT);
  // Keep room for prompt/tooling tokens and safety margin
  const tokens = Math.max(0, Math.floor(budgetTokens * safetyRatio));
  return Math.min(tokens, 64000);
}

export function convertToMessage(message: ChatMessage): Message {
  return {
    ...message,
    id: message.id,
    content: "",
    role: message.role,
    parts: message.parts,
    experimental_attachments:
      toAny(message).attachments || toAny(message).experimental_attachments,
  };
}

export function extractInProgressToolPart(
  messages: Message[],
): ToolInvocationUIPart | null {
  let result: ToolInvocationUIPart | null = null;

  for (const message of messages) {
    for (const part of message.parts || []) {
      if (part.type != "tool-invocation") continue;
      if (part.toolInvocation.state == "result") continue;
      result = part as ToolInvocationUIPart;
      return result;
    }
  }
  return null;
}
export function assignToolResult(toolPart: ToolInvocationUIPart, result: any) {
  return Object.assign(toolPart, {
    toolInvocation: {
      ...toolPart.toolInvocation,
      state: "result",
      result,
    },
  });
}

export function isUserMessage(message: Message): boolean {
  return message.role == "user";
}

export function filterMcpServerCustomizations(
  tools: Record<string, VercelAIMcpTool>,
  mcpServerCustomization: Record<string, McpServerCustomizationsPrompt>,
): Record<string, McpServerCustomizationsPrompt> {
  const toolNamesByServerId = Object.values(tools).reduce(
    (acc, tool) => {
      if (!acc[tool._mcpServerId]) acc[tool._mcpServerId] = [];
      acc[tool._mcpServerId].push(tool._originToolName);
      return acc;
    },
    {} as Record<string, string[]>,
  );

  return Object.entries(mcpServerCustomization).reduce(
    (acc, [serverId, mcpServerCustomization]) => {
      if (!(serverId in toolNamesByServerId)) return acc;

      if (
        !mcpServerCustomization.prompt &&
        !Object.keys(mcpServerCustomization.tools ?? {}).length
      )
        return acc;

      const prompts: McpServerCustomizationsPrompt = {
        id: serverId,
        name: mcpServerCustomization.name,
        prompt: mcpServerCustomization.prompt,
        tools: mcpServerCustomization.tools
          ? objectFlow(mcpServerCustomization.tools).filter((_, key) => {
              return toolNamesByServerId[serverId].includes(key as string);
            })
          : {},
      };

      acc[serverId] = prompts;

      return acc;
    },
    {} as Record<string, McpServerCustomizationsPrompt>,
  );
}

export async function createProjectMcpConfig(
  projectId: string | null | undefined,
  mcpServers: any[],
  getProjectMcpToolsAction: (projectId: string) => Promise<any[]>,
) {
  if (!projectId) {
    return undefined;
  }

  const toolConfigsData = await getProjectMcpToolsAction(projectId);

  // Separate default tools and MCP tools
  const defaultTools = toolConfigsData.filter((c) => c.mcpServerId === null);
  const mcpTools = toolConfigsData.filter((c) => c.mcpServerId !== null);

  // Get default tool names as strings
  const enabledDefaultTools = defaultTools.map((c) => c.toolName);

  const mcpToolMap = new Map(
    mcpTools.map((c) => [
      `${c.mcpServerId as string}:${c.toolName}`,
      {
        mcpServerId: c.mcpServerId as string,
        toolName: c.toolName,
        enabled: c.enabled,
        mode: c.mode,
      },
    ]),
  );

  // Get enabled server IDs (only for MCP tools)
  const enabledServerIds = new Set(
    mcpTools.map((c) => c.mcpServerId as string),
  );

  return {
    servers: mcpServers.map((server) => ({
      id: server.id,
      name: server.client.getInfo().name,
      enabled: enabledServerIds.has(server.id),
    })),
    tools: mcpToolMap,
    defaultTools: enabledDefaultTools,
  };
}

export function loadAppDefaultTools(
  projectConfig?: {
    defaultTools?: string[];
  },
  allowedAppDefaultToolkit?: string[],
): Record<string, Tool> {
  return safe(APP_DEFAULT_TOOL_KIT)
    .map((tools) => {
      if (projectConfig) {
        // In project context: filter default tools based on project configuration
        return (
          projectConfig.defaultTools?.reduce(
            (acc, key) => {
              return { ...acc, ...tools[key] };
            },
            {} as Record<string, Tool>,
          ) || {}
        );
      } else {
        // Outside project context: use global allowedAppDefaultToolkit setting
        if (!allowedAppDefaultToolkit) {
          allowedAppDefaultToolkit = Object.values(AppDefaultToolkit);
        }
        return (
          allowedAppDefaultToolkit?.reduce(
            (acc, key) => {
              return { ...acc, ...tools[key] };
            },
            {} as Record<string, Tool>,
          ) || {}
        );
      }
    })
    .ifFail((e) => {
      console.error(e);
      throw e;
    })
    .orElse({});
}
