import { BuyerCrm } from "@/components/buyers/buyer-crm";
import { PageHeader } from "@/components/ui/primitives";
import { requireContext } from "@/lib/server/context";
import { isPro } from "@/lib/server/gate";
import { seedBuyers } from "@/lib/seed";

export const metadata = { title: "Buyers" };

export default async function BuyersPage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const { b } = await searchParams;
  const { store, orgId } = await requireContext();
  const pro = await isPro(store, orgId);
  // Free users see sample rows behind the lock; real data never leaves the server for them.
  const buyers = pro ? await store.listBuyers(orgId) : seedBuyers(orgId);
  return (
    <>
      <PageHeader title="Buyers" description="Your buyer list and buy boxes. Every deal is ranked against them automatically." />
      <BuyerCrm buyers={buyers} focusId={b ?? null} />
    </>
  );
}
