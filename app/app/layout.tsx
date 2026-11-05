import Link from "next/link";
import { AlertTriangle, FlaskConical, Users } from "lucide-react";
import { AppProvider } from "@/components/shell/app-provider";
import { MobileBar, Sidebar } from "@/components/shell/nav";
import type { PaletteItem } from "@/components/shell/command-palette";
import { requireContext } from "@/lib/server/context";
import { quotaFor } from "@/lib/undriq/service";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  const { store, orgId, personalOrgId, user, demo, space, spaces, plan } = ctx;
  const [mySub, analyses, usage] = await Promise.all([store.getSubscription(personalOrgId), plan.features.pipeline ? ctx.uq.listAnalyses(orgId) : Promise.resolve([]), quotaFor(ctx)]);
  const buyers = plan.features.buyers ? await store.listBuyers(orgId) : [];

  const items: PaletteItem[] = [
    ...analyses.map((a) => ({ id: a.id, kind: "deal" as const, label: a.name, sub: [a.city, a.state].filter(Boolean).join(", ") || "Deal", href: `/app/analyses/${a.id}` })),
    ...buyers.map((b) => ({ id: b.id, kind: "buyer" as const, label: b.firm_name, sub: b.contact_name || b.states.join(", "), href: `/app/buyers?b=${b.id}` })),
  ];

  return (
    <AppProvider plan={plan.id} demo={demo} status={mySub.status} spaceKind={space.kind}>
      <div className="flex min-h-dvh">
        <Sidebar spaces={spaces} space={space} userName={user.name} items={items} signOut={!demo} usage={usage} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileBar items={items} spaces={spaces} space={space} />
          {space.kind === "team" ? (
            <div className="flex items-center justify-center gap-2 border-b border-line bg-raised px-4 py-2 text-xs text-muted">
              <Users className="size-3.5" />
              You&apos;re working in the shared <span className="font-medium text-text">{space.name}</span> space. Everyone on the team sees these deals and buyers.
            </div>
          ) : null}
          {mySub.status === "past_due" ? (
            <div className="flex items-center justify-center gap-2 border-b border-amber/30 bg-amber/10 px-4 py-2.5 text-sm text-amber">
              <AlertTriangle className="size-4" />
              Your last payment failed. Your plan stays on while Stripe retries.
              <Link href="/app/settings?tab=billing" className="font-medium underline underline-offset-2">Update your card</Link>
            </div>
          ) : null}
          {demo ? (
            <div className="flex items-center justify-center gap-2 border-b border-line bg-surface/70 px-4 py-2 text-xs text-muted">
              <FlaskConical className="size-3.5" />
              Demo mode: data lives in memory and resets on restart. Add Supabase keys to go live.
            </div>
          ) : null}
          <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</main>
        </div>
      </div>
    </AppProvider>
  );
}
