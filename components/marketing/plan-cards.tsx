import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { PLANS } from "@/lib/billing/plans";
import type { Plan } from "@/lib/types";
import { cn } from "@/lib/cn";

const ORDER: Plan[] = ["free", "investor", "firm", "fund"];

const MORE: Record<Plan, string[]> = {
  free: ["No card needed"],
  investor: ["Seller Motivation Decoder", "Devil's Advocate memo", "Buyer list with buy-box matching"],
  firm: ["Owner adds and removes seats", "Everyone keeps a private space too"],
  fund: ["Bulk analyzer: score 500 deals at once", "Priority support and onboarding call"],
};

export function PlanCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {ORDER.map((id) => {
        const p = PLANS[id];
        const dark = id === "fund";
        return (
          <div key={id} className={cn("flex flex-col rounded-2xl border p-6", dark ? "border-text bg-text text-ink" : "border-line bg-surface")}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium uppercase tracking-wider opacity-70">{p.name}</div>
              {id === "firm" ? <span className="rounded-full border border-current px-2 py-0.5 text-[11px] opacity-70">Teams</span> : null}
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="display text-5xl tabular">${p.priceMonthly}</span>
              <span className="opacity-70">{id === "free" ? "forever" : "/ month"}</span>
            </div>
            <p className="mt-2 text-sm opacity-70">{p.blurb}</p>
            <ul className="mt-5 flex-1 space-y-2.5">
              {[...p.bullets, ...MORE[id]].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button asChild size="lg" variant={dark ? "secondary" : id === "free" ? "secondary" : "primary"} className={cn("mt-6 w-full", dark && "!bg-ink !text-text")}>
              <Link href={id === "free" ? "/login" : `/login?next=${encodeURIComponent(`/app/settings?tab=billing&plan=${id}`)}`}>{id === "free" ? "Start free" : `Choose ${p.name}`}</Link>
            </Button>
          </div>
        );
      })}
    </div>
  );
}
