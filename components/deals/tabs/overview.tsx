"use client";

import * as React from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Info, Pencil, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { saveUnitMix, updateDeal } from "@/lib/actions/deals";
import { cn } from "@/lib/cn";
import { compactMoney, date, money, money2, num, pct } from "@/lib/format";
import { PERIOD_LABEL, type DealBundle, type Period, type Source } from "@/lib/types";
import { capRate, economicOccupancy, expenseRatio, periodNoi, pricePerNrsf, rentGap, type UnitMixRow } from "@/lib/underwriting";
import { Button, Card, CardHeader, Field, Input, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent, useToast } from "@/components/ui/interactive";
import { NumberInput } from "@/components/ui/number-input";
import { useApp } from "@/components/shell/app-provider";
import { SourceTag } from "../source-tag";

const ORDER: Period[] = ["actual_year", "t12", "year1_proj"];

export function OverviewTab({ bundle, onUnderwrite }: { bundle: DealBundle; onUnderwrite: () => void }) {
  const { deal, financials, unitMix, flags } = bundle;
  const periods = ORDER.map((p) => financials.find((f) => f.period === p)).filter((f): f is NonNullable<typeof f> => Boolean(f));
  const t12 = financials.find((f) => f.period === "t12") ?? periods[0];
  const price = deal.target_price ?? deal.list_price;
  const noi = t12 ? periodNoi(t12) : null;
  const src = (k: string, fallback?: Source) => deal.sources[k] ?? fallback;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-6">
        <Card>
          <CardHeader title="Key numbers" action={<EditDetails bundle={bundle} />} />
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-b-2xl bg-line-soft sm:grid-cols-4">
            <Fact label="List price" value={money(deal.list_price)} source={src("list_price")} />
            <Fact label="Target price" value={money(deal.target_price)} source={src("target_price", "user")} />
            <Fact label="Appraised value" value={money(deal.appraised_value)} source={src("appraised_value", "appraisal")} sub={deal.appraisal_date ? date(deal.appraisal_date) : undefined} />
            <Fact label="Price per NRSF" value={price && deal.nrsf ? money2(pricePerNrsf(price, deal.nrsf)) : "—"} source="calculated" sub="At target" />
            <Fact label="Units" value={num(deal.units)} source={src("units")} />
            <Fact label="NRSF" value={num(deal.nrsf)} source={src("nrsf")} />
            <Fact label="Acres" value={deal.acres ?? "—"} source={src("acres")} sub={deal.buildings ? `${deal.buildings} buildings` : undefined} />
            <Fact label="Physical occupancy" value={pct(deal.physical_occupancy, 0)} source={src("physical_occupancy")} />
          </dl>
          {deal.construction ? <p className="border-t border-line-soft px-5 py-3 text-sm text-muted">{deal.construction}</p> : null}
        </Card>

        <Card>
          <CardHeader title="Income and expenses" description="Annual, by period." />
          {periods.length === 0 ? (
            <p className="p-5 text-sm text-muted">No financials yet. Upload the broker OM from the Documents tab, or edit the details to add a T-12 NOI.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-[13px] text-muted">
                    <th className="px-5 py-3 text-left font-medium"> </th>
                    {periods.map((p) => (
                      <th key={p.period} className="px-5 py-3 text-right font-medium">
                        <div className="text-text">{p.period_label || PERIOD_LABEL[p.period]}</div>
                        <SourceTag source={p.source} className="mt-1" />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="tabular">
                  <Row label="Potential rent" values={periods.map((p) => money(p.potential_rent))} />
                  <Row label="Vacancy and loss" values={periods.map((p) => (p.vacancy ? `(${money(p.vacancy)})` : "—"))} muted />
                  <Row label="Other income" values={periods.map((p) => money(p.other_income))} muted />
                  <Row label="Effective gross income" values={periods.map((p) => money(p.egi))} strong />
                  <Row label="Operating expenses" values={periods.map((p) => (p.total_expenses !== null ? `(${money(p.total_expenses)})` : "—"))} muted />
                  <Row label="Net operating income" values={periods.map((p) => money(periodNoi(p)))} strong accent />
                  <Row label="Expense ratio" values={periods.map((p) => (p.egi && p.total_expenses !== null ? pct(expenseRatio(p.total_expenses, p.egi), 1) : "—"))} small />
                  <Row label="Economic occupancy" values={periods.map((p) => (p.egi && p.potential_rent ? pct(economicOccupancy(p.egi, p.potential_rent), 1) : "—"))} small />
                  <Row label="Cap at target" values={periods.map((p) => (price ? pct(capRate(periodNoi(p), price)) : "—"))} small />
                </tbody>
              </table>
            </div>
          )}
          {t12?.expenses.length ? (
            <details className="border-t border-line-soft px-5 py-3 text-sm">
              <summary className="cursor-pointer text-muted hover:text-text">{t12.period_label || "T-12"} expense lines</summary>
              <ul className="mt-3 grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
                {t12.expenses.map((e) => (
                  <li key={e.label} className="flex justify-between tabular"><span className="text-muted">{e.label}</span>{money(e.amount)}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </Card>

        <UnitMixCard dealId={deal.id} rows={unitMix} />
      </div>

      <aside className="space-y-6">
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-b from-door/[0.08] to-transparent p-5">
            <div className="text-[13px] text-muted">At target {compactMoney(price)}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[34px] font-semibold leading-none tracking-tight tabular">{noi && price ? pct(capRate(noi, price)) : "—"}</span>
              <span className="text-sm text-muted">{t12 ? `${t12.period_label || PERIOD_LABEL[t12.period]} cap` : "cap rate"}</span>
            </div>
            <div className="mt-2 text-sm text-muted tabular">NOI {money(noi)}</div>
            <Button className="mt-4 w-full" variant="secondary" onClick={onUnderwrite}>
              DSCR, cash flow and max offer <ArrowRight />
            </Button>
          </div>
        </Card>
        <FlagsCard flags={flags} />
        {deal.notes ? (
          <Card className="p-5">
            <div className="text-sm font-medium">Notes</div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">{deal.notes}</p>
          </Card>
        ) : null}
      </aside>
    </div>
  );
}

function Fact({ label, value, source, sub }: { label: string; value: React.ReactNode; source?: Source; sub?: string }) {
  return (
    <div className="bg-surface px-5 py-4">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tracking-tight tabular">{value}</dd>
      <dd className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
        <SourceTag source={source} />
        {sub ? <span>{sub}</span> : null}
      </dd>
    </div>
  );
}

function Row({ label, values, strong, muted, accent, small }: { label: string; values: string[]; strong?: boolean; muted?: boolean; accent?: boolean; small?: boolean }) {
  return (
    <tr className={cn("border-t border-line-soft", strong && "font-semibold", small && "text-[13px] text-muted")}>
      <td className={cn("px-5 py-2.5", muted && "text-muted")}>{label}</td>
      {values.map((v, i) => <td key={i} className={cn("px-5 py-2.5 text-right", accent && "text-go", muted && "text-muted")}>{v}</td>)}
    </tr>
  );
}

function FlagsCard({ flags }: { flags: DealBundle["flags"] }) {
  const warn = flags.filter((f) => f.level === "warn");
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Red-flag checks</div>
        {flags.length ? <span className="text-xs text-muted">{warn.length} to review</span> : null}
      </div>
      {flags.length === 0 ? (
        <p className="mt-2 flex gap-2 text-sm text-muted"><ShieldCheck className="mt-0.5 size-4 shrink-0" /> Checks run when you upload and confirm a broker OM.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {[...flags].sort((a, b) => ["warn", "info", "ok"].indexOf(a.level) - ["warn", "info", "ok"].indexOf(b.level)).map((f) => (
            <li key={f.id} className="flex gap-2.5 text-sm leading-snug">
              {f.level === "warn" ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" /> : f.level === "ok" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-go" /> : <Info className="mt-0.5 size-4 shrink-0 text-door" />}
              <span>{f.message}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function UnitMixCard({ dealId, rows }: { dealId: string; rows: UnitMixRow[] }) {
  const { isPro, openUpgrade } = useApp();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(rows);
  const toast = useToast();
  const router = useRouter();
  React.useEffect(() => setDraft(rows), [rows]);
  const gap = rentGap(editing ? draft : rows);
  const totalUnits = rows.reduce((s, r) => s + r.count, 0);
  const occ = rows.reduce((s, r) => s + r.occupied, 0);

  return (
    <Card>
      <CardHeader
        title="Unit mix and rent gap"
        description={rows.length ? `${totalUnits} units, ${occ} occupied. Monthly rents.` : undefined}
        action={
          editing ? (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setDraft(rows); setEditing(false); }}>Cancel</Button>
              <Button size="sm" onClick={async () => {
                const res = await saveUnitMix(dealId, draft);
                if (!res.ok) return toast(res.error, "error");
                toast("Unit mix saved");
                setEditing(false);
                router.refresh();
              }}>Save</Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => (isPro ? setEditing(true) : openUpgrade("Editing the unit mix is part of WeStor Pro."))}><Pencil /> Edit</Button>
          )
        }
      />
      {(editing ? draft : rows).length === 0 && !editing ? (
        <p className="p-5 text-sm text-muted">No unit mix yet. The OM reader fills this in, or add rows by hand.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-[13px] text-muted">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Type</th>
                <th className="px-3 py-2.5 text-right font-medium">Units</th>
                <th className="px-3 py-2.5 text-right font-medium">Occupied</th>
                <th className="px-3 py-2.5 text-right font-medium">Street</th>
                <th className="px-3 py-2.5 text-right font-medium">In-place</th>
                <th className="px-3 py-2.5 text-right font-medium">Gap</th>
                <th className="px-5 py-2.5 text-right font-medium">Monthly upside</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {(editing ? draft : rows).map((r, i) => {
                const g = gap.rows[i]!;
                const upd = (patch: Partial<UnitMixRow>) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <tr key={i} className="border-t border-line-soft">
                    <td className="px-5 py-2.5 font-medium">{editing ? <Input aria-label="Unit type" className="h-8" value={r.unit_type} onChange={(e) => upd({ unit_type: e.target.value })} /> : r.unit_type}</td>
                    {(["count", "occupied", "street_rent", "in_place_rent"] as const).map((k) => (
                      <td key={k} className="px-3 py-2.5 text-right">
                        {editing ? <NumberInput aria-label={k} className="ml-auto w-24 [&_input]:h-8" value={r[k]} onChange={(v) => upd({ [k]: v ?? 0 })} /> : k.includes("rent") ? money(r[k]) : r[k]}
                      </td>
                    ))}
                    <td className={cn("px-3 py-2.5 text-right", g.gap_pct > 0.15 ? "text-amber" : "text-muted")}>{g.gap_per_unit ? `${money(g.gap_per_unit)} · ${pct(g.gap_pct, 0)}` : "—"}</td>
                    <td className="px-5 py-2.5 text-right">{money(g.monthly_upside)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-line font-semibold">
                <td className="px-5 py-3" colSpan={6}>Upside from moving occupied units to street rent</td>
                <td className="px-5 py-3 text-right text-go tabular">{money(gap.monthly_upside)}<div className="text-xs font-normal text-muted">{money(gap.annual_upside)} / yr</div></td>
              </tr>
            </tfoot>
          </table>
          {editing ? (
            <div className="border-t border-line-soft p-3">
              <Button size="sm" variant="ghost" onClick={() => setDraft((d) => [...d, { unit_type: "10x10", width: 10, depth: 10, count: 0, occupied: 0, street_rent: 0, in_place_rent: 0, climate: false }])}>Add unit type</Button>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}

function EditDetails({ bundle }: { bundle: DealBundle }) {
  const d = bundle.deal;
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState({ name: d.name, market_city: d.market_city, market_state: d.market_state, units: d.units, nrsf: d.nrsf, acres: d.acres, year_built: d.year_built, list_price: d.list_price, target_price: d.target_price, appraised_value: d.appraised_value, notes: d.notes });
  const toast = useToast();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}><Pencil /> Edit</Button>
      <DialogContent wide title="Edit deal details" description="Changed numbers are tagged as yours.">
        <form
          className="grid gap-4 sm:grid-cols-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await updateDeal(d.id, { ...v, property_type: d.property_type } as Parameters<typeof updateDeal>[1]);
            if (!res.ok) return toast(res.error, "error");
            toast("Deal updated");
            setOpen(false);
            router.refresh();
          }}
        >
          <Field label="Name" htmlFor="e-name" className="sm:col-span-3"><Input id="e-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
          <Field label="City" htmlFor="e-city"><Input id="e-city" value={v.market_city} onChange={(e) => setV({ ...v, market_city: e.target.value })} /></Field>
          <Field label="State" htmlFor="e-state"><Input id="e-state" maxLength={2} value={v.market_state} onChange={(e) => setV({ ...v, market_state: e.target.value })} /></Field>
          <Field label="Year built" htmlFor="e-yb"><NumberInput id="e-yb" grouping={false} value={v.year_built} onChange={(x) => setV({ ...v, year_built: x })} /></Field>
          <Field label="Units" htmlFor="e-units"><NumberInput id="e-units" value={v.units} onChange={(x) => setV({ ...v, units: x })} /></Field>
          <Field label="NRSF" htmlFor="e-nrsf"><NumberInput id="e-nrsf" value={v.nrsf} onChange={(x) => setV({ ...v, nrsf: x })} /></Field>
          <Field label="Acres" htmlFor="e-acres"><NumberInput id="e-acres" decimals={2} value={v.acres} onChange={(x) => setV({ ...v, acres: x })} /></Field>
          <Field label="List price" htmlFor="e-list"><NumberInput id="e-list" prefix="$" value={v.list_price} onChange={(x) => setV({ ...v, list_price: x })} /></Field>
          <Field label="Target price" htmlFor="e-target"><NumberInput id="e-target" prefix="$" value={v.target_price} onChange={(x) => setV({ ...v, target_price: x })} /></Field>
          <Field label="Appraised value" htmlFor="e-appr"><NumberInput id="e-appr" prefix="$" value={v.appraised_value} onChange={(x) => setV({ ...v, appraised_value: x })} /></Field>
          <Field label="Notes" htmlFor="e-notes" className="sm:col-span-3"><Textarea id="e-notes" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 sm:col-span-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
