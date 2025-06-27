import { getSessionContext } from "@/lib/auth/session-context";
import { mcpMcpToolCustomizationRepository } from "lib/db/repository";

import { NextResponse } from "next/server";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ server: string }> },
) {
  const { server } = await params;
  const { userId, organizationId } = await getSessionContext();

  const mcpServerCustomization =
    await mcpMcpToolCustomizationRepository.selectByUserIdAndMcpServerId(
      {
        mcpServerId: server,
        userId,
      },
      organizationId,
    );

  return NextResponse.json(mcpServerCustomization);
}
