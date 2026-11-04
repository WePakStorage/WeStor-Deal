import Link from "next/link";
import { Plus } from "lucide-react";
import { PipelineBoard } from "@/components/deals/pipeline-board";
import { Button, Card, PageHeader } from "@/components/ui/primitives";
import { compactMoney, pct } from "@/lib/format";
import { pipelineTotals } from "@/lib/metrics";
import { requireContext } from "@/lib/server/context";
import { Onboarding } from "@/components/onboarding";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const { store, orgId, user } = await requireContext();
  const [deals, org, buyers] = await Promise.all([store.listDeals(orgId), store.getOrg(orgId), store.listBuyers(orgId)]);
  const t = pipelineTotals(deals);
  const first = user.name.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Good to see you, ${first}`}
        description="Your acquisition pipeline at a glance. Drag a deal to move it."
        actions={
          <Button asChild>
            <Link href="/app/deals/new"><Plus /> Add deal</Link>
          </Button>
        }
      />
      <Onboarding
        steps={[
          { id: "brand", label: "Add your brand and disclosure entity", href: "/app/settings", done: Boolean(org?.brand_name && org.disclosure_entity) },
          { id: "buyers", label: "Import your buyer list", href: "/app/buyers", done: buyers.length > 4 },
          { id: "om", label: "Upload your first broker OM", href: "/app/deals/new?mode=om", done: deals.some((d) => !d.is_sample && d.name !== "West San Antonio Storage") },
        ]}
      />
      <Card className="mb-8 grid grid-cols-1 divide-y divide-line-soft sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Total label="Target pipeline value" value={compactMoney(t.targetValue)} sub={`${t.activeCount} active deals`} />
        <Total label="Under contract or assigned" value={String(t.contractedCount)} sub={t.contractedValue ? `${compactMoney(t.contractedValue)} contracted` : "None yet"} />
        <Total label="Average T-12 cap at target" value={pct(t.avgT12Cap)} sub={t.capSample ? `Across ${t.capSample} deals with a T-12` : "Add T-12 NOI to see this"} />
      </Card>
      <PipelineBoard deals={deals} />
    </>
  );
}

function Total({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="px-6 py-5">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="mt-1.5 text-[28px] font-semibold leading-none tracking-tight tabular">{value}</div>
      <div className="mt-2 text-xs text-muted">{sub}</div>
    </div>
  );
}
