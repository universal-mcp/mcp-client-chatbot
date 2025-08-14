import { NextRequest, NextResponse } from "next/server";
import { stripeApp } from "@/lib/billing";
import { getSession } from "@/lib/auth/server";
import { getSessionContext } from "auth/session-context";

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId, organizationId } = await getSessionContext();
  const referenceId = organizationId ?? userId;
  const subs = await stripeApp.listSubscriptions(referenceId);
  return NextResponse.json(subs);
}
