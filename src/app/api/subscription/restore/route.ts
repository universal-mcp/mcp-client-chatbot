import { NextRequest, NextResponse } from "next/server";
import { stripeApp } from "@/lib/billing";
import { pgDb as db } from "@/lib/db/pg/db.pg";
import { subscription as SubscriptionTable } from "@/lib/db/pg/auth.pg";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const referenceId = body?.referenceId as string | undefined;
  const subscriptionId = body?.subscriptionId as string | undefined;
  if (!referenceId && !subscriptionId) {
    return NextResponse.json(
      { error: "referenceId or subscriptionId is required" },
      { status: 400 },
    );
  }
  const [sub] = subscriptionId
    ? await db
        .select()
        .from(SubscriptionTable)
        .where(eq(SubscriptionTable.id, subscriptionId))
        .limit(1)
    : await db
        .select()
        .from(SubscriptionTable)
        .where(eq(SubscriptionTable.referenceId, referenceId!))
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
      res.data.find((s) => s.status === "active" || s.status === "trialing"),
    );
  if (!active) {
    return NextResponse.json(
      { error: "Active subscription not found" },
      { status: 404 },
    );
  }
  const updated = await stripeApp.client.subscriptions.update(active.id, {
    cancel_at_period_end: false,
  });
  await db
    .update(SubscriptionTable)
    .set({ cancelAtPeriodEnd: false })
    .where(eq(SubscriptionTable.id, sub.id));
  return NextResponse.json(updated);
}
