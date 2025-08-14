import Stripe from "stripe";
import { pgDb as db } from "@/lib/db/pg/db.pg";
import {
  subscription as SubscriptionTable,
  user as UserTable,
  organization as OrgTable,
} from "@/lib/db/pg/auth.pg";
import { eq } from "drizzle-orm";

export type StripePlanDef = {
  name: string;
  priceId?: string;
  lookupKey?: string;
  annualDiscountPriceId?: string;
  annualDiscountLookupKey?: string;
  limits?: Record<string, number>;
  freeTrial?: { days: number };
  creditsPerCycle?: number;
};

export type StripeWrapperOptions = {
  client: Stripe;
  webhookSecret: string;
  plans: StripePlanDef[] | (() => Promise<StripePlanDef[]>);
};

export function createStripeWrapper(options: StripeWrapperOptions) {
  const client = options.client;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  async function getPlans(): Promise<StripePlanDef[]> {
    return typeof options.plans === "function"
      ? await options.plans()
      : options.plans;
  }

  async function resolvePlanByName(
    name: string,
  ): Promise<StripePlanDef | undefined> {
    const plans = await getPlans();
    return plans.find((p) => p.name.toLowerCase() === name.toLowerCase());
  }

  async function resolvePriceId(
    plan: StripePlanDef,
    annual?: boolean,
  ): Promise<string | undefined> {
    if (annual) {
      if (plan.annualDiscountPriceId) return plan.annualDiscountPriceId;
      if (plan.annualDiscountLookupKey) {
        const prices = await client.prices.list({
          lookup_keys: [plan.annualDiscountLookupKey],
          active: true,
          limit: 1,
        });
        return prices.data[0]?.id;
      }
      return undefined;
    }
    if (plan.priceId) return plan.priceId;
    if (plan.lookupKey) {
      const prices = await client.prices.list({
        lookup_keys: [plan.lookupKey],
        active: true,
        limit: 1,
      });
      return prices.data[0]?.id;
    }
    return undefined;
  }

  async function getPlanByPriceId(
    priceId: string,
  ): Promise<StripePlanDef | undefined> {
    const plans = await getPlans();
    return plans.find(
      (p) => p.priceId === priceId || p.annualDiscountPriceId === priceId,
    );
  }

  async function ensureStripeCustomerForReference(params: {
    referenceId: string; // workspace id or user id when personal
    isWorkspace: boolean;
  }): Promise<string> {
    if (params.isWorkspace) {
      const [org] = await db
        .select()
        .from(OrgTable)
        .where(eq(OrgTable.id, params.referenceId))
        .limit(1);
      if (org?.stripeCustomerId) return org.stripeCustomerId as string;
      const customer = await client.customers.create({
        metadata: { organizationId: params.referenceId },
      });
      await db
        .update(OrgTable)
        .set({ stripeCustomerId: customer.id })
        .where(eq(OrgTable.id, params.referenceId));
      return customer.id;
    } else {
      const [usr] = await db
        .select()
        .from(UserTable)
        .where(eq(UserTable.id, params.referenceId))
        .limit(1);
      if (usr?.stripeCustomerId) return usr.stripeCustomerId as string;
      const customer = await client.customers.create({
        metadata: { userId: params.referenceId },
        email: (usr as any)?.email,
        name: (usr as any)?.name,
      });
      await db
        .update(UserTable)
        .set({ stripeCustomerId: customer.id })
        .where(eq(UserTable.id, params.referenceId));
      return customer.id;
    }
  }

  return {
    client,
    webhookSecret: options.webhookSecret,
    getPlanByPriceId,
    async ensureCustomerId(
      referenceId: string,
      isWorkspace: boolean,
    ): Promise<string> {
      return ensureStripeCustomerForReference({ referenceId, isWorkspace });
    },
    async upgradeSubscription(args: {
      plan: string;
      referenceId: string;
      isWorkspace: boolean;
      seats?: number;
      annual?: boolean;
      successUrl: string;
      cancelUrl: string;
      disableRedirect?: boolean;
      subscriptionId?: string;
      metadata?: Record<string, any>;
    }) {
      const plan = await resolvePlanByName(args.plan);
      if (!plan) throw new Error("Subscription plan not found");
      const priceId = await resolvePriceId(plan, args.annual);
      if (!priceId) throw new Error("Unable to resolve price id for plan");

      const customerId = await ensureStripeCustomerForReference({
        referenceId: args.referenceId,
        isWorkspace: args.isWorkspace,
      });

      // create or reuse local subscription row
      const [existingSub] = await db
        .select()
        .from(SubscriptionTable)
        .where(eq(SubscriptionTable.referenceId, args.referenceId))
        .limit(1);

      let subscriptionId = existingSub?.id as string | undefined;
      if (!subscriptionId) {
        const inserted = await db
          .insert(SubscriptionTable)
          .values({
            plan: plan.name.toLowerCase(),
            stripeCustomerId: customerId,
            status: "incomplete",
            referenceId: args.referenceId,
            seats: args.seats || 1,
          })
          .returning({ id: SubscriptionTable.id });
        subscriptionId = inserted[0].id as string;
      }

      // If there is an active subscription, use billing portal update confirm
      const activeSubscription = await client.subscriptions
        .list({ customer: customerId, status: "active" })
        .then((res) =>
          res.data.find(
            (s) =>
              s.id === existingSub?.stripeSubscriptionId ||
              s.id === args.subscriptionId,
          ),
        )
        .catch(() => undefined);

      if (activeSubscription) {
        const firstItem = activeSubscription.items.data[0];
        const { url } = await client.billingPortal.sessions.create({
          customer: customerId,
          return_url: `${baseUrl}/api/subscription/success?callbackURL=${encodeURIComponent(
            args.successUrl,
          )}&subscriptionId=${encodeURIComponent(subscriptionId)}`,
          flow_data: {
            type: "subscription_update_confirm",
            subscription_update_confirm: {
              subscription: activeSubscription.id,
              items: [
                {
                  id: firstItem.id,
                  quantity: args.seats || 1,
                  price: priceId,
                },
              ],
            },
          },
        });
        return { url, redirect: true };
      }

      // Otherwise, create a checkout session for a new subscription
      const checkout = await client.checkout.sessions.create({
        customer: customerId,
        success_url: `${baseUrl}/api/subscription/success?callbackURL=${encodeURIComponent(
          args.successUrl,
        )}&subscriptionId=${encodeURIComponent(subscriptionId)}`,
        cancel_url: args.cancelUrl,
        line_items: [{ price: priceId, quantity: args.seats || 1 }],
        subscription_data: plan.freeTrial
          ? { trial_period_days: plan.freeTrial.days }
          : undefined,
        mode: "subscription",
        client_reference_id: args.referenceId,
        metadata: {
          referenceId: args.referenceId,
          subscriptionId,
          isWorkspace: String(args.isWorkspace),
          ...(args.metadata || {}),
        },
      });

      return { ...checkout, redirect: !(args.disableRedirect ?? false) };
    },

    async listSubscriptions(referenceId: string) {
      const rows = await db
        .select()
        .from(SubscriptionTable)
        .where(eq(SubscriptionTable.referenceId, referenceId));
      const plans = await getPlans();
      return rows
        .map((r: any) => {
          const p = plans.find(
            (pl) => pl.name.toLowerCase() === (r.plan || "").toLowerCase(),
          );
          return { ...r, limits: p?.limits };
        })
        .filter((r) => r.status === "active" || r.status === "trialing");
    },
  };
}
