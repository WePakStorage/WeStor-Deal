"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Building2, Search } from "lucide-react";
import { Badge, Card, EmptyState, Input } from "@/components/ui/primitives";
import { compactMoney, num, pct } from "@/lib/format";
import { PROPERTY_TYPE_LABEL, STAGE_LABEL, type DealSummary } from "@/lib/types";
import { capRate, pricePerNrsf } from "@/lib/underwriting";

type Key = "name" | "price" | "units" | "nrsf" | "cap" | "ppsf" | "stage";

export function DealTable({ deals }: { deals: DealSummary[] }) {
  const [q, setQ] = React.useState("");
  const [sort, setSort] = React.useState<{ key: Key; dir: 1 | -1 }>({ key: "price", dir: -1 });

  const rows = deals
    .map((d) => {
      const price = d.target_price ?? d.list_price ?? 0;
      const noi = d.noi.t12 ?? d.noi.actual_year ?? null;
      return { d, price, cap: noi && price ? capRate(noi, price) : null, ppsf: d.nrsf ? pricePerNrsf(price, d.nrsf) : null };
    })
    .filter(({ d }) => `${d.name} ${d.market_city} ${d.market_state}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      const v = (r: typeof a): string | number => {
        switch (sort.key) {
          case "name": return r.d.name;
          case "price": return r.price;
          case "units": return r.d.units ?? 0;
          case "nrsf": return r.d.nrsf ?? 0;
          case "cap": return r.cap ?? -1;
          case "ppsf": return r.ppsf ?? 0;
          case "stage": return r.d.stage;
        }
      };
      const x = v(a);
      const y = v(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });

  const th = (key: Key, label: string, right = false) => (
    <th scope="col" className={`px-4 py-3 font-medium ${right ? "text-right" : "text-left"}`} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button className="inline-flex items-center gap-1 hover:text-text" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }))}>
        {label}
        {sort.key === key ? (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : null}
      </button>
    </th>
  );

  if (deals.length === 0) {
    return <EmptyState icon={<Building2 />} title="No deals yet" body="Add a deal by hand or upload a broker OM and we'll pull the numbers out for you." />;
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line-soft p-3">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input aria-label="Search deals" className="pl-9" placeholder="Search by name or market" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-line-soft text-[13px] text-muted">
            <tr>
              {th("name", "Deal")}
              {th("stage", "Stage")}
              {th("price", "Target price", true)}
              {th("units", "Units", true)}
              {th("nrsf", "NRSF", true)}
              {th("ppsf", "Price / SF", true)}
              {th("cap", "T-12 cap", true)}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {rows.map(({ d, price, cap, ppsf }) => (
              <tr key={d.id} className="transition-colors hover:bg-raised/50">
                <td className="px-4 py-3.5">
                  <Link href={`/app/deals/${d.id}`} className="font-medium hover:text-door">{d.name}</Link>
                  <div className="text-xs text-muted">
                    {d.market_city}, {d.market_state} · {PROPERTY_TYPE_LABEL[d.property_type]}
                    {d.is_sample ? " · Sample" : ""}
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <Badge tone={d.stage === "under_contract" || d.stage === "assigned" ? "gold" : d.stage === "dead" ? "stop" : "neutral"}>{STAGE_LABEL[d.stage]}</Badge>
                </td>
                <td className="px-4 py-3.5 text-right font-medium tabular">{compactMoney(price)}</td>
                <td className="px-4 py-3.5 text-right tabular">{num(d.units)}</td>
                <td className="px-4 py-3.5 text-right tabular">{num(d.nrsf)}</td>
                <td className="px-4 py-3.5 text-right tabular">{ppsf ? `$${ppsf.toFixed(2)}` : "—"}</td>
                <td className="px-4 py-3.5 text-right tabular">{pct(cap)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
