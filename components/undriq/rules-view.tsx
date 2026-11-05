"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Save } from "lucide-react";
import { saveBuyBox } from "@/lib/actions/undriq";
import { ASSET_CLASSES, ASSETS } from "@/lib/undriq/assets";
import type { BuyBoxRules } from "@/lib/undriq/engine";
import { Button, Card, CardHeader, Field } from "@/components/ui/primitives";
import { NumberInput } from "@/components/ui/number-input";
import { useToast } from "@/components/ui/interactive";

type Scalar = Exclude<keyof BuyBoxRules, "caps">;
const FIELDS: { k: Scalar; label: string; kind: "pct" | "usd" | "x" | "n"; hint?: string }[] = [
  { k: "arvPct", label: "Max offer as % of ARV (houses)", kind: "pct", hint: "The 70% rule." },
  { k: "feeResi", label: "Wholesale fee, residential", kind: "usd" },
  { k: "feeComm", label: "Wholesale fee, commercial", kind: "usd" },
  { k: "down", label: "Down payment", kind: "pct" },
  { k: "rate", label: "Interest rate", kind: "pct" },
  { k: "years", label: "Amortization (years)", kind: "n" },
  { k: "targetDscr", label: "Target DSCR", kind: "x" },
  { k: "sellPct", label: "Selling costs", kind: "pct" },
  { k: "holdMonths", label: "Flip hold (months)", kind: "n" },
  { k: "flipMargin", label: "Flip profit margin", kind: "pct" },
  { k: "refiLtv", label: "BRRRR refinance LTV", kind: "pct" },
  { k: "sfDown", label: "Seller finance down payment", kind: "pct" },
  { k: "sfRate", label: "Seller finance rate", kind: "pct" },
];

export function RulesView({ initial, defaults }: { initial: BuyBoxRules; defaults: BuyBoxRules }) {
  const [r, setR] = React.useState(initial);
  const [pending, start] = React.useTransition();
  const toast = useToast();
  const router = useRouter();
  const input = (k: Scalar, kind: string) => {
    const v = r[k];
    if (kind === "pct") return <NumberInput id={`r-${k}`} suffix="%" decimals={2} value={+(v * 100).toFixed(2)} onChange={(x) => setR({ ...r, [k]: (x ?? 0) / 100 })} />;
    if (kind === "usd") return <NumberInput id={`r-${k}`} prefix="$" value={v} onChange={(x) => setR({ ...r, [k]: x ?? 0 })} />;
    if (kind === "x") return <NumberInput id={`r-${k}`} suffix="x" decimals={2} value={v} onChange={(x) => setR({ ...r, [k]: x ?? 0 })} />;
    return <NumberInput id={`r-${k}`} grouping={false} value={v} onChange={(x) => setR({ ...r, [k]: Math.round(x ?? 0) })} />;
  };
  const save = () => start(async () => {
    const res = await saveBuyBox(r);
    if (!res.ok) return toast(res.error, "error");
    toast("Buy box saved. New scores use it right away");
    router.refresh();
  });
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Offer and financing" />
        <div className="grid gap-5 p-5 sm:grid-cols-3">
          {FIELDS.map((f) => <Field key={f.k} label={f.label} htmlFor={`r-${f.k}`} hint={f.hint}>{input(f.k, f.kind)}</Field>)}
        </div>
      </Card>
      <Card>
        <CardHeader title="Target cap rates" description="Your buyer's required cap rate by asset class. Drives commercial max offers." />
        <div className="grid gap-5 p-5 sm:grid-cols-5">
          {ASSET_CLASSES.map((a) => (
            <Field key={a} label={ASSETS[a].label} htmlFor={`cap-${a}`}>
              <NumberInput id={`cap-${a}`} suffix="%" decimals={2} value={+(r.caps[a] * 100).toFixed(2)} onChange={(x) => setR({ ...r, caps: { ...r.caps, [a]: (x ?? 0) / 100 } })} />
            </Field>
          ))}
        </div>
      </Card>
      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => setR(defaults)}><RotateCcw /> Reset to defaults</Button>
        <Button onClick={save} disabled={pending}><Save /> {pending ? "Saving…" : "Save buy box"}</Button>
      </div>
    </div>
  );
}
