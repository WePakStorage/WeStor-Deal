import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { PlanCards } from "@/components/marketing/plan-cards";

export const metadata = { title: "Pricing" };

export default function Pricing() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 sm:py-24">
        <div className="text-center">
          <h1 className="display text-5xl sm:text-6xl">Simple pricing</h1>
          <p className="mt-4 text-lg text-muted">Start with 2 free analyses. Upgrade when you&apos;re making offers every week.</p>
        </div>
        <div className="mt-14"><PlanCards /></div>
        <div className="mx-auto mt-12 grid max-w-4xl gap-6 text-sm text-muted sm:grid-cols-2">
          <p><span className="font-medium text-text">Private by default.</span> Every account has its own pipeline and buyer list that nobody else can see.</p>
          <p><span className="font-medium text-text">Teams on Firm and Fund.</span> The owner&apos;s plan powers the team space: 5 people on Firm, 15 on Fund. Members don&apos;t need their own paid plan.</p>
          <p><span className="font-medium text-text">Billing by Stripe.</span> Change or cancel any time from Billing. Your data stays; paid features lock until you resubscribe.</p>
          <p><span className="font-medium text-text">Fair use on Fund.</span> Up to 1,000 AI analyses a month. The bulk analyzer doesn&apos;t count against it.</p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
