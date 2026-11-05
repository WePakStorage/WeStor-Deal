"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity as ActivityIcon, ArrowLeft, Calculator, FileText, LayoutGrid, ListChecks, Users } from "lucide-react";
import { moveStage } from "@/lib/actions/deals";
import { num, pct } from "@/lib/format";
import type { MatchResult } from "@/lib/matching";
import { PROPERTY_TYPE_LABEL, STAGE_LABEL, STAGES, type DealBundle, type MatchStatus, type Stage, type UnderwritingDefaults } from "@/lib/types";
import { Badge, Select } from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger, useToast } from "@/components/ui/interactive";
import { ProLock } from "@/components/shell/app-provider";
import { ContractModal, type ContractValues } from "./contract-modal";
import { UnderwritingWorkspace } from "./underwriting";
import { OverviewTab } from "./tabs/overview";
import { BuyersTab } from "./tabs/buyers";
import { DocumentsTab } from "./tabs/documents";
import { TasksTab } from "./tabs/tasks";
import { ActivityTab } from "./tabs/activity";

export interface MatchData {
  matches: MatchResult[];
  directOnly: MatchResult[];
  status: Record<string, MatchStatus>;
}

export function DealView({ bundle, defaults, matches, omGate, initialTab }: {
  bundle: DealBundle;
  defaults: UnderwritingDefaults;
  matches: MatchData | null;
  omGate: { ok: true } | { ok: false; reason: string };
  initialTab: string;
}) {
  const { deal } = bundle;
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState<Stage | null>(null);
  const [modalError, setModalError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState(initialTab);

  async function changeStage(to: Stage, contract?: ContractValues) {
    const res = await moveStage(deal.id, to, contract);
    if (!res.ok) {
      if (res.status === 422 && !contract) {
        setModalError(null);
        setPending(to);
      } else if (contract) setModalError(res.error);
      else toast(res.error, "error");
      return;
    }
    setPending(null);
    toast(`Moved to ${STAGE_LABEL[to]}`);
    router.refresh();
  }

  const facts = [
    deal.units ? `${num(deal.units)} units` : null,
    deal.nrsf ? `${num(deal.nrsf)} NRSF` : null,
    deal.acres ? `${deal.acres} acres` : null,
    deal.year_built ? `Built ${deal.year_built}` : null,
    deal.physical_occupancy !== null ? `${pct(deal.physical_occupancy, 0)} occupied` : null,
  ].filter(Boolean);

  return (
    <>
      <Link href="/app/storage" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft className="size-4" /> Storage pipeline
      </Link>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight">{deal.name}</h1>
            {deal.is_sample ? <Badge>Sample</Badge> : null}
          </div>
          <p className="mt-1 text-muted">
            {[deal.market_city, deal.market_state].filter(Boolean).join(", ") || "Market not set"} · {PROPERTY_TYPE_LABEL[deal.property_type]}
          </p>
          {facts.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {facts.map((f) => <li key={f} className="rounded-full border border-line bg-surface px-3 py-1 text-[13px] tabular">{f}</li>)}
            </ul>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <label htmlFor="stage" className="text-xs text-muted">Stage</label>
          <Select id="stage" className="w-48" value={deal.stage} onChange={(e) => void changeStage(e.target.value as Stage)}>
            {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
          </Select>
          {deal.contract_signed_at ? <span className="text-xs text-muted">Contract signed {deal.contract_signed_at}{deal.assignable ? " · assignable" : ""}</span> : null}
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview"><LayoutGrid /> Overview</TabsTrigger>
          <TabsTrigger value="underwriting"><Calculator /> Underwriting</TabsTrigger>
          <TabsTrigger value="buyers"><Users /> Buyers</TabsTrigger>
          <TabsTrigger value="documents"><FileText /> Documents</TabsTrigger>
          <TabsTrigger value="tasks"><ListChecks /> Tasks{bundle.tasks.filter((t) => !t.done).length ? <span className="text-xs text-muted">{bundle.tasks.filter((t) => !t.done).length}</span> : null}</TabsTrigger>
          <TabsTrigger value="activity"><ActivityIcon /> Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab bundle={bundle} onUnderwrite={() => setTab("underwriting")} /></TabsContent>
        <TabsContent value="underwriting">
          <ProLock feature="Live underwriting">
            <UnderwritingWorkspace deal={deal} financials={bundle.financials} defaults={defaults} />
          </ProLock>
        </TabsContent>
        <TabsContent value="buyers"><BuyersTab deal={deal} data={matches} /></TabsContent>
        <TabsContent value="documents"><DocumentsTab bundle={bundle} omGate={omGate} /></TabsContent>
        <TabsContent value="tasks"><TasksTab dealId={deal.id} tasks={bundle.tasks} /></TabsContent>
        <TabsContent value="activity"><ActivityTab activity={bundle.activity} /></TabsContent>
      </Tabs>

      {pending ? (
        <ContractModal open onOpenChange={(o) => !o && setPending(null)} dealName={deal.name} stage={pending} defaultPrice={deal.target_price} error={modalError} onSubmit={(v) => changeStage(pending, v)} />
      ) : null}
    </>
  );
}
