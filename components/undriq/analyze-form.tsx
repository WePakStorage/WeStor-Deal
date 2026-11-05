"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Database, FileUp, Link2, Loader2, MapPin, X } from "lucide-react";
import { PropertyRecordPanel } from "./property-record";
import type { PropertyRecord, SuggestedFacts } from "@/lib/integrations/rentcast";
import { ASSET_CLASSES, ASSETS, defaultType, type AssetClass } from "@/lib/undriq/assets";
import { guessAsset, parseListingUrl, type ParsedLink } from "@/lib/undriq/linkparse";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/interactive";
import { useApp } from "@/components/shell/app-provider";
import { track } from "@/components/analytics";
import { cn } from "@/lib/cn";
import { supabaseBrowser } from "@/lib/supabase/browser";

const STEPS = ["Reading the listing", "Running five exit strategies", "Stress testing the numbers", "Writing your memo"];

/** Size limits: straight-to-storage uploads (live site) vs inline uploads (demo mode, Vercel's 4.5 MB request cap). */
const MAX_STORAGE_PDF = 20 * 1024 * 1024;
const MAX_INLINE_PDF = 4 * 1024 * 1024;

export function AnalyzeForm({ left, lookupEnabled, uploadFolder }: { left: number; lookupEnabled: boolean; uploadFolder: string | null }) {
  const maxPdf = uploadFolder ? MAX_STORAGE_PDF : MAX_INLINE_PDF;
  const maxPdfLabel = `${Math.round(maxPdf / 1024 / 1024)} MB`;
  const router = useRouter();
  const toast = useToast();
  const { plan, openUpgrade } = useApp();
  const [asset, setAsset] = React.useState<AssetClass>("residential");
  const [type, setType] = React.useState(defaultType("residential"));
  const [linkRaw, setLinkRaw] = React.useState("");
  const [link, setLink] = React.useState<ParsedLink | null>(null);
  const [text, setText] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [q, setQ] = React.useState({ name: "", city: "", state: "", list: "", rentMonthly: "", noi: "", arv: "", rehab: "" });
  const [busy, setBusy] = React.useState(false);
  const [address, setAddress] = React.useState("");
  const [record, setRecord] = React.useState<PropertyRecord | null>(null);
  const [lookupNotes, setLookupNotes] = React.useState<string[]>([]);
  const [looking, setLooking] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [err, setErr] = React.useState("");

  const pickAsset = (a: AssetClass) => {
    setAsset(a);
    setType(defaultType(a));
  };

  const onLink = (v: string) => {
    setLinkRaw(v);
    const p = v.trim() ? parseListingUrl(v) : null;
    setLink(p);
    if (p) {
      const a = p.asset ?? guessAsset(p.url);
      if (a) pickAsset(a);
      setQ((x) => ({ ...x, name: x.name || p.name, city: x.city || p.city, state: x.state || p.state }));
      if (p.street && /^\d/.test(p.street) && p.city && p.state) setAddress(`${p.street}, ${p.city}, ${p.state}${p.zip ? ` ${p.zip}` : ""}`);
    }
  };

  const ready = text.trim().length >= 40 || !!file || !!q.list || !!q.rentMonthly || !!q.noi || !!q.arv || !!record;

  async function pull() {
    setErr("");
    if (!address.trim()) return setErr("Enter the property address, or paste a Zillow, Redfin or Realtor.com link.");
    setLooking(true);
    try {
      const res = await fetch("/api/property-lookup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address, asset }) });
      const body = (await res.json().catch(() => ({}))) as { record?: PropertyRecord; suggested?: SuggestedFacts; error?: string; cached?: boolean };
      if (res.status === 402) return openUpgrade(body.error);
      if (!res.ok || !body.record) throw new Error(body.error || `Property lookup didn't finish (code ${res.status}).`);
      const r = body.record;
      const sug = body.suggested;
      setRecord(r);
      setLookupNotes(sug?.notes ?? []);
      const fill = (v: number | null | undefined) => (v != null ? String(Math.round(v)) : "");
      setQ((x) => ({
        ...x,
        name: x.name || address.split(",")[0]!.trim(),
        city: x.city || address.split(",")[1]?.trim() || "",
        list: x.list || fill(sug?.list),
        rentMonthly: x.rentMonthly || fill(sug?.rentMonthly),
        arv: x.arv || fill(sug?.arv),
      }));
      toast(r.property || r.value || r.listing ? `Property data loaded${body.cached ? " (saved copy, no charge)" : ""}` : "No records found for that address", r.property || r.value || r.listing ? undefined : "error");
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setLooking(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (left <= 0) return openUpgrade(plan === "free" ? "You've used your free analyses. Start a 7-day free trial to keep analyzing deals." : "You've used this month's analyses.", plan === "free" ? "investor" : plan === "investor" ? "firm" : "fund");
    if (!ready) return setErr("Paste the listing text, upload the OM, or type at least the price and rent.");
    setBusy(true);
    setStep(0);
    const timer = window.setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), 2600);
    track("analysis_started", { asset, hasFile: !!file, hasLink: !!link });
    try {
      const payload = { asset, type, link: link?.url, address: record && address.trim() ? address.trim() : undefined, text: text.trim() || undefined, ...Object.fromEntries(Object.entries(q).filter(([, v]) => v.trim())) };
      let res: Response;
      if (file && uploadFolder) {
        // Large OMs go straight from the browser to private storage, then the server reads them from there.
        const path = `${uploadFolder}/uploads/${crypto.randomUUID()}.pdf`;
        const up = await supabaseBrowser().storage.from("deal-files").upload(path, file, { contentType: "application/pdf", upsert: false });
        if (up.error) throw new Error(`The PDF didn't upload (${up.error.message}). Try again, or paste the listing text.`);
        res = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, pdfPath: path }) });
      } else if (file) {
        const fd = new FormData();
        fd.set("payload", JSON.stringify(payload));
        fd.set("file", file);
        res = await fetch("/api/analyze", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      }
      const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (res.status === 402) {
        openUpgrade(body.error);
        return;
      }
      if (!res.ok || !body.id) throw new Error(body.error || `The analysis didn't finish (code ${res.status}). Try again.`);
      track("analysis_completed", { asset });
      router.push(`/app/analyses/${body.id}`);
      router.refresh();
    } catch (e2) {
      const m = (e2 as Error).message || "Couldn't reach UndrIq. Check your connection and try again.";
      setErr(m);
      toast(m, "error");
    } finally {
      window.clearInterval(timer);
      setBusy(false);
    }
  }

  const qf = (k: keyof typeof q, label: string, ph: string, mode: "numeric" | "text" = "numeric") => (
    <Field label={label} htmlFor={`q-${k}`}>
      <Input id={`q-${k}`} inputMode={mode} placeholder={ph} value={q[k]} onChange={(e) => setQ({ ...q, [k]: e.target.value })} disabled={busy} />
    </Field>
  );

  return (
    <form onSubmit={submit} className="space-y-6" aria-busy={busy}>
      <div>
        <div className="mb-2 text-[13px] font-medium text-muted">What kind of property?</div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Asset class">
          {ASSET_CLASSES.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={asset === a}
              onClick={() => pickAsset(a)}
              disabled={busy}
              className={cn("rounded-full border px-3.5 py-1.5 text-sm transition", asset === a ? "border-text bg-text text-ink" : "border-line text-muted hover:border-muted hover:text-text")}
            >
              {ASSETS[a].label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
        <Field label="Listing link (optional)" htmlFor="link" hint="Zillow, Redfin, Realtor.com, LoopNet, Crexi and more. We read the address from the link; paste the listing text below for the numbers.">
          <div className="relative">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input id="link" className="pl-9" placeholder="https://www.zillow.com/homedetails/…" value={linkRaw} onChange={(e) => onLink(e.target.value)} disabled={busy} />
          </div>
          {link ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs">
              <Check className="size-3.5 text-go" /> {link.site}: {[link.street || link.name, link.city, link.state, link.zip].filter(Boolean).join(", ") || "link recognized"}
            </p>
          ) : linkRaw.trim() ? (
            <p className="mt-1.5 text-xs text-stop">That doesn&apos;t look like a link.</p>
          ) : null}
        </Field>
        <Field label="Property type" htmlFor="ptype">
          <Select id="ptype" value={type} onChange={(e) => setType(e.target.value)} disabled={busy}>
            {Object.entries(ASSETS[asset].types).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </Select>
        </Field>
      </div>

      {lookupEnabled ? (
        <div className="rounded-xl border border-line p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field label="Property address" htmlFor="addr" hint="Pulls beds, baths, square feet, year built, last sale, taxes, value and rent estimates, comps and the active listing from public records and MLS data." className="flex-1">
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <Input id="addr" className="pl-9" placeholder="1234 Main St, Memphis, TN 38118" value={address} onChange={(e) => { setAddress(e.target.value); setRecord(null); }} disabled={busy || looking} />
              </div>
            </Field>
            <Button type="button" variant="secondary" onClick={pull} disabled={busy || looking} className="sm:mb-6">
              {looking ? <Loader2 className="animate-spin" /> : <Database />} {looking ? "Pulling…" : "Pull property data"}
            </Button>
          </div>
          {record ? <PropertyRecordPanel record={record} notes={lookupNotes} compact /> : null}
        </div>
      ) : null}

      <Field label="Listing text or OM summary" htmlFor="text" hint="Optional with property data. Paste the listing description for repairs, seller notes and income details. Menus and ads are ignored.">
        <Textarea id="text" rows={7} placeholder="Paste the full listing: price, beds/units, rent, NOI, repairs, days on market…" value={text} onChange={(e) => setText(e.target.value)} disabled={busy} />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <label className={cn("inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2 text-sm text-muted hover:border-muted hover:text-text", busy && "pointer-events-none opacity-50")}>
          <FileUp className="size-4" />
          {file ? `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)` : `Upload OM or flyer (PDF, up to ${maxPdfLabel})`}
          <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            if (f && f.size > maxPdf) {
              setErr(`That PDF is over ${maxPdfLabel}. Upload a smaller version (most PDF tools can compress it) or paste the listing text.`);
              e.target.value = "";
              return;
            }
            setErr("");
            setFile(f);
          }} />
        </label>
        {file ? (
          <button type="button" className="inline-flex items-center gap-1 text-xs text-muted hover:text-text" onClick={() => setFile(null)}>
            <X className="size-3.5" /> Remove
          </button>
        ) : null}
      </div>

      <details className="group rounded-xl border border-line">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
          Quick numbers <span className="font-normal text-muted">(optional: anything you type here wins over the listing)</span>
        </summary>
        <div className="grid gap-4 border-t border-line-soft p-4 sm:grid-cols-4">
          {qf("name", "Deal name", "12 Oak St", "text")}
          {qf("city", "City", "Memphis", "text")}
          {qf("state", "State", "TN", "text")}
          {qf("list", "Asking price", "185,000")}
          {qf("rentMonthly", "Rent per month (total)", "1,650")}
          {qf("noi", "NOI per year", "—")}
          {qf("arv", "After-repair value", "245,000")}
          {qf("rehab", "Repairs", "35,000")}
        </div>
      </details>

      {err ? <p role="alert" className="rounded-lg border border-stop/30 bg-stop/10 px-3 py-2 text-sm text-stop">{err}</p> : null}

      {busy ? (
        <ol className="space-y-2 rounded-xl border border-line bg-raised/50 p-4" aria-live="polite">
          {STEPS.map((s, i) => (
            <li key={s} className={cn("flex items-center gap-2.5 text-sm", i > step && "text-muted")}>
              {i < step ? <Check className="size-4 text-go" /> : i === step ? <Loader2 className="size-4 animate-spin" /> : <span className="size-4 rounded-full border border-line" />}
              {s}
            </li>
          ))}
        </ol>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{`${left.toLocaleString()} ${left === 1 ? "analysis" : "analyses"} left${plan === "free" ? " on Scout" : " this month"}`}</p>
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          {busy ? "Analyzing…" : "Analyze deal"} {!busy ? <ArrowRight /> : null}
        </Button>
      </div>
    </form>
  );
}
