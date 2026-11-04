"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CheckCircle2, FileText, Info, Plus, Trash2 } from "lucide-react";
import { saveOmReview } from "@/lib/actions/om";
import { cn } from "@/lib/cn";
import { computeFlags } from "@/lib/om/flags";
import type { ReviewData } from "@/lib/om/review";
import { PERIOD_LABEL, PROPERTY_TYPE_LABEL, PROPERTY_TYPES } from "@/lib/types";
import { Badge, Button, Card, CardHeader, Field, Input, Select } from "@/components/ui/primitives";
import { NumberInput } from "@/components/ui/number-input";
import { useToast } from "@/components/ui/interactive";

const CONF_TONE = { high: "go", medium: "amber", low: "stop" } as const;

export function OmReview({ dealId, docId, docName, status, note, initial }: { dealId: string; docId: string; docName: string; status: string; note: string | null; initial: ReviewData }) {
  const [d, setD] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();

  const set = <K extends keyof ReviewData>(k: K, v: Partial<ReviewData[K]>) => setD((x) => ({ ...x, [k]: { ...(x[k] as object), ...v } }));
  const changed = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);

  const preview = computeFlags({
    units: d.property.units,
    nrsf: d.property.nrsf,
    physicalOccupancy: d.occupancy.physical_pct !== null ? d.occupancy.physical_pct / 100 : null,
    economicOccupancy: d.occupancy.economic_pct !== null ? d.occupancy.economic_pct / 100 : null,
    askingPrice: d.pricing.list_price,
    appraisedValue: d.pricing.appraised_value,
    statedCapRate: d.pricing.stated_cap_pct !== null ? d.pricing.stated_cap_pct / 100 : null,
    unitMix: d.unitMix,
    periods: d.periods,
  });

  async function save() {
    setBusy(true);
    setError(null);
    const res = await saveOmReview(dealId, docId, d);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    toast(`Saved. ${res.data.flags} flag${res.data.flags === 1 ? "" : "s"} to look at`);
    router.push(`/app/deals/${dealId}`);
  }

  const Tag = ({ dirty }: { dirty: boolean }) => (
    <span className={cn("text-[11px]", dirty ? "text-door" : "text-muted")}>{dirty ? "You" : "Broker OM"}</span>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
          <FileText className="size-4 text-muted" />
          <span className="font-medium">{docName}</span>
          <Badge tone={status === "parsed" ? "go" : "amber"}>{status === "parsed" ? "Read" : "Needs review"}</Badge>
          {note ? <span className="text-xs text-muted">{note}</span> : null}
        </div>

        <Card>
          <CardHeader title="Property" action={<Badge tone={CONF_TONE[d.confidence.property]}>{d.confidence.property} confidence</Badge>} />
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <Field label="Deal name" htmlFor="r-name" className="sm:col-span-3">
              <Input id="r-name" value={d.property.name} onChange={(e) => set("property", { name: e.target.value })} />
            </Field>
            <Field label="City" htmlFor="r-city"><Input id="r-city" value={d.property.market_city} onChange={(e) => set("property", { market_city: e.target.value })} /></Field>
            <Field label="State" htmlFor="r-state"><Input id="r-state" maxLength={2} value={d.property.market_state} onChange={(e) => set("property", { market_state: e.target.value.toUpperCase() })} /></Field>
            <Field label="Property type" htmlFor="r-type">
              <Select id="r-type" value={d.property.property_type} onChange={(e) => set("property", { property_type: e.target.value as ReviewData["property"]["property_type"] })}>
                {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{PROPERTY_TYPE_LABEL[t]}</option>)}
              </Select>
            </Field>
            {(["units", "nrsf", "acres", "buildings", "year_built"] as const).map((k) => (
              <Field key={k} label={{ units: "Units", nrsf: "NRSF", acres: "Acres", buildings: "Buildings", year_built: "Year built" }[k]} htmlFor={`r-${k}`}>
                <NumberInput id={`r-${k}`} decimals={k === "acres" ? 2 : 0} value={d.property[k]} onChange={(v) => set("property", { [k]: v })} />
                <Tag dirty={changed(d.property[k], initial.property[k])} />
              </Field>
            ))}
            <Field label="Physical occupancy" htmlFor="r-occ">
              <NumberInput id="r-occ" suffix="%" decimals={1} value={d.occupancy.physical_pct} onChange={(v) => set("occupancy", { physical_pct: v })} />
              <Tag dirty={changed(d.occupancy.physical_pct, initial.occupancy.physical_pct)} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Pricing" action={<Badge tone={CONF_TONE[d.confidence.pricing]}>{d.confidence.pricing} confidence</Badge>} />
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <Field label="Asking price" htmlFor="r-ask">
              <NumberInput id="r-ask" prefix="$" value={d.pricing.list_price} onChange={(v) => set("pricing", { list_price: v })} />
              <Tag dirty={changed(d.pricing.list_price, initial.pricing.list_price)} />
            </Field>
            <Field label="Appraised value" htmlFor="r-appr">
              <NumberInput id="r-appr" prefix="$" value={d.pricing.appraised_value} onChange={(v) => set("pricing", { appraised_value: v })} />
              <Tag dirty={changed(d.pricing.appraised_value, initial.pricing.appraised_value)} />
            </Field>
            <Field label="Cap rate stated in OM" htmlFor="r-cap">
              <NumberInput id="r-cap" suffix="%" decimals={2} value={d.pricing.stated_cap_pct} onChange={(v) => set("pricing", { stated_cap_pct: v })} />
            </Field>
            <p className="text-xs text-muted sm:col-span-3">Broker: {d.broker.name || "—"}{d.broker.firm ? `, ${d.broker.firm}` : ""}</p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Unit mix" description="Monthly rents." action={<Badge tone={CONF_TONE[d.confidence.unit_mix]}>{d.confidence.unit_mix} confidence</Badge>} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-[13px] text-muted">
                <tr>{["Type", "Width", "Depth", "Count", "Occupied", "Street", "In-place", ""].map((h) => <th key={h} className="px-3 py-2 font-medium first:pl-5">{h}</th>)}</tr>
              </thead>
              <tbody>
                {d.unitMix.map((r, i) => (
                  <tr key={i} className="border-t border-line-soft">
                    <td className="py-2 pl-5 pr-2"><Input aria-label="Unit type" value={r.unit_type} onChange={(e) => setD((x) => ({ ...x, unitMix: x.unitMix.map((u, j) => (j === i ? { ...u, unit_type: e.target.value } : u)) }))} /></td>
                    {(["width", "depth", "count", "occupied", "street_rent", "in_place_rent"] as const).map((k) => (
                      <td key={k} className="px-2 py-2">
                        <NumberInput aria-label={k} prefix={k.includes("rent") ? "$" : undefined} value={r[k]} onChange={(v) => setD((x) => ({ ...x, unitMix: x.unitMix.map((u, j) => (j === i ? { ...u, [k]: v ?? 0 } : u)) }))} />
                      </td>
                    ))}
                    <td className="pr-4"><button aria-label="Remove row" className="rounded p-1.5 text-muted hover:text-stop" onClick={() => setD((x) => ({ ...x, unitMix: x.unitMix.filter((_, j) => j !== i) }))}><Trash2 className="size-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-line-soft p-3">
            <Button variant="ghost" size="sm" onClick={() => setD((x) => ({ ...x, unitMix: [...x.unitMix, { unit_type: "10x10", width: 10, depth: 10, count: 0, occupied: 0, street_rent: 0, in_place_rent: 0, climate: false }] }))}>
              <Plus /> Add unit type
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Financials" description="Annual figures per period." action={<Badge tone={CONF_TONE[d.confidence.financials]}>{d.confidence.financials} confidence</Badge>} />
          {d.periods.length === 0 ? <p className="p-5 text-sm text-muted">No financial periods found in this OM.</p> : null}
          <div className="divide-y divide-line-soft">
            {d.periods.map((p, i) => (
              <div key={p.period} className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="font-medium">{p.period_label || PERIOD_LABEL[p.period]}</div>
                  <Tag dirty={changed(p, initial.periods[i])} />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(["potential_rent", "vacancy", "other_income", "egi", "total_expenses", "noi"] as const).map((k) => (
                    <Field key={k} label={{ potential_rent: "Potential rent", vacancy: "Vacancy and loss", other_income: "Other income", egi: "EGI", total_expenses: "Total expenses", noi: "NOI" }[k]} htmlFor={`p-${i}-${k}`}>
                      <NumberInput id={`p-${i}-${k}`} prefix="$" value={p[k]} onChange={(v) => setD((x) => ({ ...x, periods: x.periods.map((q, j) => (j === i ? { ...q, [k]: v } : q)) }))} />
                    </Field>
                  ))}
                </div>
                {p.expenses.length ? (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-muted hover:text-text">{p.expenses.length} expense lines</summary>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {p.expenses.map((x, xi) => (
                        <div key={xi} className="flex items-center gap-2">
                          <span className="w-40 truncate text-muted">{x.label}</span>
                          <NumberInput aria-label={x.label} prefix="$" className="flex-1" value={x.amount} onChange={(v) => setD((s) => ({ ...s, periods: s.periods.map((q, j) => (j === i ? { ...q, expenses: q.expenses.map((e2, k2) => (k2 === xi ? { ...e2, amount: v ?? 0 } : e2)) } : q)) }))} />
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <Card className="p-5">
          <div className="font-medium">Checks</div>
          <p className="mt-0.5 text-xs text-muted">Run in code on the numbers above. They update as you edit.</p>
          <ul className="mt-4 space-y-3">
            {preview.length === 0 ? <li className="text-sm text-muted">No issues found.</li> : null}
            {preview.map((f, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-snug">
                {f.level === "warn" ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" /> : f.level === "ok" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-go" /> : <Info className="mt-0.5 size-4 shrink-0 text-door" />}
                <span>{f.message}</span>
              </li>
            ))}
          </ul>
        </Card>
        {error ? <p className="text-sm text-stop">{error}</p> : null}
        <Button size="lg" className="w-full" onClick={save} disabled={busy}>
          <Check /> {busy ? "Saving…" : "Confirm and save"}
        </Button>
      </aside>
    </div>
  );
}
