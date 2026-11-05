"use client";

import * as React from "react";
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { Save, Sparkles } from "lucide-react";
import { bulkSave, bulkScore, type BulkRowInput } from "@/lib/actions/undriq";
import { ASSET_CLASSES, ASSETS, type AssetClass } from "@/lib/undriq/assets";
import { fmtK } from "@/lib/undriq/engine";
import { Button, Card, Field, Select, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/interactive";
import { ScoreDot } from "./score";
import { track } from "@/components/analytics";

const ALIASES: Record<keyof Omit<BulkRowInput, "asset">, string[]> = {
  name: ["name", "property", "address", "deal", "title"],
  type: ["type", "property type"],
  city: ["city"],
  state: ["state", "st"],
  list: ["price", "asking", "list", "list price", "asking price"],
  rentMonthly: ["rent", "monthly rent", "rent/mo", "rent per month"],
  noi: ["noi", "net operating income"],
  arv: ["arv", "after repair value"],
  rehab: ["repairs", "rehab", "repair cost"],
  units: ["units"],
  nrsf: ["sf", "sqft", "nrsf", "square feet"],
};

type Scored = { i: number; name: string; city: string | null; state: string | null; list: number | null; score: number; verdict: { text: string }; best: { name: string; metric: string } | null; walkAway: number | null };

function parse(text: string): BulkRowInput[] {
  const res = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase() });
  return res.data.map((r) => {
    const get = (k: keyof typeof ALIASES) => { for (const a of ALIASES[k]) if (r[a] != null && r[a] !== "") return r[a]; return undefined; };
    return { name: String(get("name") ?? "Untitled").slice(0, 140), type: get("type"), city: get("city"), state: get("state")?.slice(0, 2), list: get("list"), rentMonthly: get("rentMonthly"), noi: get("noi"), arv: get("arv"), rehab: get("rehab"), units: get("units"), nrsf: get("nrsf") };
  });
}

export function BulkView() {
  const [text, setText] = React.useState("name,city,state,price,rent,arv,repairs\n12 Oak St,Memphis,TN,120000,1650,210000,35000\n88 Pine Ave,Memphis,TN,165000,1500,190000,10000");
  const [asset, setAsset] = React.useState<AssetClass>("residential");
  const [rows, setRows] = React.useState<BulkRowInput[]>([]);
  const [scored, setScored] = React.useState<Scored[]>([]);
  const [picked, setPicked] = React.useState<Set<number>>(new Set());
  const [pending, start] = React.useTransition();
  const toast = useToast();
  const router = useRouter();

  const score = () =>
    start(async () => {
      const parsed = parse(text);
      if (!parsed.length) return toast("Paste a header row and at least one deal.", "error");
      const r = await bulkScore(parsed, asset);
      if (!r.ok) return toast(r.error, "error");
      track("bulk_scored", { rows: parsed.length });
      setRows(parsed);
      const sorted = [...r.data].sort((a, b) => b.score - a.score);
      setScored(sorted);
      setPicked(new Set(sorted.filter((s) => s.score >= 60).map((s) => s.i)));
    });

  const save = () =>
    start(async () => {
      const list = [...picked].map((i) => rows[i]!).filter(Boolean);
      const r = await bulkSave(list, asset);
      if (!r.ok) return toast(r.error, "error");
      toast(`Saved ${r.data.saved} deals to the pipeline`);
      router.push("/app/pipeline");
    });

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_240px]">
          <Field label="Deals (CSV with a header row)" htmlFor="bulk" hint="Columns: name, city, state, type, price, rent (monthly), noi, arv, repairs, units, sf. Paste straight from Excel or Google Sheets.">
            <Textarea id="bulk" rows={8} className="font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <Field label="Asset class when a row has no type" htmlFor="bulk-asset">
            <Select id="bulk-asset" value={asset} onChange={(e) => setAsset(e.target.value as AssetClass)}>
              {ASSET_CLASSES.map((a) => <option key={a} value={a}>{ASSETS[a].label}</option>)}
            </Select>
          </Field>
        </div>
        <div className="flex justify-end"><Button onClick={score} disabled={pending}><Sparkles /> {pending ? "Scoring…" : "Score all deals"}</Button></div>
      </Card>
      {scored.length ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
            <div className="text-sm"><span className="font-medium">{scored.length} deals scored.</span> <span className="text-muted">{scored.filter((s) => s.score >= 60).length} worth pursuing.</span></div>
            <Button size="sm" onClick={save} disabled={pending || !picked.size}><Save /> Save {picked.size} to pipeline</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr><th className="w-10 px-5 py-2" /><th className="py-2">Score</th><th className="py-2">Deal</th><th className="py-2">Asking</th><th className="py-2">Best exit</th><th className="py-2 pr-5 text-right">Walk-away</th></tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {scored.map((s) => (
                  <tr key={s.i}>
                    <td className="px-5 py-2.5"><input type="checkbox" aria-label={`Save ${s.name}`} checked={picked.has(s.i)} onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(s.i); else n.delete(s.i); return n; })} /></td>
                    <td className="py-2.5"><ScoreDot score={s.score} className="size-8 text-xs" /></td>
                    <td className="py-2.5"><div className="font-medium">{s.name}</div><div className="text-xs text-muted">{[s.city, s.state].filter(Boolean).join(", ")}{s.city || s.state ? " · " : ""}{s.verdict.text}</div></td>
                    <td className="py-2.5 tabular">{fmtK(s.list)}</td>
                    <td className="py-2.5">{s.best ? <>{s.best.name}<div className="text-xs text-muted">{s.best.metric}</div></> : <span className="text-muted">Needs more numbers</span>}</td>
                    <td className="py-2.5 pr-5 text-right tabular">{fmtK(s.walkAway)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
