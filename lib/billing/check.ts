import "server-only";
import { PAID_PLANS, PLANS } from "./plans";
import { stripe } from "./stripe";

export interface StripeCheck {
  label: string;
  ok: boolean;
  fix: string;
}

/**
 * Live Stripe setup check for /status: the secret key works, which mode it's in, each plan's price exists,
 * is monthly and recurring and matches the plan amount, and the webhook secret has the right shape.
 * Reads only; never shows key values.
 */
export async function checkStripeSetup(): Promise<StripeCheck[]> {
  const out: StripeCheck[] = [];
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key) return [{ label: "Stripe secret key set", ok: false, fix: "Add STRIPE_SECRET_KEY in Vercel (Stripe → Developers → API keys → Secret key), then Redeploy." }];
  // sk_ = full secret key, rk_ = restricted key; both come in _live_ and _test_ flavours.
  const restricted = key.startsWith("rk_");
  const mode = /^(sk|rk)_live_/.test(key) ? "live" : /^(sk|rk)_test_/.test(key) ? "test/sandbox" : "unknown";
  const kind = restricted ? "restricted key" : "secret key";

  try {
    // Reading prices needs only the Prices permission, so this works for restricted keys too.
    await stripe().prices.list({ limit: 1 });
    out.push({ label: `Stripe ${kind} works (${mode} mode)`, ok: true, fix: "" });
  } catch {
    out.push({
      label: `Stripe ${kind} works`,
      ok: false,
      fix: restricted
        ? "Stripe rejected the restricted key, or it can't read Prices. Use the standard Secret key (sk_live_…) instead, or give the restricted key the permissions listed in the README."
        : "Stripe rejected STRIPE_SECRET_KEY. Copy the Secret key again (sk_test_… in the sandbox, sk_live_… for real payments) and Redeploy.",
    });
    return out;
  }
  if (restricted) {
    // A restricted key also needs write access to create checkouts and billing-portal sessions.
    try {
      await stripe().checkout.sessions.list({ limit: 1 });
      out.push({ label: "Restricted key can manage Checkout", ok: true, fix: "" });
    } catch {
      out.push({ label: "Restricted key can manage Checkout", ok: false, fix: "Edit the restricted key in Stripe: Checkout Sessions → Write. Or use the standard Secret key (sk_live_…) instead." });
    }
  }

  for (const plan of PAID_PLANS) {
    const cfg = PLANS[plan];
    const envName = cfg.stripePriceEnv!;
    const id = process.env[envName] ?? (plan === "investor" ? process.env.STRIPE_PRICE_PRO_MONTHLY : undefined);
    if (!id) {
      out.push({ label: `${cfg.name} price set`, ok: false, fix: `Add ${envName} in Vercel: Stripe → Product catalog → UndrIq ${cfg.name} → click the price → copy the Price ID (price_…).` });
      continue;
    }
    if (id.startsWith("prod_")) {
      out.push({ label: `${cfg.name} price set`, ok: false, fix: `${envName} is a Product ID (prod_…). Open the product, click its price, and copy the Price ID (price_…) instead.` });
      continue;
    }
    try {
      const p = await stripe().prices.retrieve(id);
      const amount = (p.unit_amount ?? 0) / 100;
      const problems = [
        !p.active && "the price is archived",
        p.type !== "recurring" && "it isn't a recurring price",
        p.recurring && p.recurring.interval !== "month" && `it bills every ${p.recurring.interval}, not monthly`,
        amount !== cfg.priceMonthly && `it's $${amount}, the plan shows $${cfg.priceMonthly}`,
        p.currency !== "usd" && `currency is ${p.currency.toUpperCase()}`,
      ].filter(Boolean);
      out.push({
        label: `${cfg.name} price ($${cfg.priceMonthly}/month)`,
        ok: problems.length === 0,
        fix: problems.length ? `Check ${envName}: ${problems.join("; ")}.` : "",
      });
    } catch {
      out.push({ label: `${cfg.name} price ($${cfg.priceMonthly}/month)`, ok: false, fix: `Stripe can't find ${envName}. It must be a price from the same ${mode} account as the secret key (sandbox prices don't exist in live mode and vice versa).` });
    }
  }

  const wh = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  out.push({
    label: "Stripe webhook signing secret set",
    ok: wh.startsWith("whsec_"),
    fix: wh ? "STRIPE_WEBHOOK_SECRET should start with whsec_. Copy the Signing secret from Stripe → Workbench → Webhooks → your destination." : "Add STRIPE_WEBHOOK_SECRET in Vercel (Stripe → Workbench → Webhooks → your destination → Signing secret), then Redeploy.",
  });
  return out;
}
