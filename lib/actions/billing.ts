"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { env, isDemoMode, isStripeConfigured } from "../env";
import { PAID_PLANS, PLANS, type PaidPlan } from "../billing/plans";
import { priceIdFor, stripe } from "../billing/stripe";
import { HttpError, run } from "../server/run";
import type { Plan } from "../types";
import type { ActionResult } from "./result";

const planSchema = z.enum(PAID_PLANS);

/**
 * Start Stripe Checkout for a paid tier. Billing always lives on the caller's PERSONAL space:
 * a Firm or Fund subscription there powers every team space that person owns.
 */
export async function startCheckout(tier: PaidPlan = "investor"): Promise<ActionResult<{ url: string | null; demo?: boolean }>> {
  return run(async ({ store, personalOrgId, user }) => {
    const plan = planSchema.parse(tier);
    if (!isStripeConfigured()) {
      if (isDemoMode()) return { url: null, demo: true };
      throw new HttpError(503, "Billing is not configured yet. Add the Stripe keys in your environment.");
    }
    const sub = await store.getSubscription(personalOrgId);
    if (sub.stripe_subscription_id && ["active", "trialing", "past_due"].includes(sub.status)) {
      // Already subscribed: plan changes and cancellations go through the portal (prorated by Stripe).
      const portal = await stripe().billingPortal.sessions.create({ customer: sub.stripe_customer_id!, return_url: `${env.appUrl}/app/settings?tab=billing` });
      return { url: portal.url };
    }
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceIdFor(plan), quantity: 1 }],
      client_reference_id: personalOrgId,
      metadata: { org_id: personalOrgId, plan },
      subscription_data: { metadata: { org_id: personalOrgId, plan } },
      ...(sub.stripe_customer_id ? { customer: sub.stripe_customer_id } : { customer_email: user.email }),
      allow_promotion_codes: true,
      success_url: `${env.appUrl}/app/settings?tab=billing&checkout=success`,
      cancel_url: `${env.appUrl}/app/settings?tab=billing`,
    });
    return { url: session.url };
  });
}

/** Open the Stripe customer portal (manage card, change tier, cancel). */
export async function openBillingPortal(): Promise<ActionResult<{ url: string }>> {
  return run(async ({ store, personalOrgId }) => {
    if (!isStripeConfigured()) throw new HttpError(503, "Billing is not configured yet.");
    const sub = await store.getSubscription(personalOrgId);
    if (!sub.stripe_customer_id) throw new HttpError(400, "No billing account yet. Upgrade first.");
    const portal = await stripe().billingPortal.sessions.create({ customer: sub.stripe_customer_id, return_url: `${env.appUrl}/app/settings?tab=billing` });
    return { url: portal.url };
  });
}

/** Demo mode only: simulate Stripe flipping the plan, so the gates can be explored without keys. */
export async function demoSetPlan(plan: Plan, status = "active"): Promise<ActionResult> {
  return run(async ({ store, personalOrgId }) => {
    if (!isDemoMode()) throw new HttpError(403, "Plan changes come only from Stripe.");
    if (!(plan in PLANS)) throw new HttpError(400, "Unknown plan.");
    const paid = plan !== "free";
    await store.upsertSubscription({
      org_id: personalOrgId,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      plan,
      status: paid ? status : "canceled",
      current_period_end: paid ? new Date(Date.now() + 30 * 86_400_000).toISOString() : null,
    });
    revalidatePath("/app", "layout");
    return null;
  });
}
