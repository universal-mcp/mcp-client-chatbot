import { NextRequest, NextResponse } from "next/server";
import { stripeApp } from "@/lib/billing";
import Stripe from "stripe";
import logger from "@/lib/logger";
import { handleStripeEvent } from "@/lib/billing/stripe-webhooks";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const buf = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripeApp.client.webhooks.constructEventAsync(
      buf,
      signature,
      stripeApp.webhookSecret,
    );
  } catch (err: any) {
    logger.error(err, "Stripe webhook signature verification failed");
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 },
    );
  }

  try {
    logger.info(`Stripe webhook event: ${event.type}`);
    await handleStripeEvent(event);
  } catch (e) {
    logger.error(e, "Failed processing Stripe event");
    return NextResponse.json({ success: false }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
