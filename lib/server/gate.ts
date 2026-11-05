import "server-only";
import { PLANS, type PlanConfig } from "../billing/plans";
import type { Store } from "../data/store";
import { isDemoMode } from "../env";
import { demoSpacePlan } from "../data/uq-memory";
import { supabaseAdmin } from "../supabase/server";
import type { Plan } from "../types";
import { getContext, type Ctx } from "./context";

export type Feature = keyof PlanConfig["features"];

export class PaymentRequiredError extends Error {
  status = 402 as const;
  constructor(message = "Upgrade your plan to use this.") {
    super(message);
  }
}

const FEATURE_PLAN: Record<Feature, string> = {
  fullAnalysis: "Investor", pipeline: "Investor", offers: "Investor", buyers: "Investor", liveUnderwriting: "Investor", omReader: "Investor", docs: "Investor", sourcing: "Investor",
  csvExport: "Firm", teamSpace: "Firm", bulk: "Fund", buyBoxRules: "Firm",
};

/** Server-side feature check against the ACTIVE space's plan. The client lock is cosmetic. */
export function requireFeature(ctx: Ctx, feature: Feature): void {
  if (!ctx.plan.features[feature]) throw new PaymentRequiredError(`This needs the ${FEATURE_PLAN[feature]} plan or higher.`);
}

/** Legacy name kept for the self-storage tools: any paid plan. */
export const requirePro = (ctx: Ctx) => requireFeature(ctx, "liveUnderwriting");

export async function isPro(): Promise<boolean> {
  const ctx = await getContext();
  return !!ctx?.plan.features.liveUnderwriting;
}

/** Plan of any space, for unauthenticated server paths (inbound email). Uses the service role. */
export async function spacePlanFor(orgId: string): Promise<PlanConfig> {
  if (isDemoMode()) return PLANS[demoSpacePlan(orgId)];
  const { data, error } = await supabaseAdmin().rpc("space_plan", { target: orgId });
  if (error) throw new Error(error.message);
  return PLANS[(data as Plan) in PLANS ? (data as Plan) : "free"];
}

/** Simple durable rate limit for AI routes: N calls per org per hour, counted from usage_events. */
export async function rateLimitAi(store: Store, orgId: string, perHour = 30): Promise<void> {
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const n = await store.countUsageSince(orgId, since);
  if (n >= perHour) {
    const err = new Error("Too many AI requests this hour. Try again shortly.") as Error & { status: number };
    err.status = 429;
    throw err;
  }
}
