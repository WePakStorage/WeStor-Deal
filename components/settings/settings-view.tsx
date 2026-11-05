"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, CreditCard, Gauge, Sparkles, Users } from "lucide-react";
import { demoSetPlan, openBillingPortal } from "@/lib/actions/billing";
import { updateDefaults, updateOrgSettings } from "@/lib/actions/settings";
import { date } from "@/lib/format";
import type { Org, Plan } from "@/lib/types";
import Link from "next/link";
import { PLANS, type PaidPlan } from "@/lib/billing/plans";
import { Badge, Button, Card, CardHeader, Field, Input } from "@/components/ui/primitives";
import { NumberInput } from "@/components/ui/number-input";
import { Segmented, Tabs, TabsContent, TabsList, TabsTrigger, useToast } from "@/components/ui/interactive";
import { useApp } from "@/components/shell/app-provider";
import { track } from "@/components/analytics";

export function SettingsView(p: {
  org: Org;
  isOwner: boolean;
  spaceKind: "personal" | "team";
  /** The signed-in person's own plan (billing is per person, on their personal space). */
  plan: Plan;
  sub: { status: string; periodEnd: string | null; hasCustomer: boolean };
  billingLive: boolean;
  demo: boolean;
  inboundAddress: string;
  initialTab: string;
  checkoutSuccess: boolean;
  /** From the pricing page: open the plan picker at this tier once. */
  wantPlan: PaidPlan | null;
}) {
  const toast = useToast();
  const { openUpgrade } = useApp();
  React.useEffect(() => {
    if (p.wantPlan && PLANS[p.plan].rank < PLANS[p.wantPlan].rank && !p.checkoutSuccess) openUpgrade(undefined, p.wantPlan);
  }, [p.wantPlan, p.plan, p.checkoutSuccess, openUpgrade]);
  React.useEffect(() => {
    if (p.checkoutSuccess) {
      track("subscribed");
      toast("Your plan is active. Welcome to UndrIq");
    }
  }, [p.checkoutSuccess, toast]);

  return (
    <Tabs defaultValue={p.initialTab}>
      <TabsList>
        <TabsTrigger value="firm"><Building2 /> Branding</TabsTrigger>
        <TabsTrigger value="team"><Users /> Team</TabsTrigger>
        <TabsTrigger value="defaults"><Gauge /> Defaults</TabsTrigger>
        <TabsTrigger value="billing"><CreditCard /> Billing</TabsTrigger>
      </TabsList>
      <TabsContent value="firm"><FirmForm org={p.org} disabled={!p.isOwner} /></TabsContent>
      <TabsContent value="team"><TeamPointer spaceKind={p.spaceKind} /></TabsContent>
      <TabsContent value="defaults"><Defaults org={p.org} /></TabsContent>
      <TabsContent value="billing"><Billing {...p} /></TabsContent>
    </Tabs>
  );
}

function FirmForm({ org, disabled }: { org: Org; disabled: boolean }) {
  const [v, setV] = React.useState({ name: org.name, brand_name: org.brand_name, brand_tagline: org.brand_tagline, contact_name: org.contact_name, contact_phone: org.contact_phone, contact_email: org.contact_email, disclosure_entity: org.disclosure_entity, logo_url: org.logo_url ?? "" });
  const [busy, setBusy] = React.useState(false);
  const toast = useToast();
  const router = useRouter();
  const f = (k: keyof typeof v, label: string, hint?: string, type = "text") => (
    <Field label={label} htmlFor={`o-${k}`} hint={hint}>
      <Input id={`o-${k}`} type={type} disabled={disabled} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
    </Field>
  );
  return (
    <form
      className="space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const res = await updateOrgSettings(v);
        setBusy(false);
        if (!res.ok) return toast(res.error, "error");
        toast("Settings saved");
        router.refresh();
      }}
    >
      <Card>
        <CardHeader title="Branding" description="Shown on previews and OMs." />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {f("name", "Firm name")}
          {f("brand_name", "Brand name", "e.g. WePak Storage")}
          {f("brand_tagline", "Tagline")}
          {f("logo_url", "Logo URL", "PNG or JPG, https://")}
        </div>
      </Card>
      <Card>
        <CardHeader title="Contact on documents" />
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          {f("contact_name", "Name")}
          {f("contact_phone", "Phone", undefined, "tel")}
          {f("contact_email", "Email", undefined, "email")}
        </div>
      </Card>
      <Card>
        <CardHeader title="Disclosure entity" description="The legal entity that signs purchase contracts. Named in the equitable-interest disclosure on every OM." />
        <div className="p-5">{f("disclosure_entity", "Legal entity", "e.g. WePak WeShip LLC")}</div>
      </Card>
      {!disabled ? <div className="flex justify-end"><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button></div> : <p className="text-sm text-muted">Only the owner can change these settings.</p>}
    </form>
  );
}

function TeamPointer({ spaceKind }: { spaceKind: "personal" | "team" }) {
  return (
    <Card className="p-6">
      <div className="font-medium">Teams live on their own page</div>
      <p className="mt-1 text-sm text-muted">
        {spaceKind === "team"
          ? "You're in a team space now. See who's in it, add people or leave from Team."
          : "Your pipeline and buyers here are private to you. Firm and Fund owners can create a shared team space and add people from Team."}
      </p>
      <Button asChild className="mt-4"><Link href="/app/team"><Users /> Open Team</Link></Button>
    </Card>
  );
}

