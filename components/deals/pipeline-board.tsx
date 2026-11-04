"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { GripVertical, SlidersHorizontal, X } from "lucide-react";
import { moveStage } from "@/lib/actions/deals";
import { cn } from "@/lib/cn";
import { compactMoney, num, pct } from "@/lib/format";
import { PROPERTY_TYPE_LABEL, PROPERTY_TYPES, STAGE_LABEL, STAGES, type DealSummary, type PropertyType, type Stage } from "@/lib/types";
import { capRate } from "@/lib/underwriting";
import { Badge, Input, Select } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/interactive";
import { ContractModal, type ContractValues } from "./contract-modal";

const STAGE_DOT: Record<Stage, string> = {
  sourced: "bg-muted",
  underwriting: "bg-door",
  negotiating: "bg-amber",
  under_contract: "bg-gold",
  assigned: "bg-go",
  closed: "bg-go",
  dead: "bg-stop/70",
};

export function PipelineBoard({ deals: initial }: { deals: DealSummary[] }) {
  const [deals, setDeals] = React.useState(initial);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<{ deal: DealSummary; to: Stage } | null>(null);
  const [modalError, setModalError] = React.useState<string | null>(null);
  const [f, setF] = React.useState({ state: "", type: "" as PropertyType | "", stage: "" as Stage | "", min: "", max: "" });
  const toast = useToast();
  const router = useRouter();

  React.useEffect(() => setDeals(initial), [initial]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const states = Array.from(new Set(initial.map((d) => d.market_state))).sort();

  const visible = deals.filter((d) => {
    const price = d.target_price ?? d.list_price ?? 0;
    if (f.state && d.market_state !== f.state) return false;
    if (f.type && d.property_type !== f.type) return false;
    if (f.min && price < Number(f.min) * 1000) return false;
    if (f.max && price > Number(f.max) * 1000) return false;
    return true;
  });
  const columns = f.stage ? [f.stage] : STAGES;
  const filtered = Boolean(f.state || f.type || f.stage || f.min || f.max);

  async function commit(deal: DealSummary, to: Stage, contract?: ContractValues) {
    if (deal.stage === to) return;
    const prev = deals;
    setDeals((ds) => ds.map((d) => (d.id === deal.id ? { ...d, stage: to, ...(contract ?? {}) } : d)));
    const res = await moveStage(deal.id, to, contract);
    if (!res.ok) {
      setDeals(prev);
      if (res.status === 422 && !contract) {
        setModalError(null);
        setPending({ deal, to });
        return;
      }
      if (contract) {
        setModalError(res.error);
        return;
      }
      toast(res.error, "error");
      return;
    }
    setPending(null);
    toast(`${deal.name} moved to ${STAGE_LABEL[to]}`);
    router.refresh();
  }

  function onDragEnd(e: DragEndEvent) {
    setDragId(null);
    const deal = deals.find((d) => d.id === e.active.id);
    const to = e.over?.id as Stage | undefined;
    if (deal && to) void commit(deal, to);
  }

  const dragDeal = deals.find((d) => d.id === dragId);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="mr-1 flex items-center gap-1.5 text-sm text-muted">
          <SlidersHorizontal className="size-4" /> Filter
        </span>
        <Select aria-label="State" className="h-9 w-auto min-w-28" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })}>
          <option value="">All states</option>
          {states.map((s) => <option key={s}>{s}</option>)}
        </Select>
        <Select aria-label="Stage" className="h-9 w-auto min-w-36" value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value as Stage })}>
          <option value="">All stages</option>
          {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
        </Select>
        <Select aria-label="Property type" className="h-9 w-auto min-w-40" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as PropertyType })}>
          <option value="">All property types</option>
          {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{PROPERTY_TYPE_LABEL[t]}</option>)}
        </Select>
        <div className="flex items-center gap-1.5">
          <Input aria-label="Minimum price in thousands" className="h-9 w-24" inputMode="numeric" placeholder="Min $K" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value.replace(/\D/g, "") })} />
          <span className="text-muted">–</span>
          <Input aria-label="Maximum price in thousands" className="h-9 w-24" inputMode="numeric" placeholder="Max $K" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value.replace(/\D/g, "") })} />
        </div>
        {filtered ? (
          <button className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted hover:text-text" onClick={() => setF({ state: "", type: "", stage: "", min: "", max: "" })}>
            <X className="size-3.5" /> Clear
          </button>
        ) : null}
      </div>

      <DndContext sensors={sensors} onDragStart={(e) => setDragId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          {columns.map((stage) => {
            const col = visible.filter((d) => d.stage === stage);
            const total = col.reduce((s, d) => s + (d.target_price ?? d.list_price ?? 0), 0);
            return (
              <Column key={stage} stage={stage} count={col.length} total={total}>
                {col.map((d) => (
                  <DealCard key={d.id} deal={d} onMove={(to) => void commit(d, to)} dragging={dragId === d.id} />
                ))}
                {col.length === 0 ? <div className="rounded-xl border border-dashed border-line-soft px-3 py-6 text-center text-xs text-muted">Drop a deal here</div> : null}
              </Column>
            );
          })}
        </div>
        <DragOverlay dropAnimation={null}>{dragDeal ? <CardBody deal={dragDeal} overlay /> : null}</DragOverlay>
      </DndContext>

      {pending ? (
        <ContractModal
          open
          onOpenChange={(o) => !o && setPending(null)}
          dealName={pending.deal.name}
          stage={pending.to}
          defaultPrice={pending.deal.target_price}
          error={modalError}
          onSubmit={(v) => commit(pending.deal, pending.to, v)}
        />
      ) : null}
    </div>
  );
}

