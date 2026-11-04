import Link from "next/link";
import { ArrowRight, Calculator, FileCheck2, FileSearch, KanbanSquare, Radar, Users } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { Button } from "@/components/ui/primitives";
import { money, pct } from "@/lib/format";
import { underwrite } from "@/lib/underwriting";

const FEATURES = [
  { icon: FileSearch, title: "Reads the broker OM", body: "Drop in the PDF. Unit mix, every financial period and the asking price come out in seconds, then seven red-flag checks run in code." },
  { icon: Calculator, title: "Underwrites as you slide", body: "Move price, leverage and rate. Cap rate, DSCR, cash flow and cash-on-cash update instantly, with a max offer that names the binding constraint." },
  { icon: Users, title: "Matches your buyers", body: "Score every buyer 0–100 against the deal's buy box, with the reasons, and keep direct-purchase buyers separate on assignments." },
  { icon: FileCheck2, title: "Compliant offering materials", body: "An anonymous preview before you have a contract. A branded OM with the equitable-interest disclosure once you do." },
  { icon: KanbanSquare, title: "One pipeline", body: "Sourced to Closed, with a contract gate before anything goes Under contract. Tasks and a full activity log on every deal." },
  { icon: Radar, title: "Finds the next one", body: "Forward listing alerts to your inbox address, or score a county's storage owners for motivation from appraisal records." },
];

export default function Landing() {
  // The hero numbers come from the real engine, on the San Antonio sample deal.
  const r = underwrite({ price: 715_000, noi: 65_113, downPct: 0.3, rate: 0.075, years: 20, nrsf: 21_650, units: 87, appraisedValue: 725_000 });
  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_20%_0%,var(--glow),transparent_70%)]" />
          <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/[0.06] px-3 py-1 text-xs font-medium text-gold">Acquisition intelligence for self storage</p>
              <h1 className="mt-6 text-[42px] font-semibold leading-[1.04] tracking-[-0.035em] sm:text-[58px]">
                Underwrite a storage deal before the broker hangs up.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
                Upload the OM, check the numbers, find your max offer, match it to your buyers and send compliant offering materials. Built for drive-up and climate deals from $300K to $5M.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg"><Link href="/login">Start free <ArrowRight /></Link></Button>
                <Button asChild size="lg" variant="secondary"><Link href="/pricing">See pricing</Link></Button>
              </div>
              <p className="mt-4 text-sm text-muted">Free for 3 deals. WeStor Pro is $49/month.</p>
            </div>

            <div className="relative rounded-3xl border border-line bg-surface p-6 shadow-panel sm:p-8" aria-label="Example underwriting">
              <div className="flex items-center justify-between text-sm text-muted">
                <span>West San Antonio Storage · 87 units</span>
                <span className="rounded-full border border-line bg-raised px-2.5 py-0.5 text-xs">94.1% of list</span>
              </div>
              <div className="mt-3 text-[52px] font-semibold leading-none tracking-[-0.03em] tabular">{money(715_000)}</div>
              <div className="mt-6 h-2.5 rounded-full bg-raised ring-1 ring-line">
                <div className="relative h-full w-[80%] rounded-full bg-gradient-to-r from-door/70 to-door">
                  <span className="absolute -right-3 top-1/2 size-6 -translate-y-1/2 rounded-full border-2 border-door bg-white shadow-[0_0_0_6px_var(--glow)]" />
                </div>
              </div>
              <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                {[
                  ["DSCR", `${r.dscr.toFixed(2)}x`, "text-go"],
                  ["T-12 cap", pct(r.capRate), ""],
                  ["Cash-on-cash", pct(r.cashOnCash, 1), ""],
                  ["Debt service", money(r.debtService), ""],
                  ["Cash flow", money(r.cashFlow), "text-go"],
                  ["Under appraisal", money(r.spreadToAppraisal), ""],
                ].map(([k, v, tone]) => (
                  <div key={k}>
                    <dt className="text-[13px] text-muted">{k}</dt>
                    <dd className={`mt-0.5 text-xl font-semibold tracking-tight tabular ${tone}`}>{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-6 border-t border-line-soft pt-4 text-xs text-muted">30% down · 7.5% · 20-year amortization. Calculated live by the same engine the app uses.</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight">From broker PDF to buyer-ready OM, in one place.</h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-surface p-7">
                <Icon className="size-5 text-gold" />
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-4 pb-24 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-gold/25 bg-gradient-to-br from-gold/[0.08] via-surface to-surface p-8 sm:flex-row sm:items-center sm:p-12">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Your next deal is already in your inbox.</h2>
              <p className="mt-2 text-muted">Start free with three deals. Upgrade when the numbers earn it.</p>
            </div>
            <Button asChild size="lg" variant="gold"><Link href="/login">Create your account <ArrowRight /></Link></Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
