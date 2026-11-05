import "server-only";
import type { PlanConfig } from "../billing/plans";
import type { Ctx } from "./context";

export type Feature = keyof PlanConfig["features"];

export class PaymentRequiredError extends Error {
  status = 402 as const;
  constructor(message = "Upgrade your plan to use this.") {
    super(message);
  }
}

const FEATURE_PLAN: Record<Feature, string> = {
  fullAnalysis: "Investor", pipeline: "Investor", offers: "Investor", buyers: "Investor",
  csvExport: "Firm", teamSpace: "Firm", bulk: "Fund", buyBoxRules: "Firm",
};

/** Server-side feature check against the ACTIVE space's plan. The client lock is cosmetic. */
export function requireFeature(ctx: Ctx, feature: Feature): void {
  if (!ctx.plan.features[feature]) throw new PaymentRequiredError(`This needs the ${FEATURE_PLAN[feature]} plan or higher.`);
}

