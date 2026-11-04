"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Download, FileUp, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { deleteBuyer, importBuyers, saveBuyer } from "@/lib/actions/buyers";
import { BUYER_FIELDS, guessMapping, mapRow, type BuyerFieldKey } from "@/lib/buyer-import";
import { cn } from "@/lib/cn";
import { compactMoney, num } from "@/lib/format";
import { BUYER_TYPE_LABEL, BUYER_TYPES, PROPERTY_TYPE_LABEL, PROPERTY_TYPES, type Buyer, type PropertyType } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { NumberInput } from "@/components/ui/number-input";
import { Dialog, DialogContent, useToast } from "@/components/ui/interactive";
import { ProLock } from "@/components/shell/app-provider";
import { track } from "@/components/analytics";

export function BuyerCrm({ buyers, focusId }: { buyers: Buyer[]; focusId: string | null }) {
  const [q, setQ] = React.useState("");
  const [editing, setEditing] = React.useState<Buyer | "new" | null>(() => (focusId ? buyers.find((b) => b.id === focusId) ?? null : null));
  const [importing, setImporting] = React.useState(false);
  const rows = buyers.filter((b) => `${b.firm_name} ${b.contact_name} ${b.states.join(" ")}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <ProLock feature="Buyer CRM">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input aria-label="Search buyers" className="pl-9" placeholder="Search firm, contact or state" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="secondary" asChild><a href="/api/export/buyers"><Download /> Export CSV</a></Button>
          <Button variant="secondary" onClick={() => setImporting(true)}><FileUp /> Import CSV</Button>
          <Button onClick={() => setEditing("new")}><Plus /> Add buyer</Button>
        </div>
      </div>

      {buyers.length === 0 ? (
        <EmptyState icon={<Users />} title="No buyers yet" body="Import a CSV from your spreadsheet or CRM, or add buyers one at a time. Deals rank against their buy boxes automatically." action={<Button onClick={() => setImporting(true)}><FileUp /> Import CSV</Button>} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-line-soft text-left text-[13px] text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Buyer</th>
                  <th className="px-4 py-3 font-medium">States</th>
                  <th className="px-4 py-3 font-medium">Price range</th>
                  <th className="px-4 py-3 font-medium">NRSF</th>
                  <th className="px-4 py-3 font-medium">Wants</th>
                  <th className="px-4 py-3 font-medium">Assignments</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {rows.map((b) => (
                  <tr key={b.id} className="hover:bg-raised/40">
                    <td className="px-4 py-3">
                      <div className="font-medium">{b.firm_name}</div>
                      <div className="text-xs text-muted">{[b.contact_name, BUYER_TYPE_LABEL[b.buyer_type]].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="px-4 py-3">{b.states.length ? b.states.join(", ") : <span className="text-muted">Any</span>}</td>
                    <td className="px-4 py-3 tabular">{b.min_price || b.max_price ? `${compactMoney(b.min_price ?? 0)}–${b.max_price ? compactMoney(b.max_price) : "any"}` : <span className="text-muted">Any</span>}</td>
                    <td className="px-4 py-3 tabular">{b.min_nrsf || b.max_nrsf ? `${num(b.min_nrsf ?? 0)}–${b.max_nrsf ? num(b.max_nrsf) : "any"}` : <span className="text-muted">Any</span>}</td>
                    <td className="px-4 py-3 text-xs text-muted">{[b.property_types.map((t) => PROPERTY_TYPE_LABEL[t]).join(", "), b.strategy !== "any" ? (b.strategy === "value_add" ? "Value-add" : "Stabilized") : ""].filter(Boolean).join(" · ") || "Any"}</td>
                    <td className="px-4 py-3">{b.accepts_assignment ? <Badge tone="go">Yes</Badge> : <Badge tone="amber">Direct only</Badge>}</td>
                    <td className="px-4 py-3 text-right">
                      <button aria-label={`Edit ${b.firm_name}`} className="rounded p-1.5 text-muted hover:bg-raised hover:text-text" onClick={() => setEditing(b)}><Pencil className="size-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {editing ? <BuyerDialog buyer={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
      {importing ? <ImportDialog onClose={() => setImporting(false)} /> : null}
    </ProLock>
  );
}

function BuyerDialog({ buyer, onClose }: { buyer: Buyer | null; onClose: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [v, setV] = React.useState(() => ({
    firm_name: buyer?.firm_name ?? "",
    contact_name: buyer?.contact_name ?? "",
    email: buyer?.email ?? "",
    phone: buyer?.phone ?? "",
    buyer_type: buyer?.buyer_type ?? "private_operator",
    accepts_assignment: buyer?.accepts_assignment ?? true,
    states: buyer?.states.join(", ") ?? "",
    min_price: buyer?.min_price ?? null,
    max_price: buyer?.max_price ?? null,
    min_nrsf: buyer?.min_nrsf ?? null,
    max_nrsf: buyer?.max_nrsf ?? null,
    property_types: buyer?.property_types ?? ([] as PropertyType[]),
    strategy: buyer?.strategy ?? "any",
    financing: buyer?.financing ?? "either",
    notes: buyer?.notes ?? "",
  }));
  const [busy, setBusy] = React.useState(false);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent wide title={buyer ? `Edit ${buyer.firm_name}` : "Add a buyer"} description="The buy box drives match scores on every deal.">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const res = await saveBuyer({ ...v, id: buyer?.id, states: v.states.split(/[,;\s]+/).filter(Boolean) });
            setBusy(false);
            if (!res.ok) return toast(res.error, "error");
            toast(buyer ? "Buyer updated" : "Buyer added");
            onClose();
            router.refresh();
          }}
        >
          <Field label="Firm name" htmlFor="b-firm"><Input id="b-firm" required value={v.firm_name} onChange={(e) => setV({ ...v, firm_name: e.target.value })} /></Field>
          <Field label="Contact name" htmlFor="b-contact"><Input id="b-contact" value={v.contact_name} onChange={(e) => setV({ ...v, contact_name: e.target.value })} /></Field>
          <Field label="Email" htmlFor="b-email"><Input id="b-email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
          <Field label="Phone" htmlFor="b-phone"><Input id="b-phone" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
          <Field label="Buyer type" htmlFor="b-type">
            <Select id="b-type" value={v.buyer_type} onChange={(e) => setV({ ...v, buyer_type: e.target.value as Buyer["buyer_type"] })}>
              {BUYER_TYPES.map((t) => <option key={t} value={t}>{BUYER_TYPE_LABEL[t]}</option>)}
            </Select>
          </Field>
          <Field label="States" htmlFor="b-states" hint="Comma separated, e.g. TX, OK. Leave blank for any."><Input id="b-states" value={v.states} onChange={(e) => setV({ ...v, states: e.target.value.toUpperCase() })} /></Field>
          <Field label="Min price" htmlFor="b-minp"><NumberInput id="b-minp" prefix="$" value={v.min_price} onChange={(x) => setV({ ...v, min_price: x })} /></Field>
          <Field label="Max price" htmlFor="b-maxp"><NumberInput id="b-maxp" prefix="$" value={v.max_price} onChange={(x) => setV({ ...v, max_price: x })} /></Field>
          <Field label="Min NRSF" htmlFor="b-mins"><NumberInput id="b-mins" value={v.min_nrsf} onChange={(x) => setV({ ...v, min_nrsf: x })} /></Field>
          <Field label="Max NRSF" htmlFor="b-maxs"><NumberInput id="b-maxs" value={v.max_nrsf} onChange={(x) => setV({ ...v, max_nrsf: x })} /></Field>
          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 text-[13px] font-medium text-muted">Property types</legend>
            <div className="flex flex-wrap gap-2">
              {PROPERTY_TYPES.map((t) => {
                const on = v.property_types.includes(t);
                return (
                  <button type="button" key={t} aria-pressed={on} onClick={() => setV({ ...v, property_types: on ? v.property_types.filter((x) => x !== t) : [...v.property_types, t] })}
                    className={cn("rounded-full border px-3 py-1 text-sm transition", on ? "border-door bg-door/10 text-text" : "border-line text-muted hover:text-text")}>
                    {PROPERTY_TYPE_LABEL[t]}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <Field label="Strategy" htmlFor="b-strat">
            <Select id="b-strat" value={v.strategy} onChange={(e) => setV({ ...v, strategy: e.target.value as Buyer["strategy"] })}>
              <option value="any">Any</option><option value="value_add">Value-add</option><option value="stabilized">Stabilized</option>
            </Select>
          </Field>
          <Field label="Financing" htmlFor="b-fin">
            <Select id="b-fin" value={v.financing} onChange={(e) => setV({ ...v, financing: e.target.value as Buyer["financing"] })}>
              <option value="either">Either</option><option value="cash">Cash</option><option value="debt">Debt</option>
            </Select>
          </Field>
          <label className="flex items-center gap-3 sm:col-span-2">
            <input type="checkbox" className="size-4 accent-[var(--door)]" checked={v.accepts_assignment} onChange={(e) => setV({ ...v, accepts_assignment: e.target.checked })} />
            <span className="text-sm">Accepts assignment of contract</span>
          </label>
          <Field label="Notes" htmlFor="b-notes" className="sm:col-span-2"><Textarea id="b-notes" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></Field>
          <div className="flex items-center justify-between gap-2 sm:col-span-2">
            {buyer ? (
              <Button type="button" variant="danger" onClick={async () => {
                const res = await deleteBuyer(buyer.id);
                if (!res.ok) return toast(res.error, "error");
                toast("Buyer removed");
                onClose();
                router.refresh();
              }}><Trash2 /> Delete</Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? "Saving…" : buyer ? "Save buyer" : "Add buyer"}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [csv, setCsv] = React.useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [mapping, setMapping] = React.useState<Partial<Record<BuyerFieldKey, string>>>({});
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ imported: number; skipped: { row: number; error: string }[] } | null>(null);

  function onFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => {
        const headers = r.meta.fields ?? [];
        setCsv({ headers, rows: r.data });
        setMapping(guessMapping(headers));
      },
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent wide title="Import buyers from CSV" description="Upload a CSV, match its columns to buyer fields, then import.">
        {!csv ? (
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-12 text-center hover:border-door/60">
            <FileUp className="size-6 text-door" />
            <span className="font-medium">Choose a CSV file</span>
            <span className="text-sm text-muted">Firm name is required. Lists like states can be separated with commas or semicolons.</span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
        ) : result ? (
          <div className="space-y-3">
            <p className="text-sm"><b>{result.imported}</b> buyers imported{result.skipped.length ? `, ${result.skipped.length} skipped` : ""}.</p>
            {result.skipped.length ? (
              <ul className="max-h-40 overflow-y-auto rounded-lg border border-line p-3 text-xs text-muted">
                {result.skipped.map((s) => <li key={s.row}>Row {s.row}: {s.error}</li>)}
              </ul>
            ) : null}
            <div className="flex justify-end"><Button onClick={onClose}>Done</Button></div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted">{csv.rows.length} rows found. Check the column for each field.</p>
            <div className="grid max-h-[46vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
              {BUYER_FIELDS.map((f) => (
                <Field key={f.key} label={`${f.label}${"required" in f ? " (required)" : ""}`} htmlFor={`map-${f.key}`}>
                  <Select id={`map-${f.key}`} value={mapping[f.key] ?? ""} onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value || undefined })}>
                    <option value="">Don&apos;t import</option>
                    {csv.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </Select>
                </Field>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCsv(null)}>Choose another file</Button>
              <Button
                disabled={!mapping.firm_name || busy}
                onClick={async () => {
                  setBusy(true);
                  const res = await importBuyers(csv.rows.map((r) => mapRow(r, mapping)));
                  setBusy(false);
                  if (!res.ok) return toast(res.error, "error");
                  track("buyer_imported", { count: res.data.imported });
                  setResult(res.data);
                  toast(`${res.data.imported} buyers imported`);
                  router.refresh();
                }}
              >
                {busy ? "Importing…" : `Import ${csv.rows.length} buyers`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
