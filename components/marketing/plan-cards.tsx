import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { PLANS } from "@/lib/billing/plans";
import type { Plan } from "@/lib/types";
import { cn } from "@/lib/cn";

const ORDER: Plan[] = ["free", "investor", "firm", "fund"];

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
              <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", id === "investor" ? "border-current font-medium" : "border-current opacity-70")}>{p.hook}</span>
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="display text-5xl tabular">${p.priceMonthly}</span>
              <span className="opacity-70">{id === "free" ? "forever" : "/ month"}</span>
            </div>
            <p className="mt-1 h-5 text-xs font-medium">{p.trialDays ? `${p.trialDays}-day free trial` : id === "free" ? "No card needed" : "\u00a0"}</p>
            <p className="mt-2 text-sm opacity-70">{p.blurb}</p>
            <ul className="mt-5 flex-1 space-y-2.5">
              {p.bullets.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button asChild size="lg" variant={dark ? "secondary" : id === "free" ? "secondary" : "primary"} className={cn("mt-6 w-full", dark && "!bg-ink !text-text")}>
              <Link href={id === "free" ? "/login?mode=signup" : `/login?next=${encodeURIComponent(`/app/settings?tab=billing&plan=${id}`)}`}>{id === "free" ? "Analyze a deal free" : p.trialDays ? "Start 7-day free trial" : `Choose ${p.name}`}</Link>
            </Button>
          </div>
        );
      })}
    </div>
  );
}
