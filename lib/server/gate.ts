import "server-only";
import { planFor } from "../billing/plans";
import type { Store } from "../data/store";

export class PaymentRequiredError extends Error {
  status = 402 as const;
  constructor(message = "WeStor Pro is required for this action.") {
    super(message);
  }
}

/** Call at the top of every Pro route handler and server action. */
export async function requirePro(store: Store, orgId: string): Promise<void> {
  const sub = await store.getSubscription(orgId);
  if (!planFor(sub).features.liveUnderwriting) throw new PaymentRequiredError();
}

export async function isPro(store: Store, orgId: string): Promise<boolean> {
  return planFor(await store.getSubscription(orgId)).features.liveUnderwriting;
}

/** Simple durable rate limit for AI routes: N calls per org per hour, counted from usage_events. */
export async function rateLimitAi(store: Store, orgId: string, perHour = 30): Promise<void> {
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const n = await store.countUsageSince(orgId, since);
  if (n >= perHour) {
    const err = new Error("Too many AI requests this hour. Try again shortly.") as Error & { status: number };
    err.status = 429;
    throw err;
  }
}
