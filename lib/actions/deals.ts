"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { planStageMove } from "../pipeline";
import { dealInputSchema, dealPatchSchema, financialSchema, unitMixSchema, type DealInput } from "../schemas";
import { HttpError, run } from "../server/run";
import { STAGES, type Deal, type Stage } from "../types";
import type { ActionResult } from "./result";

export async function createDeal(input: DealInput): Promise<ActionResult<{ id: string }>> {
  return run(async ({ store, orgId, user, plan }) => {
    const v = dealInputSchema.parse(input);
    if (plan.dealLimit !== null && (await store.countUserDeals(orgId)) >= plan.dealLimit) {
      throw new HttpError(402, `The Scout plan includes ${plan.dealLimit} deals. Upgrade to Investor for unlimited deals.`);
    }
    // New deals cannot be created directly into contract stages: the contract modal must record it.
    const stage: Stage = v.stage === "under_contract" || v.stage === "assigned" ? "negotiating" : v.stage;
    const { t12_egi, t12_expenses, t12_noi, ...fields } = v;
    const deal = await store.createDeal(orgId, {
      ...fields,
      stage,
      contract_signed_at: null,
      contract_price: null,
      assignable: false,
      is_sample: false,
      sources: Object.fromEntries(Object.entries(fields).filter(([, val]) => typeof val === "number").map(([k]) => [k, "user" as const])),
    });
    const noi = t12_noi ?? (t12_egi != null && t12_expenses != null ? t12_egi - t12_expenses : null);
    if (noi !== null || t12_egi != null) {
      await store.replaceFinancials(orgId, deal.id, [
        {
          period: "t12",
          period_label: "T-12",
          potential_rent: null,
          vacancy: null,
          other_income: null,
          egi: t12_egi ?? null,
          expenses: [],
          total_expenses: t12_expenses ?? (t12_egi != null && noi !== null ? t12_egi - noi : null),
          noi,
          source: "user",
        },
      ]);
    }
    await store.logActivity({ org_id: orgId, deal_id: deal.id, actor: user.name, action: "deal_created", payload: { name: deal.name } });
    revalidatePath("/app", "layout");
    return { id: deal.id };
  });
}

export async function updateDeal(dealId: string, patch: Partial<DealInput>): Promise<ActionResult<Deal>> {
  return run(async ({ store, orgId, user }) => {
    const v = dealPatchSchema.parse(patch);
    const current = await store.getDealBundle(orgId, z.string().uuid().parse(dealId));
    if (!current) throw new HttpError(404, "Deal not found");
    const edited = Object.keys(v).filter((k) => typeof v[k as keyof typeof v] === "number");
    const sources = { ...current.deal.sources, ...Object.fromEntries(edited.map((k) => [k, "user" as const])) };
    const deal = await store.updateDeal(orgId, dealId, { ...v, sources });
    await store.logActivity({ org_id: orgId, deal_id: dealId, actor: user.name, action: "deal_updated", payload: { fields: Object.keys(v) } });
    revalidatePath(`/app/deals/${dealId}`);
    return deal;
  });
}

export async function moveStage(dealId: string, to: Stage, contract?: unknown): Promise<ActionResult<{ needsContract?: boolean }>> {
  return run(async ({ store, orgId, user }) => {
    const stage = z.enum(STAGES).parse(to);
    const bundle = await store.getDealBundle(orgId, dealId);
    if (!bundle) throw new HttpError(404, "Deal not found");
    const plan = planStageMove(bundle.deal, stage, contract);
    if (!plan.ok) {
      const err = new HttpError(422, plan.error) as HttpError & { needsContract?: boolean };
      throw err;
    }
    if (Object.keys(plan.patch).length === 0) return {};
    await store.updateDeal(orgId, dealId, plan.patch);
    await store.logActivity({
      org_id: orgId,
      deal_id: dealId,
      actor: user.name,
      action: "stage_changed",
      payload: { from: bundle.deal.stage, to: stage, ...(plan.patch.contract_price ? { contract_price: plan.patch.contract_price, contract_signed_at: plan.patch.contract_signed_at } : {}) },
    });
    revalidatePath("/app", "layout");
    return {};
  });
}

export async function saveFinancials(dealId: string, rows: unknown): Promise<ActionResult> {
  return run(
    async ({ store, orgId, user }) => {
      const parsed = z.array(financialSchema).parse(rows);
      await store.replaceFinancials(orgId, dealId, parsed);
      await store.logActivity({ org_id: orgId, deal_id: dealId, actor: user.name, action: "financials_updated", payload: { periods: parsed.map((p) => p.period) } });
      revalidatePath(`/app/deals/${dealId}`);
      return null;
    },
    { pro: true },
  );
}

export async function saveUnitMix(dealId: string, rows: unknown): Promise<ActionResult> {
  return run(
    async ({ store, orgId, user }) => {
      const parsed = z.array(unitMixSchema).parse(rows);
      await store.replaceUnitMix(orgId, dealId, parsed);
      const units = parsed.reduce((s, r) => s + r.count, 0);
      const occ = parsed.reduce((s, r) => s + r.occupied, 0);
      if (units > 0) await store.updateDeal(orgId, dealId, { units, physical_occupancy: occ / units });
      await store.logActivity({ org_id: orgId, deal_id: dealId, actor: user.name, action: "unit_mix_updated", payload: { rows: parsed.length } });
      revalidatePath(`/app/deals/${dealId}`);
      return null;
    },
    { pro: true },
  );
}

export async function addTask(dealId: string, title: string, due: string | null): Promise<ActionResult> {
  return run(async ({ store, orgId, user }) => {
    const t = z.string().trim().min(1, "Enter a task").parse(title);
    await store.addTask(orgId, { deal_id: dealId, title: t, due_date: due || null, assignee: user.name });
    revalidatePath(`/app/deals/${dealId}`);
    return null;
  });
}

export async function toggleTask(dealId: string, taskId: string, done: boolean): Promise<ActionResult> {
  return run(async ({ store, orgId }) => {
    await store.updateTask(orgId, taskId, { done });
    revalidatePath(`/app/deals/${dealId}`);
    return null;
  });
}

export async function deleteTask(dealId: string, taskId: string): Promise<ActionResult> {
  return run(async ({ store, orgId }) => {
    await store.deleteTask(orgId, taskId);
    revalidatePath(`/app/deals/${dealId}`);
    return null;
  });
}

export async function saveNarrative(dealId: string, text: string): Promise<ActionResult> {
  return run(
    async ({ store, orgId }) => {
      await store.setNarrative(orgId, dealId, z.string().max(8000).parse(text));
      revalidatePath(`/app/deals/${dealId}`);
      return null;
    },
    { pro: true },
  );
}
