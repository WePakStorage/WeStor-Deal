import { notFound } from "next/navigation";
import { ResultView } from "@/components/undriq/result-view";
import { requireContext } from "@/lib/server/context";
import { topBuyers } from "@/lib/undriq/match";
import { offerDefaults } from "@/lib/undriq/offers";
import { fallbackMemo, rulesFor, viewFor } from "@/lib/undriq/service";

export const metadata = { title: "Deal analysis" };

export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await requireContext();
  const row = await ctx.uq.getAnalysis(ctx.orgId, id);
  if (!row) notFound();
  const rules = await rulesFor(ctx);
  const view = viewFor(ctx, row, rules);
  const full = view.full;
  const buyers = full && ctx.plan.features.buyers ? topBuyers(row.facts, full.ladder?.[1]?.price ?? row.facts.list, await ctx.store.listBuyers(ctx.orgId)) : [];
  // Deals first run on Scout (or from the bulk analyzer) have no written memo: fill it from the numbers.
  const memoEmpty = !row.memo || (!row.memo.thesis.length && !row.memo.risks.length && !row.memo.killers.length);
  const fullMemo = full ? (memoEmpty ? { ...fallbackMemo(full), headline: row.memo?.headline || fallbackMemo(full).headline } : row.memo) : null;
  const defaults = full ? offerDefaults(row.facts, full, {}) : null;

  return (
    <ResultView
      row={{ id: row.id, name: row.name, asset: row.asset, type: row.property_type, city: row.city, state: row.state, link: row.listing_url, stage: row.stage, notes: row.notes, createdAt: row.created_at, offers: row.offers }}
      facts={row.facts}
      teaser={view.teaser}
      full={full}
      memo={full ? fullMemo : row.memo ? { ...row.memo, thesis: [], risks: [], nextSteps: [], killers: [], mustBeTrue: [], offerScript: "" } : null}
      motivation={full ? row.motivation : null}
      buyers={buyers}
      offerDefaults={defaults}
      customRules={ctx.plan.features.buyBoxRules}
      records={row.records ?? null}
      sample={view.sample}
    />
  );
}
