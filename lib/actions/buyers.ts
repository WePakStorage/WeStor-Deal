"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { scoreBuyer } from "../matching";
import { buyerSchema, type BuyerInput } from "../schemas";
import { HttpError, run } from "../server/run";
import type { Buyer, MatchStatus } from "../types";
import type { ActionResult } from "./result";

export async function saveBuyer(input: BuyerInput): Promise<ActionResult<Buyer>> {
  return run(
    async ({ store, orgId }) => {
      const b = buyerSchema.parse(input);
      const saved = await store.upsertBuyer(orgId, b);
      revalidatePath("/app/buyers");
      return saved;
    },
    { pro: true },
  );
}

export async function deleteBuyer(id: string): Promise<ActionResult> {
  return run(
    async ({ store, orgId }) => {
      await store.deleteBuyer(orgId, z.string().uuid().parse(id));
      revalidatePath("/app/buyers");
      return null;
    },
    { pro: true },
  );
}

/** Rows already mapped to buyer fields on the client; validated again here. */
export async function importBuyers(rows: unknown[]): Promise<ActionResult<{ imported: number; skipped: { row: number; error: string }[] }>> {
  return run(
    async ({ store, orgId }) => {
      if (!Array.isArray(rows) || rows.length > 5000) throw new HttpError(400, "Import up to 5,000 buyers at a time.");
      const skipped: { row: number; error: string }[] = [];
      let imported = 0;
      for (const [i, row] of rows.entries()) {
        const parsed = buyerSchema.omit({ id: true }).safeParse(row);
        if (!parsed.success) {
          skipped.push({ row: i + 2, error: parsed.error.issues[0]?.message ?? "Invalid row" });
          continue;
        }
        await store.upsertBuyer(orgId, parsed.data);
        imported++;
      }
      revalidatePath("/app/buyers");
      return { imported, skipped };
    },
    { pro: true },
  );
}

export async function setMatchStatus(dealId: string, buyerId: string, status: MatchStatus): Promise<ActionResult> {
  return run(
    async ({ store, orgId, user }) => {
      const s = z.enum(["suggested", "contacted", "interested", "passed"]).parse(status);
      const [bundle, buyers] = await Promise.all([store.getDealBundle(orgId, dealId), store.listBuyers(orgId)]);
      const buyer = buyers.find((b) => b.id === buyerId);
      if (!bundle || !buyer) throw new HttpError(404, "Not found");
      const m = scoreBuyer(bundle.deal, bundle.unitMix, buyer);
      await store.setMatchStatus(orgId, dealId, buyerId, s, m.score, m.reasons);
      await store.logActivity({ org_id: orgId, deal_id: dealId, actor: user.name, action: "buyer_status", payload: { buyer: buyer.firm_name, status: s } });
      revalidatePath(`/app/deals/${dealId}`);
      return null;
    },
    { pro: true },
  );
}
