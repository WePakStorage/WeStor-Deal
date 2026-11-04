import type { Plan, Subscription } from "../types";

/**
 * Plan config. To add a tier later: create the Stripe price, add a row here,
 * and widen the Plan type. Feature checks read `features`, never the plan name.
 */
export interface PlanConfig {
  id: Plan;
  name: string;
  priceMonthly: number;
  stripePriceEnv: string | null;
  dealLimit: number | null;
  seats: number;
  features: {
    liveUnderwriting: boolean;
    omReader: boolean;
    buyers: boolean;
    docs: boolean;
    csvExport: boolean;
    sourcing: boolean;
  };
}

export const PLANS: Record<Plan, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    stripePriceEnv: null,
    dealLimit: 3,
    seats: 1,
    features: { liveUnderwriting: false, omReader: false, buyers: false, docs: false, csvExport: false, sourcing: false },
  },
  pro: {
    id: "pro",
    name: "WeStor Pro",
    priceMonthly: 49,
    stripePriceEnv: "STRIPE_PRICE_PRO_MONTHLY",
    dealLimit: null,
    seats: 3,
    features: { liveUnderwriting: true, omReader: true, buyers: true, docs: true, csvExport: true, sourcing: true },
  },
};

/** Stripe statuses that keep paid access. past_due stays Pro through Stripe's retry window. */
const PAID_STATUSES = new Set(["active", "trialing", "past_due"]);

export function effectivePlan(sub: Pick<Subscription, "plan" | "status">): Plan {
  return sub.plan !== "free" && PAID_STATUSES.has(sub.status) ? sub.plan : "free";
}

export const planFor = (sub: Pick<Subscription, "plan" | "status">) => PLANS[effectivePlan(sub)];
