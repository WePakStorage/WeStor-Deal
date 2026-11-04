import { notFound } from "next/navigation";
import { DealView } from "@/components/deals/deal-view";
import { rankBuyers } from "@/lib/matching";
import { canGenerateOm } from "@/lib/pipeline";
import { requireContext } from "@/lib/server/context";
import { isPro } from "@/lib/server/gate";
import { DEFAULT_ASSUMPTIONS } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const b = await ctx.store.getDealBundle(ctx.orgId, id);
  return { title: b?.deal.name ?? "Deal" };
}

export default async function DealPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  const { store, orgId } = await requireContext();
  const [bundle, org, pro] = await Promise.all([store.getDealBundle(orgId, id), store.getOrg(orgId), isPro(store, orgId)]);
  if (!bundle) notFound();

  let matches = null;
  if (pro) {
    const [buyers, statuses] = await Promise.all([store.listBuyers(orgId), store.listMatchStatuses(orgId, id)]);
    const ranked = rankBuyers(bundle.deal, bundle.unitMix, buyers);
    const status = Object.fromEntries(statuses.map((s) => [s.buyer_id, s.status]));
    matches = { ...ranked, status };
  }

  return (
    <DealView
      bundle={bundle}
      defaults={org?.defaults ?? DEFAULT_ASSUMPTIONS}
      matches={matches}
      omGate={canGenerateOm(bundle.deal)}
      initialTab={tab ?? "overview"}
    />
  );
}
