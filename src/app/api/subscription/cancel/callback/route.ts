import { NextRequest } from "next/server";
import { stripeApp } from "@/lib/billing";
import { pgDb as db } from "@/lib/db/pg/db.pg";
import { subscription as SubscriptionTable } from "@/lib/db/pg/auth.pg";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const callbackURL = url.searchParams.get("callbackURL") || "/";
  const subscriptionId = url.searchParams.get("subscriptionId");

  if (!subscriptionId) {
    return Response.redirect(callbackURL);
  }

  try {
    const [sub] = await db
      .select()
      .from(SubscriptionTable)
      .where(eq(SubscriptionTable.id, subscriptionId))
      .limit(1);
    if (!sub || !sub.stripeCustomerId) return Response.redirect(callbackURL);
    const active = await stripeApp.client.subscriptions
      .list({ customer: sub.stripeCustomerId, status: "active" })
      .then((res) => res.data.find((s) => s.id === sub.stripeSubscriptionId));
    if (active?.cancel_at_period_end === true) {
      await db
        .update(SubscriptionTable)
        .set({ status: active.status, cancelAtPeriodEnd: true })
        .where(eq(SubscriptionTable.id, sub.id));
    }
  } catch {}

  return Response.redirect(callbackURL);
}
