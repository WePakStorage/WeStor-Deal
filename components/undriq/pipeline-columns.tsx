"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setStage } from "@/lib/actions/undriq";
import { ASSETS, type AssetClass } from "@/lib/undriq/assets";
import { fmtK } from "@/lib/undriq/engine";
import { ANALYSIS_STAGES, ANALYSIS_STAGE_LABEL, type AnalysisStage } from "@/lib/undriq/types";
import { useToast } from "@/components/ui/interactive";
import { ScoreDot } from "./score";
import { cn } from "@/lib/cn";

interface CardRow {
  id: string;
  name: string;
  asset: AssetClass;
  city: string | null;
  state: string | null;
  stage: AnalysisStage;
  score: number;
  list: number | null;
  target: number | null;
  offers: number;
  updatedAt: string;
}

export function PipelineColumns({ cards }: { cards: CardRow[] }) {
  const [rows, setRows] = React.useState(cards);
  const [drag, setDrag] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<AnalysisStage | null>(null);
  const router = useRouter();
  const toast = useToast();
  React.useEffect(() => setRows(cards), [cards]);

  const move = async (id: string, stage: AnalysisStage) => {
    const prev = rows;
    setRows((r) => r.map((c) => (c.id === id ? { ...c, stage } : c)));
    const res = await setStage(id, stage);
    if (!res.ok) {
      setRows(prev);
      return toast(res.error, "error");
    }
    router.refresh();
  };

  if (!rows.length) {
    return <p className="rounded-2xl border border-dashed border-line px-6 py-14 text-center text-sm text-muted">No deals yet. Analyze one and it lands here.</p>;
  }
  return (
    <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
      {ANALYSIS_STAGES.map((s) => {
        const col = rows.filter((c) => c.stage === s);
        return (
          <section
            key={s}
            aria-label={ANALYSIS_STAGE_LABEL[s]}
            onDragOver={(e) => { e.preventDefault(); setOver(s); }}
            onDragLeave={() => setOver(null)}
            onDrop={() => { if (drag) void move(drag, s); setDrag(null); setOver(null); }}
            className={cn("flex w-72 shrink-0 snap-start flex-col rounded-2xl border bg-surface/50 p-2", over === s ? "border-text" : "border-line-soft")}
          >
            <header className="flex items-center justify-between px-2 py-2 text-sm font-medium">
              {ANALYSIS_STAGE_LABEL[s]} <span className="tabular text-muted">{col.length}</span>
            </header>
            <div className="flex min-h-20 flex-col gap-2">
              {col.map((c) => (
                <article key={c.id} draggable onDragStart={() => setDrag(c.id)} className="rounded-xl border border-line bg-surface p-3 shadow-panel">
                  <div className="flex items-start gap-3">
                    <ScoreDot score={c.score} className="size-8 text-xs" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/app/analyses/${c.id}`} className="block truncate text-sm font-medium hover:underline">{c.name}</Link>
                      <div className="truncate text-xs text-muted">{ASSETS[c.asset].label}{c.city ? ` · ${c.city}` : ""}{c.state ? `, ${c.state}` : ""}</div>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-xs">
                    <span className="text-muted">Ask {fmtK(c.list)}{c.target ? ` · Target ${fmtK(c.target)}` : ""}</span>
                    {c.offers ? <span>{c.offers} offer{c.offers > 1 ? "s" : ""}</span> : null}
                  </div>
                  <label className="sr-only" htmlFor={`st-${c.id}`}>Stage</label>
                  <select id={`st-${c.id}`} value={c.stage} onChange={(e) => move(c.id, e.target.value as AnalysisStage)} className="mt-2 w-full rounded-md border border-line bg-raised px-2 py-1 text-xs">
                    {ANALYSIS_STAGES.map((x) => <option key={x} value={x}>{ANALYSIS_STAGE_LABEL[x]}</option>)}
                  </select>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
