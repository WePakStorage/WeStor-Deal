import { z } from "zod";
import type { Deal, Stage } from "./types";

export const CONTRACT_STAGES: Stage[] = ["under_contract", "assigned"];

export const contractSchema = z.object({
  contract_signed_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date the contract was signed"),
  contract_price: z.coerce.number().positive("Enter the contract price"),
  assignable: z.boolean(),
});
export type ContractInput = z.infer<typeof contractSchema>;

export type StageMove =
  | { ok: true; patch: Partial<Deal> }
  | { ok: false; error: string; needsContract?: boolean };

/**
 * Decide whether a deal may move to `to`. Moving into Under contract or
 * Assigned requires a recorded contract (date, price, assignable flag).
 */
export function planStageMove(deal: Pick<Deal, "stage" | "contract_signed_at" | "contract_price">, to: Stage, contract?: unknown): StageMove {
  if (deal.stage === to) return { ok: true, patch: {} };
  if (!CONTRACT_STAGES.includes(to)) return { ok: true, patch: { stage: to } };

  if (contract !== undefined) {
    const parsed = contractSchema.safeParse(contract);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Contract details are required", needsContract: true };
    return { ok: true, patch: { stage: to, ...parsed.data } };
  }
  if (to === "assigned" && deal.contract_signed_at && deal.contract_price) return { ok: true, patch: { stage: to } };
  return { ok: false, error: "Record the signed contract before moving this deal to Under contract.", needsContract: true };
}

/** Full OM generation gate (section 6.6). */
export function canGenerateOm(deal: Pick<Deal, "stage" | "contract_signed_at">): { ok: true } | { ok: false; reason: string } {
  if (!CONTRACT_STAGES.includes(deal.stage)) return { ok: false, reason: "The full OM unlocks once the deal is Under contract or Assigned." };
  if (!deal.contract_signed_at) return { ok: false, reason: "Record the contract signing date before generating the OM." };
  return { ok: true };
}
