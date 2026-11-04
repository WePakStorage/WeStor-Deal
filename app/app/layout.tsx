import Link from "next/link";
import { AlertTriangle, FlaskConical } from "lucide-react";
import { AppProvider } from "@/components/shell/app-provider";
import { MobileBar, Sidebar } from "@/components/shell/nav";
import type { PaletteItem } from "@/components/shell/command-palette";
import { planFor } from "@/lib/billing/plans";
import { requireContext } from "@/lib/server/context";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { store, orgId, user, demo } = await requireContext();
  const [org, sub, deals] = await Promise.all([store.getOrg(orgId), store.getSubscription(orgId), store.listDeals(orgId)]);
  const plan = planFor(sub);
  const isPro = plan.features.liveUnderwriting;
  const buyers = isPro ? await store.listBuyers(orgId) : [];

  const items: PaletteItem[] = [
    ...deals.map((d) => ({ id: d.id, kind: "deal" as const, label: d.name, sub: `${d.market_city}, ${d.market_state}`, href: `/app/deals/${d.id}` })),
    ...buyers.map((b) => ({ id: b.id, kind: "buyer" as const, label: b.firm_name, sub: b.contact_name || b.states.join(", "), href: `/app/buyers?b=${b.id}` })),
  ];

  return (
    <AppProvider isPro={isPro} demo={demo} status={sub.status}>
      <div className="flex min-h-dvh">
        <Sidebar orgName={org?.brand_name || org?.name || "My firm"} userName={user.name} items={items} signOut={!demo} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileBar items={items} />
          {sub.status === "past_due" ? (
            <div className="flex items-center justify-center gap-2 border-b border-amber/30 bg-amber/10 px-4 py-2.5 text-sm text-amber">
              <AlertTriangle className="size-4" />
              Your last payment failed. Pro stays on while Stripe retries.
              <Link href="/app/settings?tab=billing" className="font-medium underline underline-offset-2">Update your card</Link>
            </div>
          ) : null}
          {demo ? (
            <div className="flex items-center justify-center gap-2 border-b border-line bg-surface/70 px-4 py-2 text-xs text-muted">
              <FlaskConical className="size-3.5 text-gold" />
              Demo mode: data lives in memory and resets on restart. Add Supabase keys to go live.
            </div>
          ) : null}
          <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</main>
        </div>
      </div>
    </AppProvider>
  );
}