function Defaults({ org }: { org: Org }) {
  const [v, setV] = React.useState(org.defaults);
  const toast = useToast();
  const router = useRouter();
  return (
    <Card>
      <CardHeader title="Underwriting defaults" description="Starting assumptions for the live panel, max offer and OM returns." />
      <form
        className="grid gap-5 p-5 sm:grid-cols-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await updateDefaults(v);
          if (!res.ok) return toast(res.error, "error");
          toast("Defaults saved");
          router.refresh();
        }}
      >
        <Field label="Down payment" htmlFor="d-down"><NumberInput id="d-down" suffix="%" value={Math.round(v.down_pct * 100)} onChange={(x) => setV({ ...v, down_pct: (x ?? 0) / 100 })} /></Field>
        <Field label="Interest rate" htmlFor="d-rate"><NumberInput id="d-rate" suffix="%" decimals={3} value={Number((v.rate * 100).toFixed(3))} onChange={(x) => setV({ ...v, rate: (x ?? 0) / 100 })} /></Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-muted">Amortization</span>
          <Segmented label="Amortization" value={v.years} onChange={(y) => setV({ ...v, years: y })} options={[20, 25, 30].map((y) => ({ value: y, label: `${y} yr` }))} />
        </div>
        <Field label="Target DSCR" htmlFor="d-dscr"><NumberInput id="d-dscr" suffix="x" decimals={2} value={v.target_dscr} onChange={(x) => setV({ ...v, target_dscr: x ?? 0 })} /></Field>
        <Field label="Target cap rate" htmlFor="d-cap"><NumberInput id="d-cap" suffix="%" decimals={2} value={Number((v.target_cap * 100).toFixed(2))} onChange={(x) => setV({ ...v, target_cap: (x ?? 0) / 100 })} /></Field>
        <Field label="Target assignment fee" htmlFor="d-fee"><NumberInput id="d-fee" prefix="$" value={v.assignment_fee} onChange={(x) => setV({ ...v, assignment_fee: x ?? 0 })} /></Field>
        <div className="flex justify-end sm:col-span-3"><Button type="submit">Save defaults</Button></div>
      </form>
    </Card>
  );
}

function Billing(p: { plan: Plan; sub: { status: string; periodEnd: string | null; hasCustomer: boolean }; billingLive: boolean; demo: boolean; inboundAddress: string }) {
  const { openUpgrade } = useApp();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const cfg = PLANS[p.plan];
  const paid = p.plan !== "free";
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm text-muted">Your plan</div>
            <div className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
              {cfg.name} {paid ? <Badge tone="gold"><Sparkles className="size-3" /> ${cfg.priceMonthly}/mo</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-muted">
              {paid
                ? p.sub.status === "past_due"
                  ? "Payment failed. Your plan stays on while Stripe retries the card."
                  : `Renews ${date(p.sub.periodEnd)}. ${cfg.analyses.toLocaleString()} analyses a month${cfg.seats > 1 ? `, team spaces up to ${cfg.seats} people` : ""}.`
                : "3 free analyses (the first fully unlocked). Upgrade for the full analysis on every deal, your pipeline and offers."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {p.plan !== "fund" ? <Button onClick={() => openUpgrade(undefined, p.plan === "free" ? "investor" : p.plan === "investor" ? "firm" : "fund")}><Sparkles /> {paid ? "Change plan" : "See plans"}</Button> : null}
            {paid ? (
              p.demo ? (
                <Button variant="secondary" onClick={async () => { await demoSetPlan("free"); toast("Back on Scout (demo mode)"); router.refresh(); }}>Cancel (demo)</Button>
              ) : (
                <Button variant="secondary" disabled={busy || !p.billingLive} onClick={async () => {
                  setBusy(true);
                  const res = await openBillingPortal();
                  setBusy(false);
                  if (!res.ok) return toast(res.error, "error");
                  window.location.href = res.data.url;
                }}><CreditCard /> Manage billing</Button>
              )
            ) : null}
          </div>
        </div>
        {p.demo && paid ? (
          <div className="mt-4 flex items-center gap-3 border-t border-line-soft pt-4 text-xs text-muted">
            Demo: simulate a failed payment
            <Button size="sm" variant="ghost" onClick={async () => { await demoSetPlan(p.plan, "past_due"); router.refresh(); }}>Set past due</Button>
            <Button size="sm" variant="ghost" onClick={async () => { await demoSetPlan(p.plan, "active"); router.refresh(); }}>Set active</Button>
          </div>
        ) : null}
      </Card>
      <Card className="p-6">
        <div className="font-medium">Listing alert inbox</div>
        <p className="mt-1 text-sm text-muted">Forward saved-search emails here and each listing lands in this space&apos;s self-storage deal list.</p>
        <code className="mt-3 block select-all rounded-lg border border-line bg-raised px-3 py-2 text-sm">{p.inboundAddress}</code>
      </Card>
    </div>
  );
}
