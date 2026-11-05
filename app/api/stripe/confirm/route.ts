import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/billing/stripe";
import { syncSubscription } from "@/lib/billing/sync";
import { isStripeConfigured } from "@/lib/env";
import { getAdminStore, getContext } from "@/lib/server/context";

export const runtime = "nodejs";

/**
 * Stripe Checkout's success_url. Confirms the payment with Stripe directly (server to server, using the
 * secret key) and switches the plan on before the customer lands on the dashboard, instead of waiting for
 * the webhook. The webhook still runs and is the source of truth for every later change.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  // Return to the same site the customer paid from, whatever NEXT_PUBLIC_APP_URL says.
  const to = (path: string) => NextResponse.redirect(new URL(path, url.origin));
  const sessionId = url.searchParams.get("session_id");

  const ctx = await getContext();
  if (!ctx) return to(`/login?next=${encodeURIComponent("/app?checkout=success")}`);
  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId) || !isStripeConfigured()) return to("/app?checkout=success");

  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
    // Only ever apply a checkout that belongs to the signed-in person.
    if (session.client_reference_id !== ctx.personalOrgId) return to("/app");
    const sub = session.subscription as Stripe.Subscription | null;
    if (session.status === "complete" && sub && typeof sub === "object") {
      await syncSubscription(getAdminStore(), ctx.personalOrgId, sub);
      const plan = session.metadata?.plan ?? "";
      return to(`/app?checkout=success&plan=${encodeURIComponent(plan)}`);
    }
  } catch (e) {
    console.error("checkout confirm failed; the webhook will finish it", e);
  }
  // Payment is still processing or the lookup failed: the webhook switches the plan on shortly.
  return to("/app?checkout=pending");
}
