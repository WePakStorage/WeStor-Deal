import Link from "next/link";
import { Check } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { Button } from "@/components/ui/primitives";

export const metadata = { title: "Pricing" };

const FREE = ["Pipeline kanban and deal list", "Manual entry for up to 3 deals", "Read-only deal summary with cap rate", "Tasks and activity log"];
const PRO = ["Everything in Free, unlimited deals", "Live underwriting and max offer", "AI OM reader with red-flag checks", "Buyer CRM, CSV import and matching", "Pre-contract previews and branded OMs", "Listing-alert inbox and off-market finder", "CSV export and up to 3 seats"];

export default function Pricing() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1000px] px-4 py-16 sm:px-6 sm:py-24">
        <div className="text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Simple pricing</h1>
          <p className="mt-4 text-lg text-muted">Start free. Upgrade when you&apos;re underwriting every week.</p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          <Plan name="Free" price="$0" sub="Forever" items={FREE} cta={<Button asChild variant="secondary" size="lg" className="w-full"><Link href="/login">Start free</Link></Button>} />
          <Plan featured name="WeStor Pro" price="$49" sub="per month, cancel anytime" items={PRO} cta={<Button asChild variant="gold" size="lg" className="w-full"><Link href="/login?next=/app/settings?tab=billing">Start with Pro</Link></Button>} />
        </div>
        <p className="mt-8 text-center text-sm text-muted">Payments are handled by Stripe. Cancel in the billing portal and your data stays; Pro features lock until you resubscribe.</p>
      </main>
      <SiteFooter />
    </>
  );
}

function Plan({ name, price, sub, items, cta, featured }: { name: string; price: string; sub: string; items: string[]; cta: React.ReactNode; featured?: boolean }) {
  return (
    <div className={`flex flex-col rounded-3xl border p-8 ${featured ? "border-gold/40 bg-gradient-to-b from-gold/[0.07] to-surface shadow-panel" : "border-line bg-surface"}`}>
      <div className={`text-sm font-medium ${featured ? "text-gold" : "text-muted"}`}>{name}</div>
      <div className="mt-3 flex items-baseline gap-2"><span className="text-5xl font-semibold tracking-tight tabular">{price}</span><span className="text-muted">{sub}</span></div>
      <ul className="mt-8 flex-1 space-y-3">
        {items.map((i) => <li key={i} className="flex gap-3 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-go" />{i}</li>)}
      </ul>
      <div className="mt-8">{cta}</div>
    </div>
  );
}
