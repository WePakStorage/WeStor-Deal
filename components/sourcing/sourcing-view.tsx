"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Copy, FileUp, Inbox, MapPinned, Plus } from "lucide-react";
import { addCandidateToPipeline, importAlertText, importCounty } from "@/lib/actions/sourcing";
import type { SourcingCandidate } from "@/lib/data/store";
import { num } from "@/lib/format";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Textarea } from "@/components/ui/primitives";
import { Segmented, Tabs, TabsContent, TabsList, TabsTrigger, useToast } from "@/components/ui/interactive";
import { ProLock } from "@/components/shell/app-provider";

const CandidateMap = dynamic(() => import("./candidate-map"), { ssr: false, loading: () => <div className="h-[460px] animate-pulse rounded-2xl bg-raised" /> });

export function SourcingView({ candidates, inboundAddress }: { candidates: SourcingCandidate[]; inboundAddress: string }) {
  return (
    <ProLock feature="Sourcing">
      <Tabs defaultValue="alerts">
        <TabsList>
          <TabsTrigger value="alerts"><Inbox /> Listing alerts</TabsTrigger>
          <TabsTrigger value="offmarket"><MapPinned /> Off-market finder</TabsTrigger>
        </TabsList>
        <TabsContent value="alerts"><Alerts inboundAddress={inboundAddress} /></TabsContent>
        <TabsContent value="offmarket"><OffMarket candidates={candidates} /></TabsContent>
      </Tabs>
    </ProLock>
  );
}

function Alerts({ inboundAddress }: { inboundAddress: string }) {
  const [subject, setSubject] = React.useState("");
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [created, setCreated] = React.useState<{ id: string; name: string }[]>([]);
  const toast = useToast();
  const router = useRouter();
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <Card className="p-6">
        <div className="font-medium">Your alert inbox</div>
        <p className="mt-1 text-sm text-muted">In Crexi or LoopNet, set your saved-search alerts to forward to this address. Each self-storage listing becomes a deal in Sourced, with a quick cap rate when NOI is listed.</p>
        <div className="mt-4 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-raised px-3 py-2 text-sm">{inboundAddress}</code>
          <Button variant="secondary" size="icon" aria-label="Copy address" onClick={() => { void navigator.clipboard.writeText(inboundAddress); toast("Address copied"); }}><Copy /></Button>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted">We only read emails you forward. DealFlow never scrapes Crexi, LoopNet or any listing site.</p>
      </Card>
      <Card>
        <CardHeader title="Or paste an alert email" description="Same parser as the inbox." />
        <form
          className="space-y-3 p-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const res = await importAlertText(subject, text);
            setBusy(false);
            if (!res.ok) return toast(res.error, "error");
            setCreated(res.data.created);
            setText("");
            toast(`${res.data.created.length} deal${res.data.created.length === 1 ? "" : "s"} added to Sourced`);
            router.refresh();
          }}
        >
          <Field label="Subject" htmlFor="al-subject"><Input id="al-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="New listings match your saved search" /></Field>
          <Field label="Email body" htmlFor="al-body"><Textarea id="al-body" className="min-h-40" required value={text} onChange={(e) => setText(e.target.value)} placeholder={"Hill Country Mini Storage\nKerrville, TX\n$1,250,000 · 142 units · 8.1% cap"} /></Field>
          <div className="flex items-center justify-between gap-2">
            <a className="text-xs text-door hover:underline" href="/samples/sample-alert.txt" target="_blank">Sample alert email</a>
            <Button type="submit" disabled={busy}>{busy ? "Reading…" : "Create deals"}</Button>
          </div>
          {created.length ? (
            <ul className="space-y-1 border-t border-line-soft pt-3 text-sm">
              {created.map((c) => <li key={c.id}><Link className="text-door hover:underline" href={`/app/deals/${c.id}`}>{c.name}</Link></li>)}
            </ul>
          ) : null}
        </form>
      </Card>
    </div>
  );
}

