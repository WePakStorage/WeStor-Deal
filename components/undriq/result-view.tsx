"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, Copy, Download, ExternalLink, Flame, Info, Lock, Save, ShieldAlert, Trash2, Users } from "lucide-react";
import { Badge, Button, Card, CardHeader, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger, useToast } from "@/components/ui/interactive";
import { NumberInput } from "@/components/ui/number-input";
import { useApp } from "@/components/shell/app-provider";
import { ScoreRing, bandText } from "./score";
import { PropertyRecordPanel } from "./property-record";
import type { PropertyRecord } from "@/lib/integrations/rentcast";
import { cn } from "@/lib/cn";
import { deleteAnalysis, saveNotes, saveOffer, setOfferStatus, setStage } from "@/lib/actions/undriq";
import { ASSETS, PROPERTY_TYPE_LABELS, type AssetClass } from "@/lib/undriq/assets";
import { fmtK, fmtPct, fmtUsd, scoreBand, type Analysis, type DealFacts, type Teaser } from "@/lib/undriq/engine";
import type { BuyerFit } from "@/lib/undriq/match";
import { OFFER_STATUSES, OFFER_TYPES, offerDocs, type OfferTerms, type OfferType } from "@/lib/undriq/offers";
import { ANALYSIS_STAGES, ANALYSIS_STAGE_LABEL, type AnalysisStage, type Memo, type Motivation, type SavedOffer } from "@/lib/undriq/types";
import { track } from "@/components/analytics";

interface RowLite {
  id: string;
  name: string;
  asset: AssetClass;
  type: string;
  city: string | null;
  state: string | null;
  link: string | null;
  stage: AnalysisStage;
  notes: string;
  createdAt: string;
  offers: SavedOffer[];
}

