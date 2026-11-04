import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;
export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return (client ??= new Stripe(key));
}

export function proPriceId(): string {
  const id = process.env.STRIPE_PRICE_PRO_MONTHLY;
  if (!id) throw new Error("STRIPE_PRICE_PRO_MONTHLY is not set");
  return id;
}
