"use client";

import * as React from "react";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownToLine, Target } from "lucide-react";
import { cn } from "@/lib/cn";
import { compactMoney, money, money2, pct, ratio } from "@/lib/format";
import { PERIOD_LABEL, type Deal, type DealFinancial, type Period, type UnderwritingDefaults } from "@/lib/types";
import { maxOffer, periodNoi, underwrite, type DscrBand } from "@/lib/underwriting";
import { Button, Card } from "@/components/ui/primitives";
import { Segmented, Slider } from "@/components/ui/interactive";
import { NumberInput } from "@/components/ui/number-input";
import { SourceTag } from "./source-tag";

const BAND_TEXT: Record<DscrBand, string> = { go: "text-go", amber: "text-amber", stop: "text-stop" };
const BAND_BG: Record<DscrBand, string> = { go: "bg-go", amber: "bg-amber", stop: "bg-stop" };
const BAND_LABEL: Record<DscrBand, string> = { go: "Bankable", amber: "Tight", stop: "Below lender minimum" };

export function UnderwritingWorkspace({ deal, financials, defaults }: { deal: Deal; financials: DealFinancial[]; defaults: UnderwritingDefaults }) {
  const list = deal.list_price ?? deal.target_price ?? deal.appraised_value ?? 0;
  const periods = (["actual_year", "t12", "year1_proj"] as Period[]).filter((p) => financials.some((f) => f.period === p));
  const [basis, setBasis] = React.useState<Period>(periods.includes("t12") ? "t12" : periods[0] ?? "t12");
  const [price, setPrice] = React.useState(() => clamp(deal.contract_price ?? deal.target_price ?? list, list * 0.7, list));
  const [down, setDown] = React.useState(defaults.down_pct);
  const [rate, setRate] = React.useState(defaults.rate);
  const [years, setYears] = React.useState(defaults.years);
  const [targets, setTargets] = React.useState({ dscr: defaults.target_dscr, cap: defaults.target_cap, fee: defaults.assignment_fee });

  const fin = financials.find((f) => f.period === basis);
  const noi = fin ? periodNoi(fin) : 0;

  if (!list || periods.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="font-medium">Add a price and NOI to underwrite</div>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">Upload the broker OM or enter the list price and T-12 NOI on the Overview tab. The live panel appears as soon as both exist.</p>
      </Card>
    );
  }

  const r = underwrite({ price, noi, downPct: down, rate, years, nrsf: deal.nrsf ?? 0, units: deal.units ?? 0, appraisedValue: deal.appraised_value });
  const mo = maxOffer({ noi, targetDscr: targets.dscr, targetCap: targets.cap, rate, years, downPct: down, assignmentFee: targets.fee });
  const pctOfList = price / list;

  // Curve of DSCR across the slider range, from the engine.
  const curve = Array.from({ length: 31 }, (_, i) => {
    const p = list * (0.7 + (0.3 * i) / 30);
    const u = underwrite({ price: p, noi, downPct: down, rate, years });
    return { price: Math.round(p), dscr: Number(u.dscr.toFixed(3)), cashFlow: Math.round(u.cashFlow) };
  });

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_top_left,var(--glow),transparent_65%)]" />
        <div className="relative grid lg:grid-cols-[1.35fr_1fr]">
          {/* Price: the signature element */}
          <div className="border-b border-line-soft p-6 sm:p-8 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted">Offer price</span>
              <span className="rounded-full border border-line bg-raised px-2.5 py-0.5 text-xs tabular text-muted">{pct(pctOfList, 1)} of list</span>
            </div>
            <output aria-live="polite" className="mt-2 block text-[44px] font-semibold leading-none tracking-[-0.03em] tabular sm:text-[60px]">
              {money(price)}
            </output>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted tabular">
              <span>List {money(list)} <SourceTag source={deal.sources.list_price ?? "broker_om"} /></span>
              {deal.appraised_value ? <span>Appraisal {money(deal.appraised_value)} <SourceTag source="appraisal" /></span> : null}
            </div>
            <div className="mt-8">
              <Slider size="lg" label="Offer price" min={Math.round(list * 0.7)} max={Math.round(list)} step={1000} value={price} onChange={setPrice} format={money} />
              <div className="mt-2 flex justify-between text-xs text-muted tabular">
                <span>70% · {compactMoney(list * 0.7)}</span>
                {deal.target_price ? (
                  <button className="hover:text-text" onClick={() => setPrice(clamp(deal.target_price!, list * 0.7, list))}>Target {compactMoney(deal.target_price)}</button>
                ) : null}
                <span>List · {compactMoney(list)}</span>
              </div>
            </div>

            <div className="mt-9 grid gap-x-8 gap-y-6 sm:grid-cols-2">
              <Control label="Down payment" value={`${Math.round(down * 100)}% · ${compactMoney(price * down)}`}>
                <Slider label="Down payment" min={0.1} max={1} step={0.05} value={down} onChange={setDown} format={(v) => `${Math.round(v * 100)}%`} />
              </Control>
              <Control label="Interest rate" value={`${(rate * 100).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%`}>
                <Slider label="Interest rate" min={0.05} max={0.1} step={0.00125} value={rate} onChange={setRate} format={(v) => `${(v * 100).toFixed(2)}%`} />
              </Control>
              <Control label="Amortization">
                <Segmented label="Amortization" value={years} onChange={setYears} options={[20, 25, 30].map((y) => ({ value: y, label: `${y} yr` }))} />
              </Control>
              <Control label="NOI basis" value={<span className="inline-flex items-center gap-1.5">{money(noi)} <SourceTag source={fin?.source} /></span>}>
                <Segmented label="NOI basis" value={basis} onChange={setBasis} options={periods.map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} />
              </Control>
            </div>

            <div className="mt-9 rounded-xl border border-line-soft bg-raised/40 p-4">
              <div className="flex items-center justify-between text-[13px] text-muted">
                <span>Capital stack</span>
                <span className="tabular">{money(r.debtService / 12)} / mo payment</span>
              </div>
              <div className="mt-3 flex h-2.5 overflow-hidden rounded-full" aria-hidden>
                <div className="bg-gold" style={{ width: `${down * 100}%` }} />
                <div className="bg-door/70" style={{ width: `${(1 - down) * 100}%` }} />
              </div>
              <div className="mt-3 flex justify-between text-sm tabular">
                <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-gold" />Equity {money(r.equity)}</span>
                <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-door/70" />Loan {money(r.loan)}</span>
              </div>
            </div>
          </div>

          {/* Outputs */}
          <div className="p-6 sm:p-8">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-muted">Debt service coverage</div>
                <div className={cn("mt-1 text-[44px] font-semibold leading-none tracking-tight tabular", BAND_TEXT[r.dscrBand])}>{ratio(r.dscr)}</div>
                <div className={cn("mt-2 text-sm font-medium", BAND_TEXT[r.dscrBand])}>{down >= 1 ? "All cash" : BAND_LABEL[r.dscrBand]}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted">Cap rate</div>
                <div className="mt-1 text-[32px] font-semibold leading-none tracking-tight tabular">{pct(r.capRate)}</div>
                <div className="mt-2 text-xs text-muted">{PERIOD_LABEL[basis]} NOI</div>
              </div>
            </div>
            <DscrMeter value={r.dscr} band={r.dscrBand} />

            <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5">
              <Out label="Annual debt service" value={money(r.debtService)} sub={`Loan ${compactMoney(r.loan)}`} />
              <Out label="Annual cash flow" value={money(r.cashFlow)} tone={r.cashFlow >= 0 ? "go" : "stop"} sub={`${money(r.cashFlow / 12)} / mo`} />
              <Out label="Cash-on-cash" value={pct(r.cashOnCash, 1)} sub={`On ${compactMoney(r.equity)} down`} />
              <Out label="Spread to appraisal" value={r.spreadToAppraisal === null ? "—" : money(r.spreadToAppraisal)} tone={r.spreadToAppraisal === null ? undefined : r.spreadToAppraisal >= 0 ? "go" : "stop"} sub={r.spreadToAppraisalPct === null ? "No appraisal" : `${pct(r.spreadToAppraisalPct, 1)} ${r.spreadToAppraisal! >= 0 ? "below" : "above"} value`} />
              <Out label="Price per NRSF" value={r.pricePerNrsf ? money2(r.pricePerNrsf) : "—"} />
              <Out label="Price per unit" value={r.pricePerUnit ? money(r.pricePerUnit) : "—"} />
            </dl>

            <div className="mt-7 h-28" aria-label="DSCR across the price range">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={curve} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dscrFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--door)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--door)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="price" hide type="number" domain={["dataMin", "dataMax"]} />
                  <YAxis hide domain={["auto", "auto"]} />
                  <ReferenceLine y={1.25} stroke="var(--go)" strokeDasharray="3 3" strokeOpacity={0.6} />
                  <ReferenceLine x={price} stroke="var(--text)" strokeOpacity={0.5} />
                  <Tooltip
                    cursor={{ stroke: "var(--line)" }}
                    contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12 }}
                    labelFormatter={(v) => compactMoney(Number(v))}
                    formatter={(v) => [`${Number(v).toFixed(2)}x`, "DSCR"]}
                  />
                  <Area type="monotone" dataKey="dscr" stroke="var(--door)" strokeWidth={2} fill="url(#dscrFill)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="mt-1 flex justify-between text-[11px] text-muted"><span>DSCR at 70% of list</span><span>Dashed line: 1.25x</span></div>
            </div>
          </div>
        </div>
      </Card>

      {/* Max offer */}
      <Card className="p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 font-semibold tracking-tight"><Target className="size-4 text-gold" /> Max offer</h2>
            <p className="mt-0.5 text-sm text-muted">The highest price to the seller that still clears every target for your end buyer, using the loan terms above.</p>
          </div>
        </div>
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="mo-dscr" className="text-[13px] font-medium text-muted">Target DSCR</label>
              <NumberInput id="mo-dscr" decimals={2} suffix="x" value={targets.dscr} onChange={(v) => setTargets((t) => ({ ...t, dscr: v ?? 0 }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="mo-cap" className="text-[13px] font-medium text-muted">Target cap rate</label>
              <NumberInput id="mo-cap" decimals={2} suffix="%" value={Number((targets.cap * 100).toFixed(2))} onChange={(v) => setTargets((t) => ({ ...t, cap: (v ?? 0) / 100 }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="mo-fee" className="text-[13px] font-medium text-muted">Assignment fee</label>
              <NumberInput id="mo-fee" prefix="$" value={targets.fee} onChange={(v) => setTargets((t) => ({ ...t, fee: v ?? 0 }))} />
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-raised/50 p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-sm text-muted">Offer up to</div>
                <div className={cn("mt-1 text-4xl font-semibold tracking-tight tabular", !mo.feasible && "text-stop")}>{mo.feasible ? money(mo.maxOffer) : "No price works"}</div>
                <div className="mt-1 text-sm text-muted tabular">Buyer pays {money(mo.buyerPrice)} incl. {compactMoney(targets.fee)} fee</div>
              </div>
              {mo.feasible ? (
                <Button variant="secondary" size="sm" onClick={() => setPrice(clamp(mo.maxOffer, list * 0.7, list))}>
                  <ArrowDownToLine /> Use as offer price
                </Button>
              ) : null}
            </div>
            <div className="mt-5 space-y-2.5">
              <ConstraintBar label={`DSCR ${targets.dscr.toFixed(2)}x`} value={mo.priceAtDscr} max={Math.max(mo.priceAtDscr, mo.priceAtCap, list)} binding={mo.binding === "dscr"} />
              <ConstraintBar label={`Cap ${pct(targets.cap)}`} value={mo.priceAtCap} max={Math.max(mo.priceAtDscr, mo.priceAtCap, list)} binding={mo.binding === "cap"} />
            </div>
            <p className="mt-4 text-sm">
              <span className="font-medium text-gold">{mo.binding === "dscr" ? "Debt coverage" : "Cap rate"} binds.</span>{" "}
              <span className="text-muted">
                {mo.binding === "dscr" ? "The lender's coverage test caps the price before the yield target does." : "The buyer's yield target caps the price before the lender does."}
              </span>
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v / 1000) * 1000));

function Control({ label, value, children }: { label: string; value?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between text-sm">
        <span className="text-muted">{label}</span>
        {value ? <span className="font-medium tabular">{value}</span> : null}
      </div>
      {children}
    </div>
  );
}

function Out({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "go" | "stop" }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className={cn("mt-0.5 truncate text-lg font-semibold tracking-tight tabular", tone === "go" && "text-go", tone === "stop" && "text-stop")}>{value}</dd>
      {sub ? <dd className="text-xs text-muted tabular">{sub}</dd> : null}
    </div>
  );
}

function DscrMeter({ value, band }: { value: number; band: DscrBand }) {
  const lo = 0.8;
  const hi = 1.8;
  const at = Number.isFinite(value) ? Math.min(1, Math.max(0, (value - lo) / (hi - lo))) : 1;
  const mark = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  return (
    <div className="mt-5" aria-hidden>
      <div className="relative h-2 rounded-full bg-[linear-gradient(90deg,var(--stop)_0%,var(--stop)_30%,var(--amber)_30%,var(--amber)_45%,var(--go)_45%)] opacity-30" />
      <div className="relative -mt-2 h-2">
        <div className={cn("absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-surface", BAND_BG[band])} style={{ left: `${at * 100}%` }} />
      </div>
      <div className="relative mt-1.5 h-4 text-[10.5px] text-muted tabular">
        <span className="absolute -translate-x-1/2" style={{ left: mark(1.1) }}>1.10</span>
        <span className="absolute -translate-x-1/2" style={{ left: mark(1.25) }}>1.25</span>
      </div>
    </div>
  );
}

function ConstraintBar({ label, value, max, binding }: { label: string; value: number; max: number; binding: boolean }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className={binding ? "font-medium text-gold" : "text-muted"}>{label}{binding ? " · binding" : ""}</span>
        <span className="tabular text-muted">{money(value)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-raised">
        <div className={cn("h-full rounded-full", binding ? "bg-gold" : "bg-muted/40")} style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%` }} />
      </div>
    </div>
  );
}
