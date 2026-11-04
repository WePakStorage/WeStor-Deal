import "server-only";
import type Stripe from "stripe";
import type { Store } from "../data/store";
import type { Plan } from "../types";

/** Map a Stripe subscription onto our subscriptions row. The only writer of plan/status. */
export async function syncSubscription(store: Store, orgId: string, sub: Stripe.Subscription): Promise<void> {
  const proPrice = process.env.STRIPE_PRICE_PRO_MONTHLY;
  const item = sub.items.data[0];
  const plan: Plan = sub.status === "canceled" || !item ? "free" : item.price.id === proPrice ? "pro" : "pro";
  // current_period_end moved from the subscription to its items in newer API versions.
  const periodEnd = (item as unknown as { current_period_end?: number } | undefined)?.current_period_end
    ?? (sub as unknown as { current_period_end?: number }).current_period_end;
  await store.upsertSubscription({
    org_id: orgId,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    plan,
    status: sub.status,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
  });
}