export function ResultView(p: {
  row: RowLite;
  facts: DealFacts;
  teaser: Teaser;
  full: Analysis | null;
  memo: Memo | null;
  motivation: Motivation | null;
  buyers: BuyerFit[];
  offerDefaults: OfferTerms | null;
  customRules: boolean;
  records: PropertyRecord | null;
  /** Scout's free, fully unlocked first analysis. */
  sample: boolean;
}) {
  const { row, facts, teaser, full, memo } = p;
  const { openUpgrade } = useApp();
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = React.useTransition();
  const band = scoreBand(teaser.score);
  const loc = [row.city, row.state].filter(Boolean).join(", ");

  const changeStage = (s: string) =>
    start(async () => {
      const r = await setStage(row.id, s);
      if (!r.ok) return r.status === 402 ? openUpgrade(r.error) : toast(r.error, "error");
      toast(`Moved to ${ANALYSIS_STAGE_LABEL[s as AnalysisStage]}`);
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      if (!window.confirm(`Delete ${row.name}? This can't be undone.`)) return;
      const r = await deleteAnalysis(row.id);
      if (!r.ok) return toast(r.error, "error");
      toast("Deal deleted");
      router.push("/app");
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={full && !p.sample ? "/app/pipeline" : "/app"} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
          <ArrowLeft className="size-4" /> {full && !p.sample ? "Pipeline" : "Analyze"}
        </Link>
        <div className="flex items-center gap-2">
          {full && !p.sample ? (
            <Select aria-label="Stage" className="h-9 w-44" value={row.stage} onChange={(e) => changeStage(e.target.value)} disabled={pending}>
              {ANALYSIS_STAGES.map((s) => <option key={s} value={s}>{ANALYSIS_STAGE_LABEL[s]}</option>)}
            </Select>
          ) : null}
          <Button variant="ghost" size="icon" aria-label="Delete deal" onClick={remove} disabled={pending}><Trash2 /></Button>
        </div>
      </div>

      {p.sample ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-text bg-text px-5 py-4 text-ink sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Your first analysis is on us: fully unlocked.</div>
            <p className="text-sm opacity-75">This is what every deal looks like on a paid plan, plus saving to your pipeline and sending offers. Try Investor free for 7 days.</p>
          </div>
          <Button className="!bg-ink !text-text" onClick={() => openUpgrade("Get the full analysis on every deal, save your pipeline and send offers.")}>Start free trial</Button>
        </div>
      ) : null}

      {memo?.problem ? (
        <div role="alert" className="flex gap-3 rounded-2xl border border-amber/40 bg-amber/10 px-5 py-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" />
          <div>
            <div className="font-medium">SI didn&apos;t run on this deal, so these results come from the basic reader.</div>
            <p className="mt-0.5 text-muted">{memo.problem}</p>
          </div>
        </div>
      ) : null}

      {/* Hero */}
      <Card className="p-5 sm:p-7">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <ScoreRing score={teaser.score} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>{ASSETS[row.asset].label}</span>
              <span>·</span>
              <span>{PROPERTY_TYPE_LABELS[row.type] ?? row.type}</span>
              {loc ? <><span>·</span><span>{loc}</span></> : null}
              {row.link ? (
                <a href={row.link} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 hover:text-text">
                  · Listing <ExternalLink className="size-3" />
                </a>
              ) : null}
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{row.name}</h1>
            <div className={cn("mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium", band === "go" ? "border-go/30 bg-go/10 text-go" : band === "amber" ? "border-amber/30 bg-amber/10 text-amber" : "border-stop/30 bg-stop/10 text-stop")}>
              {teaser.verdict.text}
            </div>
            {memo?.headline ? <p className="mt-3 max-w-3xl text-[15px] leading-relaxed">{memo.headline}</p> : null}
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line-soft pt-5 sm:grid-cols-4">
          <Kv label="Asking" value={fmtK(facts.list)} />
          <Kv label={full?.estimated ? "NOI (estimated)" : "NOI"} value={fmtK(teaser.noi)} />
          <Kv label="Best exit" value={teaser.best?.name ?? "—"} sub={teaser.best ? `${teaser.best.metric}` : undefined} />
          <Kv label={full ? "Cap rate at asking" : "Red flags"} value={full ? fmtPct(full.atAsking?.cap ?? null) : String(teaser.flagsCount)} sub={full?.atAsking ? `${Number.isFinite(full.atAsking.dscr) ? full.atAsking.dscr.toFixed(2) : "—"}x DSCR` : undefined} />
        </dl>
      </Card>

      {p.records ? (
        <Card>
          <CardHeader title="Property records" description={p.records.address} />
          <PropertyRecordPanel record={p.records} />
        </Card>
      ) : null}

      {!full ? <LockedPreview onUpgrade={() => openUpgrade("Unlock the exit matrix, offer ladder, stress test, memo and the offer generator for this deal.")} /> : (
        <>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader title="Exit Strategy Matrix" description={`Five ways to make money on this deal, ranked.${p.customRules ? " Scored with your buy box rules." : ""}`} />
              <ul className="divide-y divide-line-soft">
                {full.exits.map((x, i) => (
                  <li key={x.key} className="flex items-start gap-4 px-5 py-4">
                    <span className={cn("mt-0.5 w-9 shrink-0 text-right text-lg font-semibold tabular", bandText[scoreBand(x.score)])}>{x.score}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{x.name}</span>
                        {i === 0 ? <Badge tone="neutral">Best</Badge> : null}
                      </div>
                      <div className="mt-0.5 text-sm">{x.metric} <span className="text-muted">· {x.sub}</span></div>
                      <div className="mt-0.5 text-xs text-muted">{x.note}</div>
                    </div>
                    {x.maxPrice ? <div className="shrink-0 text-right text-xs text-muted">Max<div className="text-sm font-medium tabular text-text">{fmtK(x.maxPrice)}</div></div> : null}
                  </li>
                ))}
                {!full.exits.length ? <li className="px-5 py-6 text-sm text-muted">Add the price and rent or NOI to score exits.</li> : null}
              </ul>
            </Card>
            <div className="space-y-6">
              <Card>
                <CardHeader title="Offer Ladder" description="Open low, land in the middle, never pass the walk-away." />
                {full.ladder ? (
                  <div className="grid grid-cols-3 divide-x divide-line-soft">
                    {full.ladder.map((l) => (
                      <div key={l.rung} className="px-4 py-4">
                        <div className="text-xs uppercase tracking-wider text-muted">{l.rung}</div>
                        <div className="display mt-1 text-3xl tabular">{fmtK(l.price)}</div>
                        <p className="mt-1 text-xs leading-relaxed text-muted">{l.why}</p>
                      </div>
                    ))}
                  </div>
                ) : <p className="px-5 py-6 text-sm text-muted">Add an asking price to build the ladder.</p>}
              </Card>
              <Card>
                <CardHeader title="Stress Test" description={full.stress ? `Break-even occupancy ${fmtPct(full.stress.breakEven, 0)} at the target price.` : "Needs income and expenses."} />
                {full.stress ? (
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-line-soft">
                      {full.stress.rows.map((r) => (
                        <tr key={r.label}>
                          <td className="px-5 py-2.5">{r.label}</td>
                          <td className={cn("px-3 py-2.5 text-right tabular", r.dscr >= 1.25 ? "text-go" : r.dscr >= 1 ? "text-amber" : "text-stop")}>{Number.isFinite(r.dscr) ? `${r.dscr.toFixed(2)}x` : "—"}</td>
                          <td className="px-5 py-2.5 text-right tabular text-muted">{fmtUsd(r.cf / 12)}/mo</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className="px-5 py-6 text-sm text-muted">Add rent or NOI to stress test this deal.</p>}
              </Card>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Analyst memo" description="Written from the computed numbers above. Argues against the deal where it's weak." />
              <div className="grid gap-6 p-5 sm:grid-cols-2">
                <ListBlock title="Why it works" items={memo?.thesis ?? []} />
                <ListBlock title="Risks" items={memo?.risks ?? []} />
                <ListBlock title="Devil's advocate: how this fails" items={memo?.killers ?? []} icon={<ShieldAlert className="size-4" />} />
                <ListBlock title="Must be true" items={memo?.mustBeTrue ?? []} />
                <div className="sm:col-span-2"><ListBlock title="Next steps" items={memo?.nextSteps ?? []} ordered /></div>
              </div>
            </Card>
            <div className="space-y-6">
              <Card>
                <CardHeader title="Red flags" />
                <ul className="space-y-2.5 p-5 text-sm">
                  {full.flags.length ? full.flags.map(([lvl, m]) => (
                    <li key={m} className="flex gap-2.5">
                      {lvl === "warn" ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" /> : <Info className="mt-0.5 size-4 shrink-0 text-muted" />}
                      <span>{m}</span>
                    </li>
                  )) : <li className="text-muted">No red flags in the numbers we have.</li>}
                </ul>
              </Card>
              {p.motivation ? (
                <Card>
                  <CardHeader title="Seller Motivation Decoder" action={<span className="flex items-center gap-1 text-sm font-semibold tabular"><Flame className="size-4" />{p.motivation.score}/10</span>} />
                  <div className="space-y-3 p-5 text-sm">
                    <div className="flex flex-wrap gap-1.5">{p.motivation.signals.map((s) => <Badge key={s}>{s}</Badge>)}</div>
                    {p.motivation.leverage ? <p className="text-muted">{p.motivation.leverage}</p> : null}
                  </div>
                </Card>
              ) : null}
            </div>
          </div>

          {p.offerDefaults ? <OfferBuilder rowId={row.id} facts={facts} noi={full.noi} ladder={full.ladder} initial={p.offerDefaults} script={memo?.offerScript ?? ""} /> : null}
          <OfferHistory rowId={row.id} offers={row.offers} />

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Buyers who fit" description="From this space's buyer list." action={<Link href="/app/buyers" className="text-xs text-muted hover:text-text">Buyers</Link>} />
              {p.buyers.length ? (
                <ul className="divide-y divide-line-soft">
                  {p.buyers.map((b) => (
                    <li key={b.buyerId} className="flex items-start gap-3 px-5 py-3">
                      <span className="w-8 shrink-0 text-right font-semibold tabular">{b.score}</span>
                      <div className="min-w-0 flex-1 text-sm">
                        <div className="font-medium">{b.firm}</div>
                        <div className="text-xs text-muted">{b.yes.join(" · ")}</div>
                      </div>
                      {b.email ? <a className="text-xs text-muted hover:text-text" href={`mailto:${b.email}?subject=${encodeURIComponent(`Off-market: ${row.name}`)}`}>Email</a> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex items-center gap-3 px-5 py-6 text-sm text-muted"><Users className="size-4" /> No strong fits yet. Add buyers and their buy boxes.</div>
              )}
            </Card>
            <Notes rowId={row.id} initial={row.notes} />
          </div>
        </>
      )}
    </div>
  );
}

function Kv({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-lg font-semibold tracking-tight tabular">{value}</dd>
      {sub ? <dd className="truncate text-xs text-muted">{sub}</dd> : null}
    </div>
  );
}

function ListBlock({ title, items, icon, ordered }: { title: string; items: string[]; icon?: React.ReactNode; ordered?: boolean }) {
  if (!items.length) return null;
  const L = ordered ? "ol" : "ul";
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">{icon}{title}</div>
      <L className={cn("space-y-1.5 text-sm text-muted", ordered ? "list-decimal pl-5" : "")}>
        {items.map((t) => <li key={t} className={ordered ? "" : "flex gap-2"}>{!ordered ? <span className="mt-2 size-1 shrink-0 rounded-full bg-muted" /> : null}<span>{t}</span></li>)}
      </L>
    </div>
  );
}

function LockedPreview({ onUpgrade }: { onUpgrade: () => void }) {
  // Placeholder shapes only: the real numbers never reach a Scout browser.
  return (
    <Card className="relative overflow-hidden">
      <div className="locked-blur grid gap-4 p-6 sm:grid-cols-3" aria-hidden>
        {["Exit Strategy Matrix", "Offer Ladder", "Stress Test"].map((t) => (
          <div key={t} className="rounded-xl border border-line p-4">
            <div className="text-sm font-medium">{t}</div>
            {[1, 2, 3, 4].map((i) => <div key={i} className="mt-3 h-3 rounded bg-raised" style={{ width: `${90 - i * 12}%` }} />)}
          </div>
        ))}
      </div>
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="max-w-md rounded-2xl border border-line bg-surface/95 p-6 text-center shadow-panel backdrop-blur">
          <Lock className="mx-auto size-5" />
          <div className="mt-2 font-semibold">See the full analysis</div>
          <p className="mt-1 text-sm text-muted">Exit matrix across five strategies, your anchor, target and walk-away prices, a stress test, the analyst memo and a ready-to-send offer.</p>
          <Button className="mt-4" onClick={onUpgrade}>See plans</Button>
        </div>
      </div>
    </Card>
  );
}

function Notes({ rowId, initial }: { rowId: string; initial: string }) {
  const [v, setV] = React.useState(initial);
  const [saved, setSaved] = React.useState(true);
  const toast = useToast();
  return (
    <Card>
      <CardHeader title="Notes" description="Visible to everyone in this space." />
      <div className="p-5">
        <Textarea rows={6} value={v} onChange={(e) => { setV(e.target.value); setSaved(false); }} placeholder="Calls, counters, what the seller said…" />
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="secondary" disabled={saved} onClick={async () => {
            const r = await saveNotes(rowId, v);
            if (!r.ok) return toast(r.error, "error");
            setSaved(true);
            toast("Notes saved");
          }}><Save /> {saved ? "Saved" : "Save notes"}</Button>
        </div>
      </div>
    </Card>
  );
}

const r1k = (v: number) => Math.round(v / 1000) * 1000;

function OfferBuilder({ rowId, facts, noi, ladder, initial, script }: { rowId: string; facts: DealFacts; noi: number | null; ladder: Analysis["ladder"]; initial: OfferTerms; script: string }) {
  const [t, setT] = React.useState<OfferTerms>(() => {
    try {
      const me = JSON.parse(localStorage.getItem("undriq-me") ?? "{}") as Partial<OfferTerms>;
      return { ...initial, buyer: me.buyer || initial.buyer, entity: me.entity || "", phone: me.phone || "", email: me.email || initial.email };
    } catch {
      return initial;
    }
  });
  const [busy, setBusy] = React.useState(false);
  const toast = useToast();
  const router = useRouter();
  const { openUpgrade } = useApp();
  const docs = offerDocs(t, facts, noi);
  const resi = facts.asset === "residential";
  const set = <K extends keyof OfferTerms>(k: K, v: OfferTerms[K]) => setT((x) => ({ ...x, [k]: v }));
  const copy = async (s: string) => {
    try {
      await navigator.clipboard.writeText(s);
      toast("Copied");
    } catch {
      toast("Select the text to copy it.", "error");
    }
  };
  const download = () => {
    const esc = (l: string) => l.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const html = `<html><head><meta charset="utf-8"><title>Letter of intent</title></head><body style="font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.5">${docs.letter.split("\n").map((l) => (l ? `<p style="margin:0 0 6pt">${esc(l)}</p>` : "<p>&nbsp;</p>")).join("")}</body></html>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "application/msword" }));
    a.download = `Offer - ${(t.property || "deal").split(",")[0]!.replace(/[^\w\s-]/g, "").trim() || "deal"}.doc`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  const save = async () => {
    setBusy(true);
    try {
      localStorage.setItem("undriq-me", JSON.stringify({ buyer: t.buyer, entity: t.entity, phone: t.phone, email: t.email }));
    } catch {
      /* private mode: fine */
    }
    const r = await saveOffer(rowId, t);
    setBusy(false);
    if (!r.ok) return r.status === 402 ? openUpgrade(r.error) : toast(r.error, "error");
    track("offer_saved", { type: t.type });
    toast("Offer saved to this deal");
    router.refresh();
  };

  return (
    <Card id="offer">
      <CardHeader title="Make your offer" description="Pick a rung, set the terms, then copy, download or save. The letter updates as you type." action={<Badge>{OFFER_TYPES[t.type]}</Badge>} />
      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-5">
          {ladder ? (
            <div className="grid grid-cols-3 gap-2">
              {ladder.map((l) => (
                <button key={l.rung} type="button" onClick={() => setT({ ...t, rung: l.rung, price: l.price, emd: Math.max(resi ? 1000 : 5000, r1k(l.price * 0.01)) })}
                  className={cn("rounded-xl border px-3 py-2.5 text-left transition", t.rung === l.rung && t.price === l.price ? "border-text bg-text text-ink" : "border-line hover:border-muted")}>
                  <div className="text-[11px] uppercase tracking-wider opacity-70">{l.rung}</div>
                  <div className="font-semibold tabular">{fmtK(l.price)}</div>
                </button>
              ))}
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Offer price" htmlFor="o-price"><NumberInput id="o-price" prefix="$" value={t.price} onChange={(v) => setT({ ...t, price: v ?? 0, rung: "Custom" })} /></Field>
            <Field label="Offer type" htmlFor="o-type">
              <Select id="o-type" value={t.type} onChange={(e) => set("type", e.target.value as OfferType)}>
                {Object.entries(OFFER_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Earnest money" htmlFor="o-emd"><NumberInput id="o-emd" prefix="$" value={t.emd} onChange={(v) => set("emd", v ?? 0)} /></Field>
            <Field label="Inspection days" htmlFor="o-insp"><NumberInput id="o-insp" value={t.inspect} onChange={(v) => set("inspect", Math.round(v ?? 0))} /></Field>
            <Field label="Close within (days)" htmlFor="o-close"><NumberInput id="o-close" value={t.close} onChange={(v) => set("close", Math.max(1, Math.round(v ?? 1)))} /></Field>
            <Field label="Offer expires (hours)" htmlFor="o-exp"><NumberInput id="o-exp" value={t.expires} onChange={(v) => set("expires", Math.max(1, Math.round(v ?? 1)))} /></Field>
            {t.type === "seller" ? (
              <>
                <Field label="Down payment" htmlFor="o-down"><NumberInput id="o-down" suffix="%" value={Math.round(t.down * 100)} onChange={(v) => set("down", Math.min(1, (v ?? 0) / 100))} /></Field>
                <Field label="Interest rate" htmlFor="o-rate"><NumberInput id="o-rate" suffix="%" decimals={2} value={+(t.rate * 100).toFixed(2)} onChange={(v) => set("rate", Math.min(0.3, (v ?? 0) / 100))} /></Field>
                <Field label="Amortization (years)" htmlFor="o-yrs"><NumberInput id="o-yrs" value={t.years} onChange={(v) => set("years", Math.max(1, Math.round(v ?? 30)))} /></Field>
                <Field label="Balloon (years)" htmlFor="o-bal"><NumberInput id="o-bal" value={t.balloon} onChange={(v) => set("balloon", Math.max(1, Math.round(v ?? 5)))} /></Field>
              </>
            ) : null}
            <Field label="Closing costs" htmlFor="o-costs">
              <Select id="o-costs" value={t.costs} onChange={(e) => set("costs", e.target.value as OfferTerms["costs"])}>
                <option value="each">Each party pays its own</option>
                <option value="buyer">Buyer pays all</option>
              </Select>
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={t.asIs} onChange={(e) => set("asIs", e.target.checked)} /> As-is condition</label>
          </div>
          <div className="grid gap-4 border-t border-line-soft pt-4 sm:grid-cols-2">
            <Field label="Send to" htmlFor="o-to"><Input id="o-to" placeholder="Listing agent or seller" value={t.recipient} onChange={(e) => set("recipient", e.target.value)} /></Field>
            <Field label="Property" htmlFor="o-prop"><Input id="o-prop" value={t.property} onChange={(e) => set("property", e.target.value)} /></Field>
            <Field label="Your name" htmlFor="o-buyer"><Input id="o-buyer" value={t.buyer} onChange={(e) => set("buyer", e.target.value)} /></Field>
            <Field label="Buying entity" htmlFor="o-ent"><Input id="o-ent" placeholder="Acme Holdings LLC" value={t.entity} onChange={(e) => set("entity", e.target.value)} /></Field>
            <Field label="Phone" htmlFor="o-ph"><Input id="o-ph" value={t.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
            <Field label="Email" htmlFor="o-em"><Input id="o-em" value={t.email} onChange={(e) => set("email", e.target.value)} /></Field>
          </div>
        </div>
        <div className="min-w-0">
          <Tabs defaultValue="letter">
            <TabsList>
              <TabsTrigger value="letter">Letter of intent</TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="text">Text</TabsTrigger>
              {script ? <TabsTrigger value="script">Call script</TabsTrigger> : null}
            </TabsList>
            {(["letter", "email", "text"] as const).map((k) => (
              <TabsContent key={k} value={k}>
                <pre className="max-h-[440px] overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-raised/50 p-4 font-sans text-sm leading-relaxed">{docs[k]}</pre>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => copy(docs[k])}><Copy /> Copy</Button>
                  {k === "letter" ? <Button size="sm" variant="secondary" onClick={download}><Download /> Download .doc</Button> : null}
                </div>
              </TabsContent>
            ))}
            {script ? (
              <TabsContent value="script">
                <pre className="whitespace-pre-wrap rounded-xl border border-line bg-raised/50 p-4 font-sans text-sm leading-relaxed">{script}</pre>
                <div className="mt-3"><Button size="sm" variant="secondary" onClick={() => copy(script)}><Copy /> Copy</Button></div>
              </TabsContent>
            ) : null}
          </Tabs>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-line-soft pt-4">
            <p className="text-xs text-muted">Not legal advice. Have your attorney review before you sign anything binding.</p>
            <Button onClick={save} disabled={busy}><Save /> {busy ? "Saving…" : "Save offer"}</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function OfferHistory({ rowId, offers }: { rowId: string; offers: SavedOffer[] }) {
  const toast = useToast();
  const router = useRouter();
  if (!offers.length) return null;
  return (
    <Card>
      <CardHeader title="Offer history" description="Update the status as the seller responds. Accepted moves the deal to Under contract." />
      <ul className="divide-y divide-line-soft">
        {[...offers].reverse().map((o) => (
          <li key={o.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
            <span className="w-24 font-semibold tabular">{fmtK(o.terms.price)}</span>
            <span className="min-w-0 flex-1 text-muted">{OFFER_TYPES[o.terms.type]} · {o.terms.rung} · {new Date(o.at).toLocaleDateString()}</span>
            <Select aria-label="Offer status" className="h-8 w-36" value={o.status} onChange={async (e) => {
              const r = await setOfferStatus(rowId, o.id, e.target.value);
              if (!r.ok) return toast(r.error, "error");
              toast("Offer updated");
              router.refresh();
            }}>
              {OFFER_STATUSES.map((s) => <option key={s} value={s}>{s[0]!.toUpperCase() + s.slice(1)}</option>)}
            </Select>
            {o.status === "accepted" ? <Check className="size-4 text-go" /> : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
