import { NextRequest, NextResponse } from "next/server";
import { stripeApp } from "@/lib/billing";
import { getSessionContext } from "auth/session-context";
import { pgDb as db } from "@/lib/db/pg/db.pg";
import { subscription as SubscriptionTable } from "@/lib/db/pg/auth.pg";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const referenceId = body?.referenceId as string | undefined;
  const returnUrl = body?.returnUrl as string | undefined;
  if (!referenceId || !returnUrl) {
    return NextResponse.json(
      { error: "referenceId and returnUrl are required" },
      { status: 400 },
    );
  }

  const ctx = await getSessionContext();
  if (referenceId !== (ctx.organizationId ?? ctx.userId)) {
    return NextResponse.json(
      { error: "Unauthorized referenceId" },
      { status: 403 },
    );
  }

  const [sub] = await db
    .select()
    .from(SubscriptionTable)
    .where(eq(SubscriptionTable.referenceId, referenceId))
    .limit(1);
  if (!sub || !sub.stripeCustomerId) {
    return NextResponse.json(
      { error: "Subscription not found" },
      { status: 404 },
    );
  }

  const active = await stripeApp.client.subscriptions
    .list({ customer: sub.stripeCustomerId })
    .then((res) =>
      res.data.filter((s) => s.status === "active" || s.status === "trialing"),
    );
  const stripeSub =
    active.find((s) => s.id === sub.stripeSubscriptionId) || active[0];
  if (!stripeSub) {
    return NextResponse.json(
      { error: "Active subscription not found" },
      { status: 404 },
    );
  }

  const { url } = await stripeApp.client.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/subscription/cancel/callback?callbackURL=${encodeURIComponent(
      returnUrl,
    )}&subscriptionId=${encodeURIComponent(sub.id)}`,
    flow_data: {
      type: "subscription_cancel",
      subscription_cancel: { subscription: stripeSub.id },
    },
  });

  return NextResponse.json({ url, redirect: true });
}
