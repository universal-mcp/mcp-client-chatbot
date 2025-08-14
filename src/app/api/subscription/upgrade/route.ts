import { NextRequest, NextResponse } from "next/server";
import { stripeApp } from "@/lib/billing";
import { getSession } from "@/lib/auth/server";
import { getSessionContext } from "auth/session-context";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ctx = await getSessionContext();

  const {
    plan,
    referenceId,
    isWorkspace,
    seats,
    annual,
    successUrl = "/",
    cancelUrl = "/",
    disableRedirect,
    subscriptionId,
    metadata,
  } = body || {};

  if (!plan || !referenceId) {
    return NextResponse.json(
      { error: "plan and referenceId are required" },
      { status: 400 },
    );
  }

  // Authorize the referenceId: must match personal user or active organization
  const authorized = referenceId === (ctx.organizationId ?? ctx.userId);
  if (!authorized) {
    return NextResponse.json(
      { error: "Unauthorized referenceId" },
      { status: 403 },
    );
  }

  const checkout = await stripeApp.upgradeSubscription({
    plan,
    referenceId,
    isWorkspace: Boolean(isWorkspace),
    seats,
    annual,
    successUrl,
    cancelUrl,
    disableRedirect,
    subscriptionId,
    metadata,
  });

  return NextResponse.json(checkout);
}
