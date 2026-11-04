import { SettingsView } from "@/components/settings/settings-view";
import { PageHeader } from "@/components/ui/primitives";
import { planFor } from "@/lib/billing/plans";
import { isStripeConfigured } from "@/lib/env";
import { requireContext } from "@/lib/server/context";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; checkout?: string }> }) {
  const { tab, checkout } = await searchParams;
  const { store, orgId, user, demo } = await requireContext();
  const [org, sub, members] = await Promise.all([store.getOrg(orgId), store.getSubscription(orgId), store.listMembers(orgId)]);
  if (!org) throw new Error("Org not found");
  const plan = planFor(sub);
  const inboundDomain = process.env.RESEND_INBOUND_DOMAIN || "inbound.westor.app";
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Settings" description="Branding for generated documents, your team, underwriting defaults and billing." />
      <SettingsView
        org={org}
        members={members}
        isOwner={user.role === "owner"}
        plan={{ id: plan.id, name: plan.name, seats: plan.seats }}
        sub={{ status: sub.status, periodEnd: sub.current_period_end, hasCustomer: Boolean(sub.stripe_customer_id) }}
        billingLive={isStripeConfigured()}
        demo={demo}
        inboundAddress={`alerts+${org.inbound_token}@${inboundDomain}`}
        initialTab={tab ?? "firm"}
        checkoutSuccess={checkout === "success"}
      />
    </div>
  );
}
