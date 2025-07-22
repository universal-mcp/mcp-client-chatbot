"use server";
import { z } from "zod";
import { Safe, safe } from "ts-safe";
import { errorToString, safeJSONParse } from "lib/utils";
import { McpServerSchema } from "lib/db/pg/schema.pg";
import {
  getSessionContext,
  checkAdminPermission,
} from "@/lib/auth/session-context";
import { mcpGateway } from "lib/ai/mcp/mcp-gateway";
import { pgProjectMcpConfigRepository } from "@/lib/db/pg/repositories/project-mcp-config-repository.pg";

export async function selectMcpClientsAction() {
  const { userId, organizationId } = await getSessionContext();
  const mcpClientsManager = await mcpGateway.getManager(userId, organizationId);
  const list = await mcpClientsManager.getClients();
  return list.map(({ client, id }) => {
    return {
      ...client.getInfo(),
      id,
    };
  });
}

export async function selectMcpClientAction(id: string) {
  const { userId, organizationId } = await getSessionContext();
  const mcpClientsManager = await mcpGateway.getManager(userId, organizationId);
  const client = await mcpClientsManager.getClient(id);
  if (!client) {
    throw new Error("Client not found");
  }
  const { config, ...info } = client.client.getInfo();
  return {
    ...info,
    id,
  };
}

export async function saveMcpClientAction(
  server: typeof McpServerSchema.$inferInsert,
) {
  if (process.env.NOT_ALLOW_ADD_MCP_SERVERS) {
    throw new Error("Not allowed to add MCP servers");
  }

  await checkAdminPermission();

  // Validate name to ensure it only contains alphanumeric characters and hyphens
  const nameSchema = z.string().regex(/^[a-zA-Z0-9\-]+$/, {
    message:
      "Name must contain only alphanumeric characters (A-Z, a-z, 0-9) and hyphens (-)",
  });

  const result = nameSchema.safeParse(server.name);
  if (!result.success) {
    throw new Error(
      "Name must contain only alphanumeric characters (A-Z, a-z, 0-9) and hyphens (-)",
    );
  }

  const { userId, organizationId } = await getSessionContext();
  const savedServer = await mcpGateway.saveServer(
    userId,
    organizationId,
    server,
  );

  return savedServer;
}

export async function existMcpClientByServerNameAction(serverName: string) {
  const { userId, organizationId } = await getSessionContext();
  const mcpClientsManager = await mcpGateway.getManager(userId, organizationId);
  const client = await mcpClientsManager.getClients().then((clients) => {
    return clients.find(
      (client) => client.client.getInfo().name === serverName,
    );
  });
  return !!client;
}

export async function isMcpServerInUseAction(mcpServerId: string) {
  return pgProjectMcpConfigRepository.isMcpServerInUse(mcpServerId);
}

export async function getProjectsUsingMcpServerAction(mcpServerId: string) {
  return pgProjectMcpConfigRepository.getProjectsUsingMcpServer(mcpServerId);
}

export async function removeMcpClientAction(id: string) {
  await checkAdminPermission();

  const { userId, organizationId } = await getSessionContext();
  await mcpGateway.deleteServer(userId, organizationId, id);
}

export async function refreshMcpClientAction(id: string) {
  await checkAdminPermission();

  const { userId, organizationId } = await getSessionContext();
  await mcpGateway.refreshServer(userId, organizationId, id);
}

function safeCallToolResult(chain: Safe<any>) {
  return chain
    .map((res) => {
      if (res?.content && Array.isArray(res.content)) {
        const parsedResult = {
          ...res,
          content: res.content.map((c) => {
            if (c?.type === "text" && c?.text) {
              const parsed = safeJSONParse(c.text);
              return {
                type: "text",
                text: parsed.success ? parsed.value : c.text,
              };
            }
            return c;
          }),
        };
        return parsedResult;
      }

      return res;
    })
    .ifFail((err) => {
      return {
        isError: true,
        error: {
          message: errorToString(err),
          name: err?.name || "ERROR",
        },
        content: [],
      };
    })
    .unwrap();
}

export async function callMcpToolAction(
  id: string,
  toolName: string,
  input?: unknown,
) {
  const chain = safe(async () => {
    const { userId, organizationId } = await getSessionContext();
    const mcpClientsManager = await mcpGateway.getManager(
      userId,
      organizationId,
    );
    const client = await mcpClientsManager.getClient(id);
    if (!client) {
      throw new Error("Client not found");
    }
    return client.client.callTool(toolName, input).then((res) => {
      if (res?.isError) {
        throw new Error(
          res.content?.[0]?.text ??
            JSON.stringify(res.content, null, 2) ??
            "Unknown error",
        );
      }
      return res;
    });
  });
  return safeCallToolResult(chain);
}

export async function callMcpToolByServerNameAction(
  serverName: string,
  toolName: string,
  input?: unknown,
) {
  const chain = safe(async () => {
    const { userId, organizationId } = await getSessionContext();
    const mcpClientsManager = await mcpGateway.getManager(
      userId,
      organizationId,
    );
    const client = await mcpClientsManager.getClients().then((clients) => {
      return clients.find(
        (client) => client.client.getInfo().name === serverName,
      );
    });
    if (!client) {
      throw new Error("Client not found");
    }
    return client.client.callTool(toolName, input);
  });
  return safeCallToolResult(chain);
}
