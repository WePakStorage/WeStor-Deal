"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, Sparkles } from "lucide-react";
import { Dialog, DialogContent, ToastProvider, useToast } from "@/components/ui/interactive";
import { Button } from "@/components/ui/primitives";
import { startCheckout, demoSetPlan } from "@/lib/actions/billing";
import { track } from "@/components/analytics";

interface AppState {
  isPro: boolean;
  demo: boolean;
  status: string;
  openUpgrade: (reason?: string) => void;
}

const Ctx = React.createContext<AppState>({ isPro: false, demo: false, status: "none", openUpgrade: () => {} });
export const useApp = () => React.useContext(Ctx);

const PRO_FEATURES = [
  "Live underwriting at any price, leverage and rate",
  "Max offer calculator with the binding constraint",
  "AI OM reader with automatic red-flag checks",
  "Buyer CRM, CSV import and buy-box matching",
  "Pre-contract previews and branded OMs",
  "Unlimited deals and CSV export",
];

export function AppProvider({ isPro, demo, status, children }: { isPro: boolean; demo: boolean; status: string; children: React.ReactNode }) {
  return (
    <ToastProvider>
      <Inner isPro={isPro} demo={demo} status={status}>
        {children}
      </Inner>
    </ToastProvider>
  );
}

function Inner({ isPro, demo, status, children }: { isPro: boolean; demo: boolean; status: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState<string | undefined>();
  const [pending, start] = React.useTransition();
  const toast = useToast();
  const router = useRouter();

  const openUpgrade = React.useCallback((r?: string) => {
    setReason(r);
    setOpen(true);
    track("paywall_viewed", { reason: r });
  }, []);

  const checkout = () =>
    start(async () => {
      track("checkout_started");
      const res = await startCheckout();
      if (!res.ok) return toast(res.error, "error");
      if (res.data.url) {
        window.location.href = res.data.url;
        return;
      }
      if (res.data.demo) {
        const r = await demoSetPlan("pro");
        if (!r.ok) return toast(r.error, "error");
        setOpen(false);
        toast("WeStor Pro unlocked (demo mode)");
        router.refresh();
      }
    });

  return (
    <Ctx.Provider value={{ isPro, demo, status, openUpgrade }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Unlock WeStor Pro" description={reason ?? "Everything you need to underwrite, match and market storage deals."}>
          <div className="rounded-xl border border-gold/30 bg-gradient-to-b from-gold/[0.07] to-transparent p-5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-semibold tracking-tight tabular">$49</span>
              <span className="text-muted">/ month</span>
            </div>
            <p className="mt-1 text-sm text-muted">Cancel anytime from the billing portal. Your data stays if you do.</p>
            <ul className="mt-5 space-y-2.5">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-go" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <Button className="mt-5 w-full" size="lg" variant="gold" onClick={checkout} disabled={pending}>
            <Sparkles /> {pending ? "Opening checkout…" : "Upgrade for $49/month"}
          </Button>
          {demo ? <p className="mt-3 text-center text-xs text-muted">Demo mode: no card is charged. Stripe Checkout runs once keys are added.</p> : null}
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}

/** Blur Pro content for free users. Cosmetic only: the server enforces access. */
export function ProLock({ children, feature, className }: { children: React.ReactNode; feature: string; className?: string }) {
  const { isPro, openUpgrade } = useApp();
  if (isPro) return <>{children}</>;
  return (
    <div className={`relative ${className ?? ""}`}>
      <div className="locked-blur" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="flex max-w-xs flex-col items-center gap-3 rounded-2xl border border-line bg-surface/95 px-6 py-5 text-center shadow-panel backdrop-blur">
          <div className="grid size-10 place-items-center rounded-full bg-gold/10 text-gold">
            <Lock className="size-4" />
          </div>
          <div>
            <div className="font-medium">{feature}</div>
            <p className="mt-0.5 text-sm text-muted">Included with WeStor Pro.</p>
          </div>
          <Button variant="gold" onClick={() => openUpgrade(`${feature} is part of WeStor Pro.`)}>
            Unlock for $49/month
          </Button>
        </div>
      </div>
    </div>
  );
}
