import { StripePlanDef } from "./stripe";

export const STRIPE_PLANS: StripePlanDef[] = [
  { name: "pro", priceId: process.env.STRIPE_PRICE_PRO, creditsPerCycle: 1000 },
  {
    name: "plus",
    priceId: process.env.STRIPE_PRICE_PLUS,
    creditsPerCycle: 16000,
  },
  {
    name: "max",
    priceId: process.env.STRIPE_PRICE_MAX,
    creditsPerCycle: 80000,
  },
];
