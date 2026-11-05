import { SettingsView } from "@/components/settings/settings-view";
import { PageHeader } from "@/components/ui/primitives";
import { effectivePlan, isPaidPlan } from "@/lib/billing/plans";
import { isStripeConfigured } from "@/lib/env";
import { requireContext } from "@/lib/server/context";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ checkout?: string; plan?: string }> }) {
  const { checkout, plan: wanted } = await searchParams;
  const { store, personalOrgId, space, user, demo } = await requireContext();
  // Billing belongs to the person (their personal space), whichever space is active.
  const sub = await store.getSubscription(personalOrgId);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" description="Your plan, billing and account." />
      <SettingsView
        account={{ name: user.name, email: user.email }}
        space={{ kind: space.kind, name: space.name }}
        plan={effectivePlan(sub)}
        sub={{ status: sub.status, periodEnd: sub.current_period_end, hasCustomer: Boolean(sub.stripe_customer_id) }}
        billingLive={isStripeConfigured()}
        demo={demo}
        checkoutSuccess={checkout === "success"}
        wantPlan={isPaidPlan(wanted) ? wanted : null}
      />
    </div>
  );
}
