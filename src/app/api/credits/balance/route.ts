import { pgCreditRepository } from "@/lib/db/pg/repositories/credit-repository.pg";
import { NextResponse } from "next/server";
import { getSessionContext } from "auth/session-context";

export async function GET() {
  const { userId, organizationId } = await getSessionContext();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = organizationId ?? userId;

  try {
    const balance = await pgCreditRepository.getBalance(workspaceId);
    return NextResponse.json({ balance });
  } catch (error) {
    console.error("Failed to fetch credit balance:", error);
    return NextResponse.json(
      { error: "Failed to fetch credit balance" },
      { status: 500 },
    );
  }
}
