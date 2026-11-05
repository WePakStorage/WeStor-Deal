"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Lock } from "lucide-react";
import { Dialog, DialogContent, ToastProvider, useToast } from "@/components/ui/interactive";
import { Button } from "@/components/ui/primitives";
import { demoSetPlan, startCheckout } from "@/lib/actions/billing";
import { PAID_PLANS, PLANS, type PaidPlan } from "@/lib/billing/plans";
import type { Plan } from "@/lib/types";
import { track } from "@/components/analytics";

interface AppState {
  /** Plan of the active space. */
  plan: Plan;
  /** Any paid plan (legacy self-storage tools). */
  isPro: boolean;
  demo: boolean;
  status: string;
  spaceKind: "personal" | "team";
  openUpgrade: (reason?: string, min?: PaidPlan) => void;
}

const Ctx = React.createContext<AppState>({ plan: "free", isPro: false, demo: false, status: "none", spaceKind: "personal", openUpgrade: () => {} });
export const useApp = () => React.useContext(Ctx);

export function AppProvider(p: { plan: Plan; demo: boolean; status: string; spaceKind: "personal" | "team"; children: React.ReactNode }) {
  return (
    <ToastProvider>
      <Inner {...p} />
    </ToastProvider>
  );
}

function Inner({ plan, demo, status, spaceKind, children }: { plan: Plan; demo: boolean; status: string; spaceKind: "personal" | "team"; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState<string | undefined>();
  const [min, setMin] = React.useState<PaidPlan>("investor");
  const [pending, start] = React.useTransition();
  const [picked, setPicked] = React.useState<PaidPlan | null>(null);
  const toast = useToast();
  const router = useRouter();

  const openUpgrade = React.useCallback((r?: string, m: PaidPlan = "investor") => {
    setReason(r);
    setMin(m);
    setOpen(true);
    track("paywall_viewed", { reason: r, min: m });
  }, []);

  const checkout = (tier: PaidPlan) =>
    start(async () => {
      setPicked(tier);
      track("checkout_started", { tier });
      const res = await startCheckout(tier);
      if (!res.ok) return toast(res.error, "error");
      if (res.data.url) {
        window.location.href = res.data.url;
        return;
      }
      if (res.data.demo) {
        const r = await demoSetPlan(tier);
        if (!r.ok) return toast(r.error, "error");
        setOpen(false);
        toast(`${PLANS[tier].name} unlocked (demo mode)`);
        router.refresh();
      }
    });

  const tiers = PAID_PLANS.filter((t) => PLANS[t].rank >= PLANS[min].rank);

  return (
    <Ctx.Provider value={{ plan, isPro: PLANS[plan].features.liveUnderwriting, demo, status, spaceKind, openUpgrade }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent wide className="max-w-4xl" title="Upgrade UndrIq" description={reason ?? "Pick the plan that fits how many deals you work."}>
          {spaceKind === "team" ? (
            <p className="mb-4 rounded-lg border border-line bg-raised px-3 py-2 text-sm text-muted">
              You&apos;re in a team space. Team features follow the team owner&apos;s plan; upgrading here changes your own plan and your private space.
            </p>
          ) : null}
          <div className={`grid gap-3 ${tiers.length === 3 ? "md:grid-cols-3" : tiers.length === 2 ? "md:grid-cols-2" : ""}`}>
            {tiers.map((t) => {
              const cfg = PLANS[t];
              const top = t === "fund";
              return (
                <div key={t} className={`flex flex-col rounded-xl border p-5 ${top ? "border-text bg-text text-ink" : "border-line bg-raised"}`}>
                  <div className="text-sm font-medium uppercase tracking-wider opacity-70">{cfg.name}</div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-semibold tracking-tight tabular">${cfg.priceMonthly}</span>
                    <span className="opacity-70">/ mo</span>
                  </div>
                  <p className="mt-1 text-sm opacity-70">{cfg.blurb}</p>
                  <ul className="mt-4 flex-1 space-y-2">
                    {cfg.bullets.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 size-4 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`mt-5 w-full ${top ? "!bg-ink !text-text" : ""}`}
                    variant={top ? "secondary" : "primary"}
                    onClick={() => checkout(t)}
                    disabled={pending || plan === t}
                  >
                    {plan === t ? "Your plan" : pending && picked === t ? "Opening checkout…" : `Choose ${cfg.name}`}
                  </Button>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-center text-xs text-muted">
            {demo ? "Demo mode: no card is charged. Stripe Checkout runs once keys are added." : "Billed monthly by Stripe. Change or cancel any time from Billing."}
            {status === "past_due" ? " Your last payment failed; update your card in Billing." : ""}
          </p>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}

/** Blur paid content. Cosmetic only: the server strips or refuses it for lower plans. */
export function ProLock({ children, feature, className, min = "investor" }: { children: React.ReactNode; feature: string; className?: string; min?: PaidPlan }) {
  const { plan, openUpgrade } = useApp();
  if (PLANS[plan].rank >= PLANS[min].rank) return <>{children}</>;
  return (
    <div className={`relative ${className ?? ""}`}>
      <div className="locked-blur" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="flex max-w-xs flex-col items-center gap-3 rounded-2xl border border-line bg-surface/95 px-6 py-5 text-center shadow-panel backdrop-blur">
          <div className="grid size-10 place-items-center rounded-full bg-raised">
            <Lock className="size-4" />
          </div>
          <div>
            <div className="font-medium">{feature}</div>
            <p className="mt-0.5 text-sm text-muted">Included with {PLANS[min].name} and up.</p>
          </div>
          <Button onClick={() => openUpgrade(`${feature} is part of ${PLANS[min].name}.`, min)}>See plans</Button>
        </div>
      </div>
    </div>
  );
}
