"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, CreditCard, Gauge, Sparkles, UserPlus, Users } from "lucide-react";
import { demoSetPlan, openBillingPortal } from "@/lib/actions/billing";
import { inviteMember, updateDefaults, updateOrgSettings } from "@/lib/actions/settings";
import { date } from "@/lib/format";
import type { Org, Profile } from "@/lib/types";
import { Badge, Button, Card, CardHeader, Field, Input } from "@/components/ui/primitives";
import { NumberInput } from "@/components/ui/number-input";
import { Segmented, Tabs, TabsContent, TabsList, TabsTrigger, useToast } from "@/components/ui/interactive";
import { useApp } from "@/components/shell/app-provider";
import { track } from "@/components/analytics";

export function SettingsView(p: {
  org: Org;
  members: Profile[];
  isOwner: boolean;
  plan: { id: string; name: string; seats: number };
  sub: { status: string; periodEnd: string | null; hasCustomer: boolean };
  billingLive: boolean;
  demo: boolean;
  inboundAddress: string;
  initialTab: string;
  checkoutSuccess: boolean;
}) {
  const toast = useToast();
  React.useEffect(() => {
    if (p.checkoutSuccess) {
      track("subscribed");
      toast("Welcome to WeStor Pro");
    }
  }, [p.checkoutSuccess, toast]);

  return (
    <Tabs defaultValue={p.initialTab}>
      <TabsList>
        <TabsTrigger value="firm"><Building2 /> Firm and branding</TabsTrigger>
        <TabsTrigger value="team"><Users /> Team</TabsTrigger>
        <TabsTrigger value="defaults"><Gauge /> Defaults</TabsTrigger>
        <TabsTrigger value="billing"><CreditCard /> Billing</TabsTrigger>
      </TabsList>
      <TabsContent value="firm"><FirmForm org={p.org} disabled={!p.isOwner} /></TabsContent>
      <TabsContent value="team"><Team members={p.members} seats={p.plan.seats} isOwner={p.isOwner} /></TabsContent>
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

function Team({ members, seats, isOwner }: { members: Profile[]; seats: number; isOwner: boolean }) {
  const { isPro, openUpgrade } = useApp();
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const toast = useToast();
  const router = useRouter();
  return (
    <Card>
      <CardHeader title="Team" description={`${members.length} of ${seats} seats used.`} />
      <ul className="divide-y divide-line-soft">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center justify-between px-5 py-3 text-sm">
            <div><div className="font-medium">{m.full_name || m.email}</div><div className="text-xs text-muted">{m.email}</div></div>
            <Badge tone={m.role === "owner" ? "gold" : "neutral"}>{m.role === "owner" ? "Owner" : "Member"}</Badge>
          </li>
        ))}
      </ul>
      {isOwner ? (
        <form
          className="flex flex-col gap-2 border-t border-line-soft p-5 sm:flex-row"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!isPro) return openUpgrade("Team seats are part of WeStor Pro.");
            const res = await inviteMember(email, name);
            if (!res.ok) return toast(res.error, "error");
            setEmail("");
            setName("");
            toast("Invite saved. They join when they sign in with that email");
            router.refresh();
          }}
        >
          <Input aria-label="Name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input aria-label="Email" type="email" required placeholder="teammate@firm.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit"><UserPlus /> Invite</Button>
        </form>
      ) : null}
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

function Billing(p: { plan: { id: string; name: string }; sub: { status: string; periodEnd: string | null; hasCustomer: boolean }; billingLive: boolean; demo: boolean; inboundAddress: string }) {
  const { isPro, openUpgrade } = useApp();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm text-muted">Current plan</div>
            <div className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
              {p.plan.name} {isPro ? <Badge tone="gold"><Sparkles className="size-3" /> Pro</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-muted">
              {isPro
                ? p.sub.status === "past_due"
                  ? "Payment failed. Pro stays on while Stripe retries the card."
                  : `Renews ${date(p.sub.periodEnd)}.`
                : "Pipeline, deal list and up to 3 deals."}
            </p>
          </div>
          {isPro ? (
            p.demo ? (
              <Button variant="secondary" onClick={async () => { await demoSetPlan("free"); toast("Back on Free (demo mode)"); router.refresh(); }}>Cancel Pro (demo)</Button>
            ) : (
              <Button variant="secondary" disabled={busy || !p.billingLive} onClick={async () => {
                setBusy(true);
                const res = await openBillingPortal();
                setBusy(false);
                if (!res.ok) return toast(res.error, "error");
                window.location.href = res.data.url;
              }}><CreditCard /> Manage billing</Button>
            )
          ) : (
            <Button variant="gold" onClick={() => openUpgrade()}><Sparkles /> Upgrade for $49/month</Button>
          )}
        </div>
        {p.demo && isPro ? (
          <div className="mt-4 flex items-center gap-3 border-t border-line-soft pt-4 text-xs text-muted">
            Demo: simulate a failed payment
            <Button size="sm" variant="ghost" onClick={async () => { await demoSetPlan("pro", "past_due"); router.refresh(); }}>Set past due</Button>
            <Button size="sm" variant="ghost" onClick={async () => { await demoSetPlan("pro", "active"); router.refresh(); }}>Set active</Button>
          </div>
        ) : null}
      </Card>
      <Card className="p-6">
        <div className="font-medium">Listing alert inbox</div>
        <p className="mt-1 text-sm text-muted">Forward Crexi or LoopNet saved-search emails here and each listing lands in Sourced.</p>
        <code className="mt-3 block select-all rounded-lg border border-line bg-raised px-3 py-2 text-sm">{p.inboundAddress}</code>
      </Card>
    </div>
  );
}
