import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { Button, PageHeader } from "@/components/ui/primitives";
import { DealTable } from "@/components/deals/deal-table";
import { requireContext } from "@/lib/server/context";
import { isPro } from "@/lib/server/gate";

export const metadata = { title: "Deals" };

export default async function DealsPage() {
  const { store, orgId } = await requireContext();
  const [deals, pro] = await Promise.all([store.listDeals(orgId), isPro()]);
  return (
    <>
      <PageHeader
        title="Deals"
        description={`${deals.length} deals across ${new Set(deals.map((d) => d.market_state)).size} states.`}
        actions={
          <>
            {pro ? (
              <Button variant="secondary" asChild>
                <a href="/api/export/deals"><Download /> Export CSV</a>
              </Button>
            ) : (
              <Button variant="secondary" disabled title="CSV export comes with Firm and Fund">
                <Download /> Export CSV
              </Button>
            )}
            <Button asChild>
              <Link href="/app/deals/new"><Plus /> Add deal</Link>
            </Button>
          </>
        }
      />
      <DealTable deals={deals} />
    </>
  );
}
