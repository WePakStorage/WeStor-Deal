"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Eye, FileCheck2, FileText, Lock, Scale, Sparkles, Wand2 } from "lucide-react";
import { saveNarrative } from "@/lib/actions/deals";
import { draftNarrative } from "@/lib/actions/narrative";
import { timeAgo } from "@/lib/format";
import { DOC_KIND_LABEL, type DealBundle } from "@/lib/types";
import { Badge, Button, Card, CardHeader, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/interactive";
import { useApp } from "@/components/shell/app-provider";
import { track } from "@/components/analytics";
import { OmUpload } from "../om-upload";

export function DocumentsTab({ bundle, omGate }: { bundle: DealBundle; omGate: { ok: true } | { ok: false; reason: string } }) {
  const { isPro, openUpgrade } = useApp();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = React.useState<"preview" | "om" | "draft" | "save" | null>(null);
  const [narrative, setNarrative] = React.useState(bundle.narrative ?? "");
  const dealId = bundle.deal.id;

  async function generate(kind: "preview" | "om") {
    if (!isPro) return openUpgrade(kind === "om" ? "Branded OMs are part of WeStor Pro." : "Pre-contract previews are part of WeStor Pro.");
    setBusy(kind);
    if (kind === "om" && narrative !== (bundle.narrative ?? "")) await saveNarrative(dealId, narrative);
    const res = await fetch(`/api/deals/${dealId}/generate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind }) });
    const body = (await res.json()) as { url?: string; error?: string };
    setBusy(null);
    if (!res.ok || !body.url) return toast(body.error ?? "Couldn't generate the document", "error");
    track(kind === "om" ? "om_generated" : "preview_generated");
    toast(kind === "om" ? "OM generated" : "Preview generated");
    window.open(body.url, "_blank", "noopener");
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="flex flex-col p-5">
            <div className="flex items-center gap-2 font-medium"><Eye className="size-4 text-door" /> Pre-contract preview</div>
            <p className="mt-1 flex-1 text-sm text-muted">One anonymous page with rounded ranges. No property name, address, unit count or seller financials. Safe to send before you have a contract.</p>
            <Button className="mt-4" variant="secondary" onClick={() => generate("preview")} disabled={busy !== null}>
              <FileText /> {busy === "preview" ? "Generating…" : "Generate preview"}
            </Button>
          </Card>
          <Card className="flex flex-col p-5">
            <div className="flex items-center gap-2 font-medium">
              {omGate.ok ? <FileCheck2 className="size-4 text-gold" /> : <Lock className="size-4 text-muted" />} Branded OM
            </div>
            <p className="mt-1 flex-1 text-sm text-muted">
              {omGate.ok ? "Full offering memorandum with your branding, financials, returns at the contract price and the equitable-interest disclosure." : omGate.reason}
            </p>
            <Button className="mt-4" variant={omGate.ok ? "gold" : "secondary"} onClick={() => generate("om")} disabled={busy !== null || !omGate.ok}>
              <Sparkles /> {busy === "om" ? "Generating…" : "Generate OM"}
            </Button>
          </Card>
        </div>

        {omGate.ok && isPro ? (
          <Card>
            <CardHeader
              title="Opportunity narrative"
              description="Drafted from your saved numbers. Edit it before you generate the OM."
              action={
                <Button size="sm" variant="ghost" disabled={busy !== null} onClick={async () => {
                  setBusy("draft");
                  const res = await draftNarrative(dealId);
                  setBusy(null);
                  if (!res.ok) return toast(res.error, "error");
                  setNarrative(res.data.text);
                  toast("Narrative drafted");
                }}>
                  <Wand2 /> {busy === "draft" ? "Drafting…" : narrative ? "Redraft" : "Draft with AI"}
                </Button>
              }
            />
            <div className="p-5">
              <label htmlFor="narrative" className="sr-only">Opportunity narrative</label>
              <Textarea id="narrative" className="min-h-48" value={narrative} placeholder="Draft with AI or write your own." onChange={(e) => setNarrative(e.target.value)} />
              <div className="mt-3 flex justify-end">
                <Button size="sm" variant="secondary" disabled={busy !== null || narrative === (bundle.narrative ?? "")} onClick={async () => {
                  setBusy("save");
                  const res = await saveNarrative(dealId, narrative);
                  setBusy(null);
                  if (!res.ok) return toast(res.error, "error");
                  toast("Narrative saved");
                  router.refresh();
                }}>Save narrative</Button>
              </div>
            </div>
          </Card>
        ) : null}

        <Card>
          <CardHeader title="Files" description={`${bundle.documents.length} on this deal`} />
          {bundle.documents.length === 0 ? (
            <p className="p-5 text-sm text-muted">No files yet. Upload the broker OM to extract it, or generate a preview.</p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {bundle.documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                  <FileText className="size-4 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{d.name}</div>
                    <div className="text-xs text-muted">{DOC_KIND_LABEL[d.kind]} · {timeAgo(d.created_at)}</div>
                  </div>
                  {d.kind === "broker_om" ? (
                    <Link href={`/app/deals/${dealId}/review?doc=${d.id}`} className="text-xs text-door hover:underline">
                      {d.parse_status === "needs_review" ? <Badge tone="amber">Needs review</Badge> : "Review"}
                    </Link>
                  ) : null}
                  <a href={`/api/documents/${d.id}`} target="_blank" rel="noopener" className="rounded p-1.5 text-muted hover:bg-raised hover:text-text" aria-label={`Open ${d.name}`}>
                    <Download className="size-4" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <aside className="space-y-6">
        <OmUpload dealId={dealId} compact />
        <Card className="p-5 text-sm">
          <div className="flex items-center gap-2 font-medium"><Scale className="size-4 text-gold" /> Disclosure reminder</div>
          <p className="mt-2 leading-relaxed text-muted">
            Wholesaling and assignment rules differ by state. Follow your state&apos;s disclosure requirements and have an attorney review these templates before you send them. This is general information, not legal advice.
          </p>
        </Card>
      </aside>
    </div>
  );
}
