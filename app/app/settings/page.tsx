import { SettingsView } from "@/components/settings/settings-view";
import { PageHeader } from "@/components/ui/primitives";
import { effectivePlan, isPaidPlan } from "@/lib/billing/plans";
import { isStripeConfigured } from "@/lib/env";
import { requireContext } from "@/lib/server/context";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; checkout?: string; plan?: string }> }) {
  const { tab, checkout, plan: wanted } = await searchParams;
  const { store, orgId, personalOrgId, space, demo } = await requireContext();
  // Branding belongs to the active space; billing belongs to the person (their personal space).
  const [org, sub] = await Promise.all([store.getOrg(orgId), store.getSubscription(personalOrgId)]);
  if (!org) throw new Error("Space not found");
  const inboundDomain = process.env.RESEND_INBOUND_DOMAIN || "inbound.undriq.app";
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Settings" description={`Settings for ${space.kind === "team" ? `the ${space.name} team space` : "your private space"}, plus your plan and billing.`} />
      <SettingsView
        org={org}
        isOwner={space.role === "owner"}
        spaceKind={space.kind}
        plan={effectivePlan(sub)}
        sub={{ status: sub.status, periodEnd: sub.current_period_end, hasCustomer: Boolean(sub.stripe_customer_id) }}
        billingLive={isStripeConfigured()}
        demo={demo}
        inboundAddress={`alerts+${org.inbound_token}@${inboundDomain}`}
        initialTab={tab ?? "firm"}
        checkoutSuccess={checkout === "success"}
        wantPlan={isPaidPlan(wanted) ? wanted : null}
      />
    </div>
  );
}
