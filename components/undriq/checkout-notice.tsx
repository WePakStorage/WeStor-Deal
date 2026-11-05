"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { PLANS } from "@/lib/billing/plans";
import type { Plan } from "@/lib/types";
import { track } from "@/components/analytics";

/** Shown on the dashboard after Stripe Checkout: welcome, still-processing (auto-refresh), or cancelled. */
export function CheckoutNotice({ status, plan, trialing }: { status: "success" | "pending" | "cancelled"; plan: Plan; trialing: boolean }) {
  const router = useRouter();
  const [hidden, setHidden] = React.useState(false);
  const [tries, setTries] = React.useState(0);
  const active = plan !== "free";

  React.useEffect(() => {
    if (status === "success" && active) track("subscribed", { plan });
  }, [status, active, plan]);

  // Payment confirmed but the plan isn't on yet: refresh a few times while Stripe's webhook lands.
  React.useEffect(() => {
    if (status === "cancelled" || active || tries >= 8) return;
    const t = setTimeout(() => {
      setTries((n) => n + 1);
      router.refresh();
    }, 2500);
    return () => clearTimeout(t);
  }, [status, active, tries, router]);

  // Clean the URL so a reload doesn't show the notice again.
  React.useEffect(() => {
    if (active || status === "cancelled") window.history.replaceState(null, "", "/app");
  }, [active, status]);

  if (hidden) return null;
  const cfg = PLANS[plan];
  return (
    <div role="status" className={`mb-6 flex items-start gap-3 rounded-2xl border px-5 py-4 ${active ? "border-go/40 bg-go/10" : "border-line bg-raised"}`}>
      {active ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-go" /> : status === "cancelled" ? null : <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin" />}
      <div className="min-w-0 flex-1 text-sm">
        {active ? (
          <>
            <div className="font-semibold">Welcome to {cfg.name}. You&apos;re all set.</div>
            <p className="text-muted">
              {trialing ? `Your ${cfg.trialDays}-day free trial has started. ` : ""}
              Every analysis now includes the full exit matrix, offer ladder, stress test and memo, and your pipeline and offers are unlocked.
            </p>
          </>
        ) : status === "cancelled" ? (
          <>
            <div className="font-semibold">Checkout cancelled</div>
            <p className="text-muted">No charge was made. You can pick a plan any time from the sidebar.</p>
          </>
        ) : tries >= 8 ? (
          <>
            <div className="font-semibold">Payment received. Your plan is still switching on.</div>
            <p className="text-muted">This usually takes a few seconds. Refresh the page in a minute; if it still shows Scout, contact support.</p>
          </>
        ) : (
          <>
            <div className="font-semibold">Payment received. Switching your plan on…</div>
            <p className="text-muted">One moment while Stripe confirms it.</p>
          </>
        )}
      </div>
      <button type="button" aria-label="Dismiss" onClick={() => setHidden(true)} className="rounded p-1 text-muted hover:text-text"><X className="size-4" /></button>
    </div>
  );
}
