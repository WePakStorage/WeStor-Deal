"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { rateLimitAi } from "../server/gate";
import { HttpError, run } from "../server/run";
import { ingestAlert } from "../sourcing/ingest";
import { isStorageUse, parseCountyRow, scoreFacility } from "../sourcing/offmarket";
import type { ActionResult } from "./result";

/** Paste an alert email by hand: same path as the inbound address. */
export async function importAlertText(subject: string, text: string): Promise<ActionResult<{ created: { id: string; name: string }[] }>> {
  return run(
    async ({ store, orgId, user }) => {
      const t = z.string().trim().min(20, "Paste the full alert email").max(60_000).parse(text);
      await rateLimitAi(store, orgId);
      const r = await ingestAlert(store, orgId, { subject, text: t }, user.name);
      if (r.created.length === 0) throw new HttpError(422, "No self-storage listings found in that email.");
      revalidatePath("/app", "layout");
      return r;
    },
    { pro: true },
  );
}

/** Import an appraisal-district CSV (rows parsed on the client) and score each facility. */
export async function importCounty(county: string, state: string, useCodes: string, rows: Record<string, string>[]): Promise<ActionResult<{ scored: number; skipped: number }>> {
  return run(
    async ({ store, orgId }) => {
      const c = z.string().trim().min(2, "Name the county").parse(county);
      const st = z.string().trim().length(2, "Use a 2-letter state").parse(state).toUpperCase();
      if (rows.length > 20_000) throw new HttpError(400, "Import up to 20,000 rows at a time.");
      const codes = useCodes.split(/[,;\s]+/).filter(Boolean);
      let skipped = 0;
      const scored = [];
      for (const raw of rows) {
        const r = parseCountyRow(raw, st);
        if (!r || !isStorageUse(r.use, codes)) {
          skipped++;
          continue;
        }
        const s = scoreFacility(r);
        const { use: _use, ...rest } = r;
        void _use;
        scored.push({ ...rest, county: c, owner_type: s.owner_type, score: s.score, reasons: s.reasons, added_deal_id: null });
      }
      await store.replaceCandidates(orgId, c, scored);
      revalidatePath("/app/sourcing");
      return { scored: scored.length, skipped };
    },
    { pro: true },
  );
}

export async function addCandidateToPipeline(candidateId: string): Promise<ActionResult<{ id: string }>> {
  return run(
    async ({ store, orgId, user }) => {
      const c = (await store.listCandidates(orgId)).find((x) => x.id === candidateId);
      if (!c) throw new HttpError(404, "Not found");
      if (c.added_deal_id) return { id: c.added_deal_id };
      const deal = await store.createDeal(orgId, {
        name: `${c.situs_city || c.county} storage (${c.owner_name})`.slice(0, 120),
        market_city: c.situs_city, market_state: c.situs_state, address: null, property_type: "drive_up",
        units: null, nrsf: c.building_sf, acres: null, buildings: null, year_built: c.year_built, physical_occupancy: null,
        list_price: null, target_price: null, appraised_value: null, appraisal_date: null, stage: "sourced",
        contract_signed_at: null, contract_price: null, assignable: false,
        notes: `Off-market lead from ${c.county} County records. Parcel ${c.parcel_id}. Owner: ${c.owner_name}. Motivation score ${c.score}: ${c.reasons.join(", ")}.`,
        is_sample: false, construction: null, listing_url: null, sources: { nrsf: "appraisal", year_built: "appraisal" },
      });
      await store.markCandidateAdded(orgId, c.id, deal.id);
      await store.logActivity({ org_id: orgId, deal_id: deal.id, actor: user.name, action: "deal_created", payload: { from: "off_market", score: c.score } });
      revalidatePath("/app", "layout");
      return { id: deal.id };
    },
    { pro: true },
  );
}
