import Link from "next/link";
import { ArrowRight, Lock, ShieldCheck, Users } from "lucide-react";
import { AnalyzeForm } from "@/components/undriq/analyze-form";
import { CheckoutNotice } from "@/components/undriq/checkout-notice";
import { effectivePlan } from "@/lib/billing/plans";
import { ScoreDot } from "@/components/undriq/score";
import { Card, CardHeader } from "@/components/ui/primitives";
import { timeAgo } from "@/lib/format";
import { requireContext } from "@/lib/server/context";
import { ASSETS } from "@/lib/undriq/assets";
import { quotaFor } from "@/lib/undriq/service";
import { isRentcastConfigured } from "@/lib/integrations/lookup-service";
import { ANALYSIS_STAGE_LABEL } from "@/lib/undriq/types";

export const metadata = { title: "Analyze a deal" };

export default async function AnalyzePage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const { checkout } = await searchParams;
  const ctx = await requireContext();
  const { uq, orgId, user, space, plan } = ctx;
  const [usage, recent, mySub] = await Promise.all([quotaFor(ctx), uq.listAnalyses(orgId), ctx.store.getSubscription(ctx.personalOrgId)]);
  const first = user.name.split(" ")[0];

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        {checkout === "success" || checkout === "pending" || checkout === "cancelled" ? (
          <CheckoutNotice status={checkout} plan={effectivePlan(mySub)} trialing={mySub.status === "trialing"} />
        ) : null}
        <div className="mb-6">
          <p className="text-sm text-muted">Welcome back, {first}</p>
          <h1 className="display mt-1 text-4xl leading-tight sm:text-5xl">Analyze a deal in minutes.</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Paste a listing or upload the OM. UndrIq reads it, runs five exit strategies with real math, stress tests it, and drafts your offer.
          </p>
        </div>
        <Card className="p-5 sm:p-6">
          <AnalyzeForm left={usage.left} lookupEnabled={isRentcastConfigured()} />
        </Card>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
          <ShieldCheck className="size-3.5" /> SI reads the listing and writes the memo; every number is computed by tested code. UndrIq never scrapes listing sites: property data comes from licensed records looked up by address.
        </p>
      </div>

      <aside className="space-y-4">
        <Card>
          <CardHeader
            title={space.kind === "personal" ? "Your private space" : space.name}
            description={space.kind === "personal" ? "Deals and buyers here are visible only to you." : "Shared with your team."}
            action={space.kind === "personal" ? <Lock className="size-4 text-muted" /> : <Users className="size-4 text-muted" />}
          />
          <div className="px-5 py-4 text-sm">
            <div className="flex justify-between"><span className="text-muted">Plan</span><span className="font-medium">{plan.name}</span></div>
            <div className="mt-1.5 flex justify-between">
              <span className="text-muted">{usage.period === "lifetime" ? "Free analyses" : "Analyses this month"}</span>
              <span className="tabular font-medium">{usage.used} / {usage.total.toLocaleString()}</span>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Recent analyses" action={plan.features.pipeline && recent.length ? <Link href="/app/pipeline" className="text-xs text-muted hover:text-text">Pipeline</Link> : null} />
          {recent.length ? (
            <ul className="divide-y divide-line-soft">
              {recent.slice(0, 8).map((a) => (
                <li key={a.id}>
                  <Link href={`/app/analyses/${a.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-raised/50">
                    <ScoreDot score={a.score} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{a.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {ASSETS[a.asset].label} · {ANALYSIS_STAGE_LABEL[a.stage]} · {timeAgo(a.updated_at)}
                      </span>
                    </span>
                    <ArrowRight className="size-4 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-muted">Your analyses show up here. Try a deal you&apos;re looking at this week.</p>
          )}
        </Card>
      </aside>
    </div>
  );
}
