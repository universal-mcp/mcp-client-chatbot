import { NextRequest } from "next/server";
import { pgDb as db } from "@/lib/db/pg/db.pg";
import { subscription as SubscriptionTable } from "@/lib/db/pg/auth.pg";
import { stripeApp } from "@/lib/billing";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const callbackURL = url.searchParams.get("callbackURL") || "/";
  const subscriptionId = url.searchParams.get("subscriptionId");

  if (!subscriptionId) {
    return Response.redirect(callbackURL);
  }

  const [sub] = await db
    .select()
    .from(SubscriptionTable)
    .where(eq(SubscriptionTable.id, subscriptionId))
    .limit(1);

  if (!sub || !sub.stripeCustomerId) {
    return Response.redirect(callbackURL);
  }

  try {
    const stripeSubs = await stripeApp.client.subscriptions.list({
      customer: sub.stripeCustomerId,
      status: "active",
      limit: 1,
    });
    const stripeSub = stripeSubs.data[0] as any;
    if (stripeSub) {
      const item = stripeSub.items?.data?.[0] as any;
      const priceId = item?.plan?.id as string | undefined;
      const plan = priceId
        ? await stripeApp.getPlanByPriceId(priceId)
        : undefined;
      const periodEndSec =
        item?.current_period_end ?? stripeSub?.current_period_end;
      const periodStartSec =
        item?.current_period_start ?? stripeSub?.current_period_start;
      await db
        .update(SubscriptionTable)
        .set({
          status: stripeSub.status,
          seats: item?.quantity || 1,
          plan: plan?.name?.toLowerCase() || sub.plan,
          periodEnd: periodEndSec ? new Date(periodEndSec * 1000) : null,
          periodStart: periodStartSec ? new Date(periodStartSec * 1000) : null,
          stripeSubscriptionId: stripeSub.id,
        })
        .where(eq(SubscriptionTable.id, sub.id));
    }
  } catch (_e) {
    // swallow; UI will still redirect
  }

  return Response.redirect(callbackURL);
}
