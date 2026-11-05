import "server-only";
import Stripe from "stripe";
import { PLANS, type PaidPlan } from "./plans";

let client: Stripe | null = null;
export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return (client ??= new Stripe(key));
}

/** Stripe price ID for a paid tier. Investor falls back to the legacy single-tier price. */
export function priceIdFor(plan: PaidPlan): string {
  const key = PLANS[plan].stripePriceEnv!;
  const id = process.env[key] || (plan === "investor" ? process.env.STRIPE_PRICE_PRO_MONTHLY : undefined);
  if (!id) throw new Error(`${key} is not set`);
  return id;
}
