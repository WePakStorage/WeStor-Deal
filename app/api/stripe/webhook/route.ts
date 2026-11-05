import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/billing/stripe";
import { syncSubscription } from "@/lib/billing/sync";
import { getAdminStore } from "@/lib/server/context";
import { trackServer } from "@/lib/server/analytics";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");
  if (!secret || !sig) return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), sig, secret);
  } catch (e) {
    return NextResponse.json({ error: `Invalid signature: ${(e as Error).message}` }, { status: 400 });
  }

  const store = getAdminStore();
  const orgFor = async (obj: { metadata?: Stripe.Metadata | null; customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null }) => {
    const fromMeta = obj.metadata?.org_id;
    if (fromMeta) return fromMeta;
    const cust = typeof obj.customer === "string" ? obj.customer : obj.customer?.id;
    return cust ? store.findOrgIdByStripeCustomer(cust) : null;
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      const orgId = s.client_reference_id ?? (await orgFor(s));
      if (orgId && typeof s.subscription === "string") {
        const sub = await stripe().subscriptions.retrieve(s.subscription);
        await syncSubscription(store, orgId, sub);
        await trackServer("subscribed", orgId);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      // Stripe doesn't guarantee event order. Re-read the subscription so an older event
      // arriving late can never roll a customer back to a stale plan or status.
      const evtSub = event.data.object;
      const orgId = await orgFor(evtSub);
      if (orgId) {
        const sub = await stripe().subscriptions.retrieve(evtSub.id);
        await syncSubscription(store, orgId, sub);
        if (event.type === "customer.subscription.deleted") await trackServer("subscription_cancelled", orgId);
      }
      break;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      // payment_failed: Stripe marks the subscription past_due (we keep access through retries and show a banner).
      // paid: clears past_due as soon as a retry or a new card succeeds.
      const inv = event.data.object as Stripe.Invoice & { subscription?: string | null };
      const subId = inv.subscription ?? (inv as unknown as { parent?: { subscription_details?: { subscription?: string } } }).parent?.subscription_details?.subscription;
      const orgId = await orgFor(inv);
      if (orgId && subId) await syncSubscription(store, orgId, await stripe().subscriptions.retrieve(subId));
      break;
    }
    default:
      break;
  }
  return NextResponse.json({ received: true });
}