function Column({ stage, count, total, children }: { stage: Stage; count: number; total: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${STAGE_LABEL[stage]} column`}
      className={cn(
        "flex w-[272px] shrink-0 snap-start flex-col rounded-2xl border bg-surface/50 p-2.5 transition-colors",
        isOver ? "border-door/60 bg-door/[0.04]" : "border-line-soft",
      )}
    >
      <header className="flex items-center justify-between px-1.5 pb-2.5 pt-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className={cn("size-2 rounded-full", STAGE_DOT[stage])} />
          {STAGE_LABEL[stage]}
          <span className="text-muted">{count}</span>
        </div>
        <span className="text-xs text-muted tabular">{total ? compactMoney(total) : ""}</span>
      </header>
      <div className="flex min-h-24 flex-col gap-2">{children}</div>
    </section>
  );
}

function DealCard({ deal, onMove, dragging }: { deal: DealSummary; onMove: (to: Stage) => void; dragging: boolean }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: deal.id });
  return (
    <div ref={setNodeRef} className={cn("group relative", dragging && "opacity-30")}>
      <CardBody deal={deal} handle={<button {...listeners} {...attributes} aria-label={`Drag ${deal.name}`} className="cursor-grab touch-none rounded p-0.5 text-muted/60 hover:text-text active:cursor-grabbing"><GripVertical className="size-4" /></button>} />
      <label className="sr-only" htmlFor={`stage-${deal.id}`}>Move {deal.name} to stage</label>
      <select
        id={`stage-${deal.id}`}
        value={deal.stage}
        onChange={(e) => onMove(e.target.value as Stage)}
        className="absolute bottom-2.5 right-2.5 h-7 rounded-md border border-line bg-raised px-1.5 text-[11px] text-muted opacity-0 transition focus:opacity-100 group-hover:opacity-100"
      >
        {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
      </select>
    </div>
  );
}

function CardBody({ deal, handle, overlay }: { deal: DealSummary; handle?: React.ReactNode; overlay?: boolean }) {
  const price = deal.target_price ?? deal.list_price;
  const noi = deal.noi.t12 ?? deal.noi.actual_year;
  const cap = noi && price ? capRate(noi, price) : null;
  return (
    <div className={cn("rounded-xl border border-line bg-raised p-3.5 transition-shadow hover:border-muted/40", overlay && "rotate-[1.5deg] shadow-2xl ring-1 ring-door/40")}>
      <div className="flex items-start gap-1.5">
        <Link href={`/app/deals/${deal.id}`} className="min-w-0 flex-1 text-sm font-medium leading-snug hover:text-door">
          {deal.name}
        </Link>
        {handle}
      </div>
      <div className="mt-0.5 text-xs text-muted">
        {deal.market_city}, {deal.market_state}
        {deal.is_sample ? <span className="ml-1.5 text-muted/70">· Sample</span> : null}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <div className="text-[15px] font-semibold tracking-tight tabular">{compactMoney(price)}</div>
          <div className="text-[11px] text-muted tabular">
            {num(deal.units)} units · {num(deal.nrsf)} SF
          </div>
        </div>
        {cap !== null ? <Badge tone={cap >= 0.08 ? "go" : cap >= 0.065 ? "amber" : "stop"} className="tabular">{pct(cap)} cap</Badge> : null}
      </div>
    </div>
  );
}