function OffMarket({ candidates }: { candidates: SourcingCandidate[] }) {
  const [view, setView] = React.useState<"list" | "map">("list");
  const [county, setCounty] = React.useState("");
  const [state, setState] = React.useState("TX");
  const [codes, setCodes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const toast = useToast();
  const router = useRouter();
  const file = React.useRef<HTMLInputElement>(null);

  function onFile(f: File) {
    if (!county.trim()) return toast("Enter the county name first", "error");
    setBusy(true);
    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      complete: async (r) => {
        const res = await importCounty(county, state, codes, r.data);
        setBusy(false);
        if (!res.ok) return toast(res.error, "error");
        toast(`${res.data.scored} facilities scored${res.data.skipped ? `, ${res.data.skipped} non-storage rows skipped` : ""}`);
        router.refresh();
      },
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Import county records" description="Download the appraisal-district export for your county, then upload the CSV. Start with one county." />
        <div className="grid gap-4 p-5 sm:grid-cols-[1fr_100px_1fr_auto] sm:items-end">
          <Field label="County" htmlFor="c-county"><Input id="c-county" placeholder="Bexar" value={county} onChange={(e) => setCounty(e.target.value)} /></Field>
          <Field label="State" htmlFor="c-state"><Input id="c-state" maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} /></Field>
          <Field label="Storage use codes" htmlFor="c-codes" hint="Optional. Rows mentioning storage or mini-warehouse are kept automatically."><Input id="c-codes" placeholder="F2, 4250" value={codes} onChange={(e) => setCodes(e.target.value)} /></Field>
          <div>
            <input ref={file} type="file" accept=".csv,text/csv" className="sr-only" aria-label="County CSV" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            <Button onClick={() => file.current?.click()} disabled={busy}><FileUp /> {busy ? "Scoring…" : "Upload CSV"}</Button>
          </div>
        </div>
        <p className="border-t border-line-soft px-5 py-3 text-xs text-muted">
          Score: owner type 30, years owned 25, building size 15K–80K SF 20, vintage 15, tax delinquency 10. <a className="text-door hover:underline" href="/samples/sample-county.csv">Sample county CSV</a>
        </p>
      </Card>

      {candidates.length === 0 ? (
        <EmptyState icon={<MapPinned />} title="No facilities scored yet" body="Upload a county CSV to see self-storage owners ranked by how likely they are to sell." />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted">{candidates.length} facilities, highest motivation first</div>
            <Segmented label="View" value={view} onChange={setView} options={[{ value: "list", label: "List" }, { value: "map", label: "Map" }]} />
          </div>
          {view === "map" ? (
            <CandidateMap candidates={candidates} />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="border-b border-line-soft text-left text-[13px] text-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">Score</th>
                      <th className="px-4 py-3 font-medium">Owner</th>
                      <th className="px-4 py-3 font-medium">Location</th>
                      <th className="px-4 py-3 text-right font-medium">Building SF</th>
                      <th className="px-4 py-3 text-right font-medium">Built</th>
                      <th className="px-4 py-3 text-right font-medium">Owned</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {candidates.slice(0, 500).map((c) => <CandidateRow key={c.id} c={c} />)}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function CandidateRow({ c }: { c: SourcingCandidate }) {
  const toast = useToast();
  const router = useRouter();
  return (
    <tr className="hover:bg-raised/40">
      <td className="px-4 py-3"><Badge tone={c.score >= 70 ? "go" : c.score >= 45 ? "amber" : "neutral"} className="tabular">{c.score}</Badge></td>
      <td className="px-4 py-3">
        <div className="font-medium">{c.owner_name}</div>
        <div className="text-xs text-muted">{c.reasons.join(" · ")}</div>
      </td>
      <td className="px-4 py-3 text-muted">{[c.situs_city, c.situs_state].filter(Boolean).join(", ")}<div className="text-xs">Parcel {c.parcel_id || "—"}</div></td>
      <td className="px-4 py-3 text-right tabular">{num(c.building_sf)}</td>
      <td className="px-4 py-3 text-right tabular">{c.year_built ?? "—"}</td>
      <td className="px-4 py-3 text-right tabular">{c.years_owned !== null ? `${Math.floor(c.years_owned)} yr` : "—"}</td>
      <td className="px-4 py-3 text-right">
        {c.added_deal_id ? (
          <Link href={`/app/deals/${c.added_deal_id}`} className="text-xs text-door hover:underline">In pipeline</Link>
        ) : (
          <Button size="sm" variant="secondary" onClick={async () => {
            const res = await addCandidateToPipeline(c.id);
            if (!res.ok) return toast(res.error, "error");
            toast("Added to pipeline");
            router.refresh();
          }}><Plus /> Add to pipeline</Button>
        )}
      </td>
    </tr>
  );
}
