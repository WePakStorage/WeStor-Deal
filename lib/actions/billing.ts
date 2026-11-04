"use server";

import { revalidatePath } from "next/cache";
import { env, isDemoMode, isStripeConfigured } from "../env";
import { proPriceId, stripe } from "../billing/stripe";
import { HttpError, run } from "../server/run";
import type { ActionResult } from "./result";

/** Start Stripe Checkout for WeStor Pro. Returns the hosted checkout URL. */
export async function startCheckout(): Promise<ActionResult<{ url: string | null; demo?: boolean }>> {
  return run(async ({ store, orgId, user }) => {
    if (!isStripeConfigured()) {
      if (isDemoMode()) return { url: null, demo: true };
      throw new HttpError(503, "Billing is not configured yet. Add the Stripe keys in your environment.");
    }
    const sub = await store.getSubscription(orgId);
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: proPriceId(), quantity: 1 }],
      client_reference_id: orgId,
      metadata: { org_id: orgId },
      subscription_data: { metadata: { org_id: orgId } },
      ...(sub.stripe_customer_id ? { customer: sub.stripe_customer_id } : { customer_email: user.email }),
      allow_promotion_codes: true,
      success_url: `${env.appUrl}/app/settings?tab=billing&checkout=success`,
      cancel_url: `${env.appUrl}/app/settings?tab=billing`,
    });
    return { url: session.url };
  });
}

/** Open the Stripe customer portal (manage card, cancel). */
export async function openBillingPortal(): Promise<ActionResult<{ url: string }>> {
  return run(async ({ store, orgId }) => {
    if (!isStripeConfigured()) throw new HttpError(503, "Billing is not configured yet.");
    const sub = await store.getSubscription(orgId);
    if (!sub.stripe_customer_id) throw new HttpError(400, "No billing account yet. Upgrade first.");
    const portal = await stripe().billingPortal.sessions.create({ customer: sub.stripe_customer_id, return_url: `${env.appUrl}/app/settings?tab=billing` });
    return { url: portal.url };
  });
}

/** Demo mode only: simulate Stripe flipping the plan, so the gate can be explored without keys. */
export async function demoSetPlan(plan: "free" | "pro", status = "active"): Promise<ActionResult> {
  return run(async ({ store, orgId }) => {
    if (!isDemoMode()) throw new HttpError(403, "Plan changes come only from Stripe.");
    await store.upsertSubscription({
      org_id: orgId,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      plan,
      status: plan === "pro" ? status : "canceled",
      current_period_end: plan === "pro" ? new Date(Date.now() + 30 * 86_400_000).toISOString() : null,
    });
    revalidatePath("/app", "layout");
    return null;
  });
}
