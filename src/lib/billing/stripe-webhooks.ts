import Stripe from "stripe";
import { pgDb as db } from "@/lib/db/pg/db.pg";
import { CreditLedgerSchema } from "@/lib/db/pg/schema.pg";
import { eq, or } from "drizzle-orm";
import logger from "@/lib/logger";
import { subscription as SubscriptionTable } from "@/lib/db/pg/auth.pg";
import { stripeApp } from "./index";
import { creditRepository } from "@/lib/db/repository";

// reuse repository implementation
const getBalance = (referenceId: string) =>
  creditRepository.getBalance(referenceId);

async function insertLedgerEntry(params: {
  referenceId?: string | null;
  userId?: string | null;
  change: number;
  description: string;
}) {
  const balanceBase = params.referenceId
    ? await getBalance(params.referenceId)
    : 0;
  const newBalance = balanceBase + params.change;
  await db.insert(CreditLedgerSchema).values({
    referenceId: params.referenceId ?? null,
    userId: params.userId ?? null,
    change: params.change,
    balance: newBalance,
    description: params.description,
  });
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId = (session.subscription as string | null) ?? null;
        const localSubscriptionId =
          (session.metadata?.subscriptionId as string | undefined) || undefined;

        // Do not add credits here; credits are added in invoice.paid

        // Update local subscription row
        if (subscriptionId && localSubscriptionId) {
          try {
            const resp =
              await stripeApp.client.subscriptions.retrieve(subscriptionId);
            const remoteSub: any = (resp as any).data ?? resp;
            const item = remoteSub.items?.data?.[0];
            const priceId = item?.price?.id as string | undefined;
            const plan = priceId
              ? await stripeApp.getPlanByPriceId(priceId)
              : undefined;
            const trialFields =
              remoteSub.trial_start && remoteSub.trial_end
                ? {
                    trialStart: new Date(remoteSub.trial_start * 1000),
                    trialEnd: new Date(remoteSub.trial_end * 1000),
                  }
                : {};
            const rs = remoteSub as any;
            const updateData: any = {
              plan:
                (plan?.name || "").toLowerCase() ||
                (session.metadata?.plan as string | undefined) ||
                undefined,
              status: remoteSub.status as any,
              stripeSubscriptionId: remoteSub.id,
              seats: item?.quantity || 1,
              ...trialFields,
            };
            if (rs?.current_period_start) {
              updateData.periodStart = new Date(rs.current_period_start * 1000);
            }
            if (rs?.current_period_end) {
              updateData.periodEnd = new Date(rs.current_period_end * 1000);
            }
            await db
              .update(SubscriptionTable)
              .set(updateData)
              .where(eq(SubscriptionTable.id, localSubscriptionId));
          } catch (e) {
            logger.error(
              e,
              "Failed to update subscription on checkout completion",
            );
          }
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId =
          (((invoice as any) || {}).subscription as string | null) ?? null;
        const customerId =
          (((invoice as any) || {}).customer as string | null) ?? null;
        const invoiceId = invoice.id;

        // Only read the last line for the current period charge
        const line = invoice.lines.data.at(-1);
        const priceId = line?.pricing?.price_details?.price as
          | string
          | undefined;
        const plan = priceId
          ? await stripeApp.getPlanByPriceId(priceId)
          : undefined;
        const credits = plan?.creditsPerCycle ?? 0;
        if (!credits || credits <= 0) break;

        // Single lookup: map either subscriptionId or customerId to referenceId
        const [refRow] = await db
          .select({ referenceId: SubscriptionTable.referenceId })
          .from(SubscriptionTable)
          .where(
            subscriptionId
              ? or(
                  eq(SubscriptionTable.stripeSubscriptionId, subscriptionId),
                  eq(SubscriptionTable.stripeCustomerId, customerId as string),
                )
              : eq(SubscriptionTable.stripeCustomerId, customerId as string),
          )
          .limit(1);
        const resolvedReferenceId: string | null = refRow?.referenceId ?? null;

        // Expire previous credits at the start of each billing cycle
        if (resolvedReferenceId) {
          const currentBalance = await getBalance(resolvedReferenceId);
          if (currentBalance > 0) {
            await insertLedgerEntry({
              referenceId: resolvedReferenceId,
              change: -currentBalance,
              description: "Cycle reset: expired previous credits",
            });
          }
        }

        await insertLedgerEntry({
          referenceId: resolvedReferenceId,
          change: credits,
          description: `Invoice paid: ${invoiceId}`,
        });
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        const priceId = subscription.items?.data?.[0]?.price?.id as
          | string
          | undefined;
        const plan = priceId
          ? await stripeApp.getPlanByPriceId(priceId)
          : undefined;
        const seatQty = subscription.items?.data?.[0]?.quantity || 1;
        try {
          // Find local subscription by stripe sub id first, else by customer id
          let [local] = await db
            .select()
            .from(SubscriptionTable)
            .where(eq(SubscriptionTable.stripeSubscriptionId, subscription.id))
            .limit(1);
          if (!local && subscription.customer) {
            const custId = String(subscription.customer);
            [local] = await db
              .select()
              .from(SubscriptionTable)
              .where(eq(SubscriptionTable.stripeCustomerId, custId))
              .limit(1);
          }
          const targetId = local?.id as string | undefined;
          if (targetId) {
            const periodStart = (subscription as any)?.current_period_start;
            const periodEnd = (subscription as any)?.current_period_end;
            const updatePayload: any = {
              plan: plan?.name?.toLowerCase() || local.plan,
              status: subscription.status as any,
              cancelAtPeriodEnd: subscription.cancel_at_period_end || null,
              seats: seatQty,
            };
            if (periodStart) {
              updatePayload.periodStart = new Date(periodStart * 1000);
            }
            if (periodEnd) {
              updatePayload.periodEnd = new Date(periodEnd * 1000);
            }
            await db
              .update(SubscriptionTable)
              .set(updatePayload)
              .where(eq(SubscriptionTable.id, targetId));
          }
        } catch (e) {
          logger.error(e, "Failed to sync subscription on update event");
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        try {
          const [local] = await db
            .select()
            .from(SubscriptionTable)
            .where(eq(SubscriptionTable.stripeSubscriptionId, subscription.id))
            .limit(1);
          if (local) {
            await db
              .update(SubscriptionTable)
              .set({ status: "canceled" as any })
              .where(eq(SubscriptionTable.id, local.id));
          }
        } catch (e) {
          logger.error(e, "Failed to sync subscription on delete event");
        }
        break;
      }
    }
  } catch (error) {
    // If unique violation due to eventId, ignore; otherwise log
    const message = (error as Error)?.message || String(error);
    if (message.includes("duplicate key value") || message.includes("unique")) {
      logger.warn(`Duplicate event insert ignored for ${event.id}`);
      return;
    }
    logger.error(error, `Failed processing Stripe event ${event.id}`);
    throw error;
  }
}
