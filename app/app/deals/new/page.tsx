import { PageHeader } from "@/components/ui/primitives";
import { NewDealForm } from "@/components/deals/new-deal-form";
import { OmUpload } from "@/components/deals/om-upload";
import { NewDealTabs } from "@/components/deals/new-deal-tabs";
import { requireContext } from "@/lib/server/context";

export const metadata = { title: "Add deal" };

export default async function NewDealPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  const { store, orgId, plan } = await requireContext();
  const used = await store.countUserDeals(orgId);
  const remaining = plan.dealLimit === null ? null : Math.max(0, plan.dealLimit - used);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Add a deal" description="Upload the broker OM and we'll read it for you, or type the numbers in." />
      <NewDealTabs
        initial={mode === "om" ? "om" : "manual"}
        manual={<NewDealForm remaining={remaining} />}
        om={<OmUpload />}
      />
    </div>
  );
}
