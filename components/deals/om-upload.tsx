"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Sparkles, UploadCloud } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, Card } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/interactive";
import { ProLock, useApp } from "@/components/shell/app-provider";
import { track } from "@/components/analytics";

const STEPS = ["Uploading", "Reading the OM", "Checking the numbers"];

export function OmUpload({ dealId, compact }: { dealId?: string; compact?: boolean }) {
  const { isPro } = useApp();
  const router = useRouter();
  const toast = useToast();
  const input = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);
  const [step, setStep] = React.useState(-1);
  const [error, setError] = React.useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (file.type !== "application/pdf") return setError("Only PDF files are supported.");
    if (file.size > 25 * 1024 * 1024) return setError("That PDF is over 25 MB.");
    setStep(0);
    const fd = new FormData();
    fd.set("file", file);
    if (dealId) fd.set("dealId", dealId);
    const t1 = setTimeout(() => setStep(1), 900);
    const t2 = setTimeout(() => setStep(2), 14_000);
    try {
      const res = await fetch("/api/om/upload", { method: "POST", body: fd });
      const body = (await res.json()) as { dealId?: string; docId?: string; status?: string; error?: string; demo?: boolean };
      if (!res.ok || !body.dealId) throw new Error(body.error ?? "Upload failed");
      track("om_uploaded");
      if (body.status === "parsed") track("om_parsed");
      toast(body.status === "parsed" ? (body.demo ? "OM read (demo extraction)" : "OM read. Review the numbers") : "Some fields need your review");
      router.push(`/app/deals/${body.dealId}/review?doc=${body.docId}`);
    } catch (e) {
      setError((e as Error).message);
      setStep(-1);
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
    }
  }

  const zone = (
    <Card
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files[0];
        if (f && isPro) void upload(f);
      }}
      className={cn(
        "relative flex flex-col items-center justify-center gap-4 border-dashed text-center transition-colors",
        compact ? "px-6 py-8" : "px-6 py-16",
        over && "border-door bg-door/[0.05]",
      )}
    >
      {step >= 0 ? (
        <>
          <Loader2 className="size-8 animate-spin text-door" />
          <div>
            <div className="font-medium">{STEPS[step]}…</div>
            <p className="mt-1 text-sm text-muted">Large OMs take up to a minute. We extract the unit mix, every financial period and the asking price.</p>
          </div>
          <ol className="flex gap-2">
            {STEPS.map((s, i) => (
              <li key={s} className={cn("h-1.5 w-10 rounded-full", i <= step ? "bg-door" : "bg-raised")} aria-label={s} />
            ))}
          </ol>
        </>
      ) : (
        <>
          <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-b from-door/20 to-door/5 text-door ring-1 ring-door/25">
            <UploadCloud className="size-6" />
          </div>
          <div>
            <div className="text-lg font-medium">Drop a broker OM here</div>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              PDF up to 25 MB. We pull out the property facts, unit mix and financials, run the red-flag checks, and show you everything to confirm before it saves.
            </p>
          </div>
          <input ref={input} type="file" accept="application/pdf" className="sr-only" aria-label="Choose an OM PDF" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
          <Button onClick={() => input.current?.click()}>
            <FileText /> Choose PDF
          </Button>
          <p className="flex items-center gap-1.5 text-xs text-muted"><Sparkles className="size-3.5 text-gold" /> Reads seller financials, T-12s and broker projections</p>
        </>
      )}
      {error ? <p className="text-sm text-stop">{error}</p> : null}
    </Card>
  );

  return <ProLock feature="OM reader">{zone}</ProLock>;
}
