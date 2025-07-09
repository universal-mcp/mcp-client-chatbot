"use server";
import { z } from "zod";
import { Safe, safe } from "ts-safe";
import { errorToString } from "lib/utils";
import { McpServerSchema } from "lib/db/pg/schema.pg";
import {
  getSessionContext,
  checkAdminPermission,
} from "@/lib/auth/session-context";
import { globalMCPManager } from "lib/ai/mcp/global-mcp-manager";

export async function selectMcpClientsAction() {
  const { userId, organizationId } = await getSessionContext();
  const mcpClientsManager = await globalMCPManager.getManager(
    userId,
    organizationId,
  );
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
  const mcpClientsManager = await globalMCPManager.getManager(
    userId,
    organizationId,
  );
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
  const savedServer = await globalMCPManager.saveServer(
    userId,
    organizationId,
    server,
  );

  return savedServer;
}

export async function existMcpClientByServerNameAction(serverName: string) {
  const { userId, organizationId } = await getSessionContext();
  const mcpClientsManager = await globalMCPManager.getManager(
    userId,
    organizationId,
  );
  const client = await mcpClientsManager.getClients().then((clients) => {
    return clients.find(
      (client) => client.client.getInfo().name === serverName,
    );
  });
  return !!client;
}

export async function removeMcpClientAction(id: string) {
  await checkAdminPermission();

  const { userId, organizationId } = await getSessionContext();
  await globalMCPManager.deleteServer(userId, organizationId, id);
}

export async function refreshMcpClientAction(id: string) {
  await checkAdminPermission();

  const { userId, organizationId } = await getSessionContext();
  await globalMCPManager.refreshServer(userId, organizationId, id);
}

function safeCallToolResult(chain: Safe<any>) {
  return chain
    .ifFail((err) => {
      console.error(err);
      return {
        isError: true,
        content: [
          JSON.stringify({
            error: { message: errorToString(err), name: err?.name },
          }),
        ],
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
    const mcpClientsManager = await globalMCPManager.getManager(
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
    const mcpClientsManager = await globalMCPManager.getManager(
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
