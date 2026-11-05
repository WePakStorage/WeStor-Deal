"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Info } from "lucide-react";
import { createDeal } from "@/lib/actions/deals";
import { PROPERTY_TYPE_LABEL, PROPERTY_TYPES, STAGE_LABEL, type Stage } from "@/lib/types";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/interactive";
import { useApp } from "@/components/shell/app-provider";
import { track } from "@/components/analytics";

const STAGE_CHOICES: Stage[] = ["sourced", "underwriting", "negotiating"];

export function NewDealForm({ remaining }: { remaining: number | null }) {
  const router = useRouter();
  const toast = useToast();
  const { openUpgrade } = useApp();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const v = (k: string) => String(fd.get(k) ?? "");
    setBusy(true);
    setError(null);
    const res = await createDeal({
      name: v("name"),
      market_city: v("market_city"),
      market_state: v("market_state"),
      address: v("address"),
      property_type: v("property_type") as (typeof PROPERTY_TYPES)[number],
      units: v("units"),
      nrsf: v("nrsf"),
      acres: v("acres"),
      year_built: v("year_built"),
      physical_occupancy: v("occupancy"),
      list_price: v("list_price"),
      target_price: v("target_price"),
      appraised_value: v("appraised_value"),
      stage: v("stage") as Stage,
      notes: v("notes"),
      t12_egi: v("t12_egi"),
      t12_expenses: v("t12_expenses"),
      t12_noi: v("t12_noi"),
    } as never);
    setBusy(false);
    if (!res.ok) {
      if (res.status === 402) openUpgrade(res.error);
      setError(res.error);
      return;
    }
    track("deal_created", { via: "manual" });
    toast("Deal created");
    router.push(`/app/deals/${res.data.id}`);
  }

  if (remaining === 0) {
    return (
      <Card className="p-6">
        <div className="font-medium">You&apos;ve used the 3 deals on the Free plan</div>
        <p className="mt-1 text-sm text-muted">Upgrade to Investor for unlimited deals, live underwriting and the OM reader.</p>
        <Button className="mt-4" variant="gold" onClick={() => openUpgrade()}>Unlock for $49/month</Button>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {remaining !== null ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Info className="size-4" /> {remaining} of 3 free deals left. Sample deals don&apos;t count.
        </p>
      ) : null}

      <Section title="Property">
        <Field label="Deal name" htmlFor="name" className="sm:col-span-2">
          <Input id="name" name="name" required placeholder="West San Antonio Storage" />
        </Field>
        <Field label="City" htmlFor="market_city"><Input id="market_city" name="market_city" required placeholder="San Antonio" /></Field>
        <Field label="State" htmlFor="market_state"><Input id="market_state" name="market_state" required maxLength={2} placeholder="TX" className="uppercase" /></Field>
        <Field label="Street address" htmlFor="address" hint="Private. Never shown on previews or OMs." className="sm:col-span-2">
          <Input id="address" name="address" placeholder="Optional" />
        </Field>
        <Field label="Property type" htmlFor="property_type">
          <Select id="property_type" name="property_type" defaultValue="drive_up">
            {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{PROPERTY_TYPE_LABEL[t]}</option>)}
          </Select>
        </Field>
        <Field label="Stage" htmlFor="stage">
          <Select id="stage" name="stage" defaultValue="sourced">
            {STAGE_CHOICES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
          </Select>
        </Field>
        <Field label="Units" htmlFor="units"><Input id="units" name="units" inputMode="numeric" placeholder="87" /></Field>
        <Field label="Net rentable SF" htmlFor="nrsf"><Input id="nrsf" name="nrsf" inputMode="numeric" placeholder="21,650" /></Field>
        <Field label="Acres" htmlFor="acres"><Input id="acres" name="acres" inputMode="decimal" placeholder="1.5" /></Field>
        <Field label="Year built" htmlFor="year_built"><Input id="year_built" name="year_built" inputMode="numeric" placeholder="1960" /></Field>
        <Field label="Physical occupancy %" htmlFor="occupancy"><Input id="occupancy" name="occupancy" inputMode="decimal" placeholder="84" /></Field>
      </Section>

      <Section title="Pricing">
        <Field label="List price" htmlFor="list_price"><Input id="list_price" name="list_price" inputMode="numeric" placeholder="$760,000" /></Field>
        <Field label="Your target price" htmlFor="target_price"><Input id="target_price" name="target_price" inputMode="numeric" placeholder="$715,000" /></Field>
        <Field label="Appraised value" htmlFor="appraised_value"><Input id="appraised_value" name="appraised_value" inputMode="numeric" placeholder="Optional" /></Field>
      </Section>

      <Section title="T-12 financials" description="Enter NOI, or EGI and expenses and we'll calculate it.">
        <Field label="Effective gross income" htmlFor="t12_egi"><Input id="t12_egi" name="t12_egi" inputMode="numeric" placeholder="$104,620" /></Field>
        <Field label="Total expenses" htmlFor="t12_expenses"><Input id="t12_expenses" name="t12_expenses" inputMode="numeric" placeholder="$39,507" /></Field>
        <Field label="NOI" htmlFor="t12_noi"><Input id="t12_noi" name="t12_noi" inputMode="numeric" placeholder="$65,113" /></Field>
      </Section>

      <Section title="Notes">
        <Field label="Notes" htmlFor="notes" className="sm:col-span-3"><Textarea id="notes" name="notes" placeholder="Seller motivation, call notes, next steps" /></Field>
      </Section>

      {error ? <p className="text-sm text-stop">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={busy}>{busy ? "Creating…" : "Create deal"} <ArrowRight /></Button>
      </div>
    </form>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-medium">{title}</h2>
      {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">{children}</div>
    </Card>
  );
}
