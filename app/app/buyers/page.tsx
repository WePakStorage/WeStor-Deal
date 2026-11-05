import { BuyerCrm } from "@/components/buyers/buyer-crm";
import { UpgradeCard } from "@/components/undriq/upgrade-card";
import { PageHeader } from "@/components/ui/primitives";
import { requireContext } from "@/lib/server/context";

export const metadata = { title: "Buyers" };

export default async function BuyersPage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const { b } = await searchParams;
  const { store, orgId, plan, space } = await requireContext();
  if (!plan.features.buyers) {
    return <UpgradeCard title="Your buyer list" body="Keep every buyer's buy box in one place. Each deal you analyze is ranked against them, so you know who to send it to." min="investor" />;
  }
  const buyers = await store.listBuyers(orgId);
  return (
    <>
      <PageHeader title="Buyers" description={space.kind === "personal" ? "Your private buyer list. Every deal you analyze is ranked against these buy boxes." : `Shared with everyone in ${space.name}. Every deal is ranked against these buy boxes.`} />
      <BuyerCrm buyers={buyers} focusId={b ?? null} />
    </>
  );
}
