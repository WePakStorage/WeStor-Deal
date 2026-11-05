import { BulkView } from "@/components/undriq/bulk-view";
import { UpgradeCard } from "@/components/undriq/upgrade-card";
import { PageHeader } from "@/components/ui/primitives";
import { requireContext } from "@/lib/server/context";

export const metadata = { title: "Bulk analyzer" };

export default async function BulkPage() {
  const { plan } = await requireContext();
  if (!plan.features.bulk) return <UpgradeCard title="Bulk analyzer" body="Paste a list of up to 500 deals, score them all at once with your buy box, and save the winners to your pipeline." min="fund" />;
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Bulk analyzer" description="Paste a spreadsheet of deals. Every row is scored by the engine with this space's buy box rules. No SI analyses are used." />
      <BulkView />
    </div>
  );
}
