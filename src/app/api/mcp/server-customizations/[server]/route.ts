import { McpServerCustomizationZodSchema } from "app-types/mcp";
import { getSessionContext } from "@/lib/auth/session-context";
import { serverCache } from "lib/cache";
import { CacheKeys } from "lib/cache/cache-keys";
import { mcpServerCustomizationRepository } from "lib/db/repository";

import { NextResponse } from "next/server";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ server: string }> },
) {
  const { server } = await params;
  const { userId, organizationId } = await getSessionContext();

  const mcpServerCustomization =
    await mcpServerCustomizationRepository.selectByUserIdAndMcpServerId(
      {
        mcpServerId: server,
        userId,
      },
      organizationId,
    );

  return NextResponse.json(mcpServerCustomization ?? {});
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ server: string }> },
) {
  const { server } = await params;
  const { userId, organizationId } = await getSessionContext();

  const body = await request.json();
  const { mcpServerId, prompt } = McpServerCustomizationZodSchema.parse({
    ...body,
    mcpServerId: server,
  });

  const result =
    await mcpServerCustomizationRepository.upsertMcpServerCustomization(
      {
        userId,
        mcpServerId,
        prompt,
      },
      organizationId,
    );
  const key = CacheKeys.mcpServerCustomizations(userId);
  void serverCache.delete(key);

  return NextResponse.json(result);
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ server: string }> },
) {
  const { server } = await params;
  const { userId, organizationId } = await getSessionContext();

  await mcpServerCustomizationRepository.deleteMcpServerCustomizationByMcpServerIdAndUserId(
    {
      mcpServerId: server,
      userId,
    },
    organizationId,
  );
  const key = CacheKeys.mcpServerCustomizations(userId);
  void serverCache.delete(key);

  return NextResponse.json({ success: true });
}
