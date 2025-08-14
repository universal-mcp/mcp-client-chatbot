import Stripe from "stripe";
import { createStripeWrapper } from "./stripe";
import { STRIPE_PLANS } from "./config";

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
});

export const stripeApp = createStripeWrapper({
  client: stripeClient,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  plans: STRIPE_PLANS,
});
