"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCard, LogOut, Sparkles, User, Users } from "lucide-react";
import { demoSetPlan, openBillingPortal } from "@/lib/actions/billing";
import { PLANS, type PaidPlan } from "@/lib/billing/plans";
import { date } from "@/lib/format";
import type { Plan } from "@/lib/types";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/interactive";
import { useApp } from "@/components/shell/app-provider";
import { track } from "@/components/analytics";

export function SettingsView(p: {
  account: { name: string; email: string };
  space: { kind: "personal" | "team"; name: string };
  /** The signed-in person's own plan (billing is per person, on their personal space). */
  plan: Plan;
  sub: { status: string; periodEnd: string | null; hasCustomer: boolean };
  billingLive: boolean;
  demo: boolean;
  checkoutSuccess: boolean;
  /** From the pricing page: open the plan picker at this tier once. */
  wantPlan: PaidPlan | null;
}) {
  const toast = useToast();
  const { openUpgrade } = useApp();
  React.useEffect(() => {
    if (p.checkoutSuccess) {
      track("subscribed");
      toast("Your plan is active. Welcome to UndrIq");
    }
  }, [p.checkoutSuccess, toast]);
  React.useEffect(() => {
    if (p.wantPlan && PLANS[p.plan].rank < PLANS[p.wantPlan].rank && !p.checkoutSuccess) openUpgrade(undefined, p.wantPlan);
  }, [p.wantPlan, p.plan, p.checkoutSuccess, openUpgrade]);

  return (
    <div className="space-y-6">
      <Billing {...p} />
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-raised"><User className="size-4" /></span>
            <div className="min-w-0">
              <div className="font-medium">{p.account.name}</div>
              <div className="truncate text-sm text-muted">{p.account.email}</div>
            </div>
          </div>
          {!p.demo ? (
            <form action="/auth/signout" method="post">
              <Button variant="secondary" type="submit"><LogOut /> Sign out</Button>
            </form>
          ) : null}
        </div>
      </Card>
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-raised"><Users className="size-4" /></span>
            <div className="min-w-0">
              <div className="font-medium">{p.space.kind === "team" ? `Working in ${p.space.name}` : "Working in your private space"}</div>
              <p className="text-sm text-muted">
                {p.space.kind === "team"
                  ? "Everyone on this team sees its deals and buyers."
                  : "Your pipeline and buyers are visible only to you. Firm and Fund add shared team spaces."}
              </p>
            </div>
          </div>
          <Button asChild variant="secondary"><Link href="/app/team">Team spaces</Link></Button>
        </div>
      </Card>
    </div>
  );
}

function Billing(p: { plan: Plan; sub: { status: string; periodEnd: string | null; hasCustomer: boolean }; billingLive: boolean; demo: boolean }) {
  const { openUpgrade } = useApp();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const cfg = PLANS[p.plan];
  const paid = p.plan !== "free";
  const trialing = p.sub.status === "trialing";
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted">Your plan</div>
          <div className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
            {cfg.name} {paid ? <Badge><Sparkles className="size-3" /> {trialing ? "Free trial" : `$${cfg.priceMonthly}/mo`}</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted">
            {paid
              ? p.sub.status === "past_due"
                ? "Payment failed. Your plan stays on while Stripe retries the card."
                : `${trialing ? "Trial ends" : "Renews"} ${date(p.sub.periodEnd)}. ${cfg.analyses.toLocaleString()} analyses a month${cfg.teams ? `, ${cfg.teams} team space${cfg.teams > 1 ? "s" : ""} of up to ${cfg.seats}` : ""}.`
              : `${cfg.analyses} free analyses, the first fully unlocked. Upgrade for the full analysis on every deal, your pipeline and offers.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {p.plan !== "fund" ? <Button onClick={() => openUpgrade(undefined, p.plan === "free" ? "investor" : p.plan === "investor" ? "firm" : "fund")}><Sparkles /> {paid ? "Change plan" : "See plans"}</Button> : null}
          {paid ? (
            p.demo ? (
              <Button variant="secondary" onClick={async () => { await demoSetPlan("free"); toast("Back on Scout (demo mode)"); router.refresh(); }}>Cancel (demo)</Button>
            ) : (
              <Button variant="secondary" disabled={busy || !p.billingLive} onClick={async () => {
                setBusy(true);
                const res = await openBillingPortal();
                setBusy(false);
                if (!res.ok) return toast(res.error, "error");
                window.location.href = res.data.url;
              }}><CreditCard /> Manage billing</Button>
            )
          ) : null}
        </div>
      </div>
      {p.demo && paid ? (
        <div className="mt-4 flex items-center gap-3 border-t border-line-soft pt-4 text-xs text-muted">
          Demo: simulate a failed payment
          <Button size="sm" variant="ghost" onClick={async () => { await demoSetPlan(p.plan, "past_due"); router.refresh(); }}>Set past due</Button>
          <Button size="sm" variant="ghost" onClick={async () => { await demoSetPlan(p.plan, "active"); router.refresh(); }}>Set active</Button>
        </div>
      ) : null}
    </Card>
  );
}
