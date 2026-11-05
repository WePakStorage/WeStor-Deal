import Link from "next/link";
import { BrandMark } from "@/components/shell/nav";
import { env, isAnthropicConfigured, isDemoMode, isStripeConfigured } from "@/lib/env";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { pingClaude } from "@/lib/ai/claude";

// Live SI check result, cached briefly per server instance so reloading /status can't run up the bill.
const g = globalThis as unknown as { __siPing?: { at: number; ok: boolean; reason?: string } };
async function siWorks(): Promise<{ ok: boolean; reason?: string }> {
  if (g.__siPing && Date.now() - g.__siPing.at < 10 * 60_000) return g.__siPing;
  const r = await pingClaude();
  g.__siPing = { at: Date.now(), ok: r.ok, reason: r.ok ? undefined : r.reason };
  return g.__siPing;
}

export const metadata = { title: "Setup check" };
export const dynamic = "force-dynamic";

type Check = { label: string; ok: boolean | null; fix: string };

/** ensure_account() exists if calling it as the service role (no signed-in user) raises its own "Not signed in" error. */
async function ensureAccountExists(): Promise<boolean> {
  const { error } = await supabaseAdmin().rpc("ensure_account");
  return error?.code === "42501";
}
/** A table exists only if a head-select on it succeeds. Any error (missing table, bad key, unreachable) is a no. */
async function tableExists(name: string): Promise<boolean> {
  // A real GET (not HEAD) so a failed request always comes back as an error.
  const { data, error } = await supabaseAdmin().from(name).select("*").limit(1);
  return !error && Array.isArray(data);
}

/**
 * Setup check: shows which pieces of the deployment are in place, as yes/no only (no values, no secrets),
 * so a sign-in or dashboard problem can be traced to one missing step.
 */
export default async function StatusPage() {
  const checks: Check[] = [];
  const add = (label: string, ok: boolean | null, fix: string) => checks.push({ label, ok, fix });

  add("Supabase URL and anon key set in Vercel", !isDemoMode(), "Vercel → Settings → Environment Variables: add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then Redeploy.");
  const service = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  add("Supabase service role key set", service, "Add SUPABASE_SERVICE_ROLE_KEY in Vercel (Supabase → Project Settings → API → service_role), then Redeploy.");
  add("Site address (NEXT_PUBLIC_APP_URL) is not localhost", !/localhost/.test(env.appUrl), "Set NEXT_PUBLIC_APP_URL to your real address, e.g. https://westordeals.com, then Redeploy.");

  let signedIn: boolean | null = null;
  let hasAccount: boolean | null = null;
  if (!isDemoMode()) {
    if (service) {
      const steps: [string, () => Promise<boolean>, string][] = [
        ["Database setup 0001 (core tables)", () => tableExists("orgs"), "Run supabase/migrations/…0001_init.sql in the Supabase SQL Editor."],
        ["Database setup 0003 (spaces, analyses)", () => tableExists("analyses"), "Run …0003_undriq_spaces.sql (and 0002 before it if not run)."],
        ["Database setup 0005 (property data)", () => tableExists("property_lookups"), "Run …0005_property_lookups.sql (and 0004 before it)."],
        ["Database setup 0007 (accounts fix itself on sign-in)", ensureAccountExists, "Run …0007_self_healing_accounts.sql (and 0006 before it), then 0008."],
      ];
      for (const [label, fn, fix] of steps) {
        let ok: boolean | null = null;
        try {
          ok = await fn();
        } catch {
          ok = false;
        }
        add(label, ok, fix);
      }
    }
    try {
      const sb = await supabaseServer();
      const { data } = await sb.auth.getUser();
      signedIn = Boolean(data.user);
      if (data.user) {
        const { data: profile } = await sb.from("profiles").select("personal_org_id").eq("user_id", data.user.id).maybeSingle();
        hasAccount = Boolean(profile?.personal_org_id);
      }
    } catch {
      signedIn = false;
    }
  }
  add("SI (Claude) key set", isAnthropicConfigured(), "Add ANTHROPIC_API_KEY in Vercel, then Redeploy.");
  if (isAnthropicConfigured()) {
    // Only signed-in visitors trigger the live test call.
    if (signedIn) {
      const si = await siWorks();
      add("SI (Claude) answers a live test", si.ok, si.reason ?? "");
    } else add("SI (Claude) answers a live test (sign in to run it)", null, "");
  }
  add("Stripe set (needed only for paid plans)", isStripeConfigured(), "Add STRIPE_SECRET_KEY and the STRIPE_PRICE_* values in Vercel, then Redeploy.");
  add("RentCast set (needed only for property data)", Boolean(process.env.RENTCAST_API_KEY), "Add RENTCAST_API_KEY in Vercel, then Redeploy.");

  const mark = (ok: boolean | null) => (ok === null ? "–" : ok ? "✓" : "✗");
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/"><BrandMark /></Link>
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">Setup check</h1>
      <p className="mt-1 text-sm text-muted">Yes/no only. No keys or personal data are shown on this page.</p>
      <ul className="mt-6 divide-y divide-line-soft rounded-2xl border border-line bg-surface">
        {checks.map((c) => (
          <li key={c.label} className="flex gap-3 px-5 py-3 text-sm">
            <span className={c.ok ? "text-go" : c.ok === false ? "text-stop" : "text-muted"} aria-label={c.ok ? "OK" : "Missing"}>{mark(c.ok)}</span>
            <div className="min-w-0">
              <div className="font-medium">{c.label}</div>
              {c.ok === false ? <div className="text-muted">{c.fix}</div> : null}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 rounded-2xl border border-line bg-surface px-5 py-4 text-sm">
        <div className="font-medium">This browser</div>
        <p className="mt-1 text-muted">
          {signedIn === null
            ? "Sign-in isn't configured yet (see the first check)."
            : signedIn
              ? hasAccount
                ? "You're signed in and your account is set up. "
                : "You're signed in, but your account isn't set up yet. Run the database setup files above, then reload. "
              : "Not signed in. "}
          {signedIn ? <Link className="underline" href="/app">Open the dashboard</Link> : <Link className="underline" href="/login">Sign in</Link>}
        </p>
      </div>
    </div>
  );
}
