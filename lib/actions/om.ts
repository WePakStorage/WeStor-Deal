"use server";

import { revalidatePath } from "next/cache";
import { computeFlags } from "../om/flags";
import { reviewSchema, same, toReview } from "../om/review";
import { HttpError, run } from "../server/run";
import type { Source } from "../types";
import type { ActionResult } from "./result";

/**
 * Save the confirmed OM review. Values that match the stored extraction are
 * tagged broker_om; anything the user changed is tagged user.
 */
export async function saveOmReview(dealId: string, docId: string, input: unknown): Promise<ActionResult<{ flags: number }>> {
  return run(
    async ({ store, orgId, user }) => {
      const final = reviewSchema.parse(input);
      const [bundle, doc] = await Promise.all([store.getDealBundle(orgId, dealId), store.getDocument(orgId, docId)]);
      if (!bundle || !doc || doc.deal_id !== dealId) throw new HttpError(404, "Not found");
      const original = toReview(doc.extraction, bundle.deal.name);

      const src = (a: unknown, b: unknown): Source => (same(a, b) ? "broker_om" : "user");
      const P = final.property;
      const O = original.property;
      const sources: Partial<Record<string, Source>> = {
        ...bundle.deal.sources,
        units: src(P.units, O.units),
        nrsf: src(P.nrsf, O.nrsf),
        acres: src(P.acres, O.acres),
        year_built: src(P.year_built, O.year_built),
        physical_occupancy: src(final.occupancy.physical_pct, original.occupancy.physical_pct),
        list_price: src(final.pricing.list_price, original.pricing.list_price),
        appraised_value: src(final.pricing.appraised_value, original.pricing.appraised_value),
      };

      const physical = final.occupancy.physical_pct !== null ? final.occupancy.physical_pct / 100 : null;
      await store.updateDeal(orgId, dealId, {
        name: P.name,
        market_city: P.market_city,
        market_state: P.market_state,
        property_type: P.property_type,
        units: P.units,
        nrsf: P.nrsf,
        acres: P.acres,
        buildings: P.buildings,
        year_built: P.year_built,
        construction: P.construction || null,
        physical_occupancy: physical,
        list_price: final.pricing.list_price,
        appraised_value: final.pricing.appraised_value,
        target_price: bundle.deal.target_price ?? (final.pricing.list_price ? Math.round((final.pricing.list_price * 0.9) / 5000) * 5000 : null),
        sources,
      });

      await store.replaceUnitMix(orgId, dealId, final.unitMix);
      await store.replaceFinancials(
        orgId,
        dealId,
        final.periods.map((p) => ({
          ...p,
          source: src(p, original.periods.find((o) => o.period === p.period)),
        })),
      );

      const flags = computeFlags(
        {
          units: P.units,
          nrsf: P.nrsf,
          physicalOccupancy: physical,
          economicOccupancy: final.occupancy.economic_pct !== null ? final.occupancy.economic_pct / 100 : null,
          askingPrice: final.pricing.list_price,
          appraisedValue: final.pricing.appraised_value,
          statedCapRate: final.pricing.stated_cap_pct !== null ? final.pricing.stated_cap_pct / 100 : null,
          unitMix: final.unitMix,
          periods: final.periods,
        },
        "OM reader",
      );
      await store.replaceFlags(orgId, dealId, flags);
      await store.updateDocument(orgId, docId, { parsed: true, parse_status: "parsed", parse_error: null });
      await store.logActivity({ org_id: orgId, deal_id: dealId, actor: user.name, action: "om_reviewed", payload: { flags: flags.length, broker: final.broker.firm } });
      revalidatePath("/app", "layout");
      return { flags: flags.filter((f) => f.level !== "ok").length };
    },
    { pro: true },
  );
}
