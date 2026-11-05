import Link from "next/link";
import { ArrowRight, Calculator, FileSignature, Flame, KanbanSquare, Layers, Link2, ShieldAlert, Sparkles, TrendingDown, Users } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { AssistantWidget } from "@/components/marketing/assistant-widget";
import { PlanCards } from "@/components/marketing/plan-cards";
import { Button } from "@/components/ui/primitives";
import { ScoreRing } from "@/components/undriq/score";

const FEATURES = [
  { icon: Layers, title: "Exit Strategy Matrix", body: "Wholesale, flip, buy and hold, BRRRR and seller finance, scored side by side with a max price for each. Most tools give you one number; you get five ways to win." },
  { icon: TrendingDown, title: "Offer Ladder", body: "Anchor, target and walk-away prices built from your best exit, with the reason behind each rung. Walk into the negotiation knowing your ceiling." },
  { icon: Calculator, title: "Stress Test", body: "Rates up a point, rents down 10%, expenses up 15%, and all three at once. See the DSCR and monthly cash flow before the market tests it for you." },
  { icon: Flame, title: "Seller Motivation Decoder", body: "Price cuts, days on market, estate and as-is language turned into a 0–10 score and a line on how to use it." },
  { icon: ShieldAlert, title: "Devil's Advocate", body: "The memo argues against the deal: three ways it fails and three things that must be true. Fewer surprises after you sign." },
  { icon: FileSignature, title: "Offer generator", body: "A letter of intent, an email and a text, filled with your terms and ready to send. Save each offer and track the counter." },
  { icon: Users, title: "Private and team spaces", body: "Every account gets its own private pipeline and buyer list. Firm and Fund add shared team spaces with seats you control." },
  { icon: Sparkles, title: "Bulk analyzer and buy box", body: "Fund teams paste 500 deals and score them at once with their own ARV %, cap rates and financing." },
];

const STEPS = [
  { icon: Link2, k: "Source", t: "Paste the link and the listing text, or upload the OM." },
  { icon: Sparkles, k: "Analyze", t: "SI reads the facts. Code runs the math. You get a score in about a minute." },
  { icon: FileSignature, k: "Offer", t: "Pick a rung on the ladder and send a ready-made LOI." },
  { icon: KanbanSquare, k: "Track", t: "Every deal and offer lives in your pipeline, private or shared." },
];

export default function Landing() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative mx-auto max-w-[1200px] px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
          <div className="bg-grid pointer-events-none absolute inset-0 -z-10" aria-hidden />
          <div className="mx-auto max-w-3xl text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-ink px-3 py-1 text-xs text-muted">
              <span className="size-1.5 rounded-full bg-brand" aria-hidden />
              Residential · Multifamily · Self storage · Industrial · Retail and office
            </p>
            <h1 className="display mt-6 text-5xl sm:text-7xl">Underwrite any deal in minutes.</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
              UndrIq is the acquisitions analyst for investors and wholesalers, built on SI: Super Intelligence technology. Paste a listing and get a deal score, five exit strategies, your offer ladder and a ready-to-send offer.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg"><Link href="/login?mode=signup">Analyze your first deal free <ArrowRight /></Link></Button>
              <Button asChild size="lg" variant="secondary"><Link href="/pricing">See pricing</Link></Button>
            </div>
            <p className="mt-3 text-xs text-muted">Your first analysis is fully unlocked. No card needed.</p>
          </div>

          <div className="mx-auto mt-14 max-w-4xl rounded-3xl border border-line bg-surface p-5 shadow-panel sm:p-8" aria-label="Example analysis">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <ScoreRing score={82} size={120} />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-muted">Example · Single-family · Memphis, TN</div>
                <div className="mt-1 text-xl font-semibold">3-bed ranch, needs a kitchen and roof</div>
                <div className="mt-2 inline-flex rounded-full border border-go/30 bg-go/10 px-2.5 py-0.5 text-sm text-go">Strong deal. Move fast.</div>
                <p className="mt-3 text-sm text-muted">Best exit: BRRRR. Anchor at $96K, land near $108K, walk away above $112K.</p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[["BRRRR", "92"], ["Fix and flip", "74"], ["Wholesale", "76"], ["Buy and hold", "66"], ["Seller finance", "64"]].map(([n, s]) => (
                <div key={n} className="rounded-xl border border-line-soft p-3">
                  <div className="text-xs text-muted">{n}</div>
                  <div className="mt-1 text-lg font-semibold tabular">{s}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-line-soft bg-surface/40">
          <div className="mx-auto grid max-w-[1200px] gap-6 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.k}>
                <div className="flex items-center gap-2"><span className="eyebrow tabular">Step {i + 1}</span><s.icon className="size-4 text-muted" /></div>
                <div className="display mt-2 text-3xl">{s.k}</div>
                <p className="mt-1 text-sm text-muted">{s.t}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6">
          <p className="eyebrow">Why UndrIq</p>
          <h2 className="display mt-3 max-w-2xl text-4xl sm:text-5xl">What other analyzers don&apos;t do.</h2>
          <p className="mt-3 max-w-2xl text-muted">Built for people who make offers, not spreadsheets. SI reads and writes; every number is computed by tested code.</p>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-surface p-6">
                <f.icon className="size-5 text-brand" />
                <div className="mt-3 font-medium">{f.title}</div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-4 pb-20 sm:px-6" id="pricing">
          <p className="eyebrow">Pricing</p>
          <h2 className="display mt-3 text-4xl sm:text-5xl">Your first deal is free.</h2>
          <p className="mt-3 text-muted">Your first analysis is fully unlocked. Paid plans start with a 7-day free trial.</p>
          <div className="mt-8"><PlanCards /></div>
        </section>

        <section className="border-t border-line-soft">
          <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-16 sm:px-6 md:grid-cols-3">
            {[
              ["Does UndrIq pull data from Zillow, LoopNet or Crexi?", "No. We never scrape listing sites. Paste the link and the listing text, or upload the OM, and UndrIq reads what you give it. The link pre-fills the address."],
              ["Who can see my deals?", "Your private space is visible only to you. On Firm and Fund you can create team spaces; only people the owner adds can see them, and the owner can remove anyone."],
              ["Is this investment advice?", "No. UndrIq gives analysis and drafts documents. Check your numbers, follow your state's wholesaling rules and have an attorney review anything you sign."],
            ].map(([q, a]) => (
              <div key={q}>
                <div className="font-medium">{q}</div>
                <p className="mt-2 text-sm leading-relaxed text-muted">{a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
      <AssistantWidget />
    </>
  );
}
