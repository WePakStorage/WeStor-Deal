"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Mail, Phone, Users, X } from "lucide-react";
import { setMatchStatus } from "@/lib/actions/buyers";
import { cn } from "@/lib/cn";
import { isAssignmentDeal, type MatchResult } from "@/lib/matching";
import { BUYER_TYPE_LABEL, type Deal, type MatchStatus } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Select } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/interactive";
import { ProLock } from "@/components/shell/app-provider";
import type { MatchData } from "../deal-view";

const STATUS_LABEL: Record<MatchStatus, string> = { suggested: "Suggested", contacted: "Contacted", interested: "Interested", passed: "Passed" };

export function BuyersTab({ deal, data }: { deal: Deal; data: MatchData | null }) {
  if (!data) {
    return (
      <ProLock feature="Buyer matching">
        <div className="space-y-3">{[92, 78, 64].map((s) => <FakeRow key={s} score={s} />)}</div>
      </ProLock>
    );
  }
  if (data.matches.length + data.directOnly.length === 0) {
    return <EmptyState icon={<Users />} title="No buyers yet" body="Add or import your buyer list and we'll rank them against this deal's buy box." action={<Button asChild><Link href="/app/buyers">Open buyer CRM</Link></Button>} />;
  }
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-semibold tracking-tight">Ranked matches</h2>
          <span className="text-sm text-muted">{isAssignmentDeal(deal) ? "Assignment deal: only buyers who accept assignments" : "Direct purchase"}</span>
        </div>
        <div className="space-y-3">{data.matches.map((m) => <MatchRow key={m.buyer.id} dealId={deal.id} m={m} status={data.status[m.buyer.id] ?? "suggested"} />)}</div>
      </section>
      {data.directOnly.length ? (
        <section>
          <h2 className="mb-1 font-semibold tracking-tight">Direct purchase only</h2>
          <p className="mb-3 text-sm text-muted">These buyers don&apos;t take assignments. Consider them if you close and resell.</p>
          <div className="space-y-3 opacity-80">{data.directOnly.map((m) => <MatchRow key={m.buyer.id} dealId={deal.id} m={m} status={data.status[m.buyer.id] ?? "suggested"} />)}</div>
        </section>
      ) : null}
    </div>
  );
}

function MatchRow({ dealId, m, status }: { dealId: string; m: MatchResult; status: MatchStatus }) {
  const toast = useToast();
  const router = useRouter();
  const [s, setS] = React.useState(status);
  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <Score value={m.score} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{m.buyer.firm_name}</span>
          <Badge>{BUYER_TYPE_LABEL[m.buyer.buyer_type]}</Badge>
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-muted">
          {m.buyer.contact_name ? <span>{m.buyer.contact_name}</span> : null}
          {m.buyer.email ? <a className="inline-flex items-center gap-1 hover:text-text" href={`mailto:${m.buyer.email}`}><Mail className="size-3" />{m.buyer.email}</a> : null}
          {m.buyer.phone ? <span className="inline-flex items-center gap-1"><Phone className="size-3" />{m.buyer.phone}</span> : null}
        </div>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {m.reasons.map((r) => <li key={r} className="inline-flex items-center gap-1 rounded-full bg-go/10 px-2 py-0.5 text-[11.5px] text-go"><Check className="size-3" />{r}</li>)}
          {m.misses.map((r) => <li key={r} className="inline-flex items-center gap-1 rounded-full bg-raised px-2 py-0.5 text-[11.5px] text-muted"><X className="size-3" />{r}</li>)}
        </ul>
      </div>
      <Select
        aria-label={`Status for ${m.buyer.firm_name}`}
        className="h-9 sm:w-36"
        value={s}
        onChange={async (e) => {
          const next = e.target.value as MatchStatus;
          setS(next);
          const res = await setMatchStatus(dealId, m.buyer.id, next);
          if (!res.ok) {
            setS(status);
            return toast(res.error, "error");
          }
          toast(`${m.buyer.firm_name}: ${STATUS_LABEL[next]}`);
          router.refresh();
        }}
      >
        {(Object.keys(STATUS_LABEL) as MatchStatus[]).map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
      </Select>
    </Card>
  );
}

function Score({ value }: { value: number }) {
  const tone = value >= 80 ? "var(--go)" : value >= 60 ? "var(--amber)" : "var(--muted)";
  return (
    <div className="relative grid size-14 shrink-0 place-items-center" aria-label={`Match score ${value} of 100`}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--raised)" strokeWidth="3" />
        <circle cx="18" cy="18" r="15.5" fill="none" stroke={tone} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(value / 100) * 97.4} 97.4`} />
      </svg>
      <span className="text-sm font-semibold tabular">{value}</span>
    </div>
  );
}

function FakeRow({ score }: { score: number }) {
  return (
    <Card className={cn("flex items-center gap-4 p-4")}>
      <Score value={score} />
      <div className="flex-1">
        <div className="font-medium">Regional storage operator</div>
        <div className="mt-2 flex gap-1.5"><span className="rounded-full bg-go/10 px-2 py-0.5 text-[11.5px] text-go">Buys in your state</span><span className="rounded-full bg-go/10 px-2 py-0.5 text-[11.5px] text-go">Price fits</span></div>
      </div>
    </Card>
  );
}
