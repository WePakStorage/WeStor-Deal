import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { PipelineColumns } from "@/components/undriq/pipeline-columns";
import { UpgradeCard } from "@/components/undriq/upgrade-card";
import { Button, Card, PageHeader } from "@/components/ui/primitives";
import { compactMoney } from "@/lib/format";
import { requireContext } from "@/lib/server/context";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const { uq, orgId, plan, space } = await requireContext();
  if (!plan.features.pipeline) {
    return <UpgradeCard title="Your deal pipeline" body="Save every analysis, move deals from Analyzed to Closed, and keep offers and notes in one place." min="investor" />;
  }
  const rows = await uq.listAnalyses(orgId);
  const cards = rows.map((r) => ({
    id: r.id, name: r.name, asset: r.asset, city: r.city, state: r.state, stage: r.stage, score: r.score, list: r.facts.list,
    target: r.result.full ? r.result.analysis.ladder?.[1]?.price ?? null : null, offers: r.offers.length, updatedAt: r.updated_at,
  }));
  const active = cards.filter((c) => c.stage !== "closed" && c.stage !== "dead");
  const targetSum = active.reduce((s, c) => s + (c.target ?? c.list ?? 0), 0);
  return (
    <>
      <PageHeader
        title="Pipeline"
        description={space.kind === "personal" ? "Your private pipeline. Only you can see it." : `Shared with everyone in ${space.name}.`}
        actions={
          <div className="flex gap-2">
            {plan.features.csvExport ? <Button asChild variant="secondary"><a href="/api/export/pipeline" download><Download /> Export CSV</a></Button> : null}
            <Button asChild><Link href="/app"><Plus /> Analyze a deal</Link></Button>
          </div>
        }
      />
      <Card className="mb-6 grid grid-cols-3 divide-x divide-line-soft">
        <Stat label="Active deals" value={String(active.length)} />
        <Stat label="Target value" value={compactMoney(targetSum)} />
        <Stat label="Offers out" value={String(cards.filter((c) => c.stage === "offer_sent" || c.stage === "negotiating").length)} />
      </Card>
      <PipelineColumns cards={cards} />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="display mt-1 text-3xl tabular">{value}</div>
    </div>
  );
}
