import { Info, Mail, Phone } from "lucide-react";
import type { Comp, PropertyRecord } from "@/lib/integrations/rentcast";
import { fmtK, fmtUsd } from "@/lib/undriq/engine";
import { cn } from "@/lib/cn";

const v = (x: number | null | undefined, f: (n: number) => string = (n) => n.toLocaleString("en-US")) => (x == null ? "—" : f(x));

/** Property data from RentCast. Shown so the user can check every number that came from records. */
export function PropertyRecordPanel({ record: r, notes = [], compact }: { record: PropertyRecord; notes?: string[]; compact?: boolean }) {
  const p = r.property;
  const rows: [string, string][] = [
    ["Type", p?.type ?? "—"],
    ["Beds / baths", p ? `${v(p.beds)} / ${v(p.baths)}` : "—"],
    ["Square feet", v(p?.sqft)],
    ["Year built", v(p?.yearBuilt, String)],
    ...(p?.units ? ([["Units", String(p.units)]] as [string, string][]) : []),
    ["Lot", p?.lotSqft ? `${p.lotSqft.toLocaleString("en-US")} sq ft` : "—"],
    ["Last sale", p?.lastSalePrice ? `${fmtK(p.lastSalePrice)}${p.lastSaleDate ? ` (${new Date(p.lastSaleDate).getFullYear()})` : ""}` : "—"],
    ["Tax assessed", v(p?.taxAssessed, fmtK)],
    ["Property tax / yr", v(p?.annualTax, fmtUsd)],
    ...(p?.hoaMonthly ? ([["HOA / mo", fmtUsd(p.hoaMonthly)]] as [string, string][]) : []),
    ["Owner", p?.ownerType ? `${p.ownerType}${p.ownerOccupied ? ", lives there" : p.ownerOccupied === false ? ", absentee" : ""}` : "—"],
  ];
  return (
    <div className={cn("space-y-4", compact ? "mt-4 border-t border-line-soft pt-4" : "p-5")}>
      <div className="flex flex-wrap gap-3">
        <Big label="Value estimate" value={fmtK(r.value?.estimate)} sub={r.value?.low ? `${fmtK(r.value.low)}–${fmtK(r.value.high)}` : undefined} />
        <Big label="Rent estimate" value={r.rent?.estimate ? `${fmtUsd(r.rent.estimate)}/mo` : "—"} sub={r.rent?.low ? `${fmtUsd(r.rent.low)}–${fmtUsd(r.rent.high)}` : undefined} />
        <Big
          label={r.listing ? `Listing · ${r.listing.status ?? "Active"}` : "Listing"}
          value={fmtK(r.listing?.price)}
          sub={r.listing?.daysOnMarket != null ? `${r.listing.daysOnMarket} days on market` : r.listing ? undefined : "No sale listing found"}
        />
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
        {rows.map(([k, val]) => (
          <div key={k} className="flex justify-between gap-2 border-b border-line-soft py-1">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right tabular">{val}</dd>
          </div>
        ))}
      </dl>
      {r.listing?.agent?.name ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="text-muted">Listing agent</span>
          <span className="font-medium">{r.listing.agent.name}{r.listing.office ? `, ${r.listing.office}` : ""}</span>
          {r.listing.agent.phone ? <a className="inline-flex items-center gap-1 hover:underline" href={`tel:${r.listing.agent.phone}`}><Phone className="size-3.5" />{r.listing.agent.phone}</a> : null}
          {r.listing.agent.email ? <a className="inline-flex items-center gap-1 hover:underline" href={`mailto:${r.listing.agent.email}`}><Mail className="size-3.5" />{r.listing.agent.email}</a> : null}
        </div>
      ) : null}
      {!compact && (r.value?.comps.length || r.rent?.comps.length) ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Comps title="Sale comps" comps={r.value?.comps ?? []} />
          <Comps title="Rent comps" comps={r.rent?.comps ?? []} rent />
        </div>
      ) : null}
      {[...notes, ...(r.missing.length ? [`Not found: ${r.missing.join(", ")}.`] : [])].map((n) => (
        <p key={n} className="flex gap-2 text-xs text-muted"><Info className="mt-px size-3.5 shrink-0" />{n}</p>
      ))}
      <p className="text-[11px] text-muted">Source: RentCast public records, MLS and estimates, {new Date(r.fetchedAt).toLocaleDateString()}. Verify before you rely on it.</p>
    </div>
  );
}

function Big({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-36 flex-1 rounded-xl border border-line px-3.5 py-2.5">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular">{value}</div>
      {sub ? <div className="text-xs text-muted">{sub}</div> : null}
    </div>
  );
}

function Comps({ title, comps, rent }: { title: string; comps: Comp[]; rent?: boolean }) {
  if (!comps.length) return null;
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium">{title}</div>
      <table className="w-full table-fixed text-xs">
        <tbody className="divide-y divide-line-soft">
          {comps.map((c, i) => (
            <tr key={c.address + i}>
              <td className="w-[46%] truncate py-1.5 pr-2" title={c.address}>{c.address.split(",")[0]}</td>
              <td className="py-1.5 pr-2 text-muted tabular">{c.beds ?? "—"}bd {c.sqft ? `${c.sqft.toLocaleString()}sf` : ""}</td>
              <td className="py-1.5 pr-2 text-muted tabular">{c.distanceMi != null ? `${c.distanceMi.toFixed(1)} mi` : ""}</td>
              <td className="py-1.5 text-right font-medium tabular">{rent ? (c.price != null ? `${fmtUsd(c.price)}/mo` : "—") : fmtK(c.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
