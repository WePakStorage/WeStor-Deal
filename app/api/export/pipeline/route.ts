import { toCsv } from "@/lib/csv";
import { csvResponse, handle } from "@/lib/server/http";
import { ASSETS } from "@/lib/undriq/assets";
import { ANALYSIS_STAGE_LABEL } from "@/lib/undriq/types";

/** Pipeline CSV for the active space (Firm and Fund). Numbers come from the stored analysis. */
export const GET = () =>
  handle(
    async ({ uq, orgId }) => {
      const rows = (await uq.listAnalyses(orgId)).map((r) => {
        const a = r.result.full ? r.result.analysis : null;
        return {
          name: r.name,
          asset: ASSETS[r.asset].label,
          city: r.city,
          state: r.state,
          stage: ANALYSIS_STAGE_LABEL[r.stage],
          score: r.score,
          asking: r.facts.list,
          best_exit: a?.best?.name ?? (r.result.full ? null : r.result.teaser.best?.name ?? null),
          anchor: a?.ladder?.[0]?.price ?? null,
          target: a?.ladder?.[1]?.price ?? null,
          walk_away: a?.ladder?.[2]?.price ?? null,
          noi: a?.noi != null ? Math.round(a.noi) : null,
          offers: r.offers.length,
          last_offer: r.offers.at(-1)?.terms.price ?? null,
          listing_url: r.listing_url,
          updated: r.updated_at.slice(0, 10),
        };
      });
      return csvResponse(toCsv(rows), "undriq-pipeline.csv");
    },
    { feature: "csvExport" },
  );
