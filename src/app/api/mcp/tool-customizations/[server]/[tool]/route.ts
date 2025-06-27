import { McpToolCustomizationZodSchema } from "app-types/mcp";
import { getSessionContext } from "@/lib/auth/session-context";
import { serverCache } from "lib/cache";
import { CacheKeys } from "lib/cache/cache-keys";
import { mcpMcpToolCustomizationRepository } from "lib/db/repository";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ server: string; tool: string }> },
) {
  const { server, tool } = await params;
  const { userId, organizationId } = await getSessionContext();

  const result = await mcpMcpToolCustomizationRepository.select(
    {
      mcpServerId: server,
      userId,
      toolName: tool,
    },
    organizationId,
  );
  return Response.json(result ?? {});
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ server: string; tool: string }> },
) {
  const { server, tool } = await params;
  const { userId, organizationId } = await getSessionContext();

  const body = await request.json();

  const { mcpServerId, toolName, prompt } = McpToolCustomizationZodSchema.parse(
    {
      ...body,
      mcpServerId: server,
      toolName: tool,
    },
  );

  const result =
    await mcpMcpToolCustomizationRepository.upsertToolCustomization(
      {
        userId,
        mcpServerId,
        toolName,
        prompt,
      },
      organizationId,
    );
  const key = CacheKeys.mcpServerCustomizations(userId);
  void serverCache.delete(key);

  return Response.json(result);
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ server: string; tool: string }> },
) {
  const { server, tool } = await params;
  const { userId, organizationId } = await getSessionContext();

  await mcpMcpToolCustomizationRepository.deleteToolCustomization(
    {
      mcpServerId: server,
      userId,
      toolName: tool,
    },
    organizationId,
  );
  const key = CacheKeys.mcpServerCustomizations(userId);
  void serverCache.delete(key);

  return Response.json({ success: true });
}
