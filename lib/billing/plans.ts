import type { Plan, Subscription } from "../types";

/**
 * Plan config. Feature checks read `features`, never the plan name.
 * To add a tier: create the Stripe price, add a row here, widen Plan, and widen the
 * subscriptions.plan check constraint in a migration.
 */
export interface PlanConfig {
  id: Plan;
  name: string;
  priceMonthly: number;
  stripePriceEnv: string | null;
  /** AI analyses per period. Scout's are lifetime; paid plans reset each calendar month (UTC). */
  analyses: number;
  analysesPeriod: "lifetime" | "month";
  /** People in a team space owned by this plan (owner included). 1 means no team space. */
  seats: number;
  /** Team spaces the owner can create. */
  teams: number;
  /** One-line reason to pick this plan (shown as a badge). */
  hook: string;
  /** Stripe free-trial days for a first subscription (0 = none). */
  trialDays: number;
  /** Legacy self-storage deal limit (null = unlimited). */
  dealLimit: number | null;
  rank: number;
  blurb: string;
  bullets: string[];
  features: {
    /** Full exit matrix, offer ladder, stress test, memo (Scout gets the score and best exit only). */
    fullAnalysis: boolean;
    pipeline: boolean;
    offers: boolean;
    buyers: boolean;
    csvExport: boolean;
    teamSpace: boolean;
    bulk: boolean;
    buyBoxRules: boolean;
    /** Legacy self-storage tools (OM reader, live underwriting, sourcing). */
    liveUnderwriting: boolean;
    omReader: boolean;
    docs: boolean;
    sourcing: boolean;
  };
}

const none = { fullAnalysis: false, pipeline: false, offers: false, buyers: false, csvExport: false, teamSpace: false, bulk: false, buyBoxRules: false, liveUnderwriting: false, omReader: false, docs: false, sourcing: false };
const investor = { ...none, fullAnalysis: true, pipeline: true, offers: true, buyers: true, liveUnderwriting: true, omReader: true, docs: true, sourcing: true };

export const PLANS: Record<Plan, PlanConfig> = {
  free: {
    id: "free", name: "Scout", priceMonthly: 0, stripePriceEnv: null, analyses: 3, analysesPeriod: "lifetime", seats: 1, teams: 0, dealLimit: 3, rank: 0,
    hook: "First analysis fully unlocked", trialDays: 0,
    blurb: "See exactly what UndrIq does on a deal you're looking at.",
    bullets: ["Your first analysis fully unlocked", "3 AI deal analyses", "Score, verdict and best exit on every deal", "Property data lookups"],
    features: none,
  },
  investor: {
    id: "investor", name: "Investor", priceMonthly: 49, stripePriceEnv: "STRIPE_PRICE_INVESTOR", analyses: 50, analysesPeriod: "month", seats: 1, teams: 0, dealLimit: null, rank: 1,
    hook: "Most popular", trialDays: 7,
    blurb: "For investors and wholesalers making offers every week.",
    bullets: ["50 AI analyses a month", "Full analysis on every deal: 5 exits, offer ladder, stress test, memo", "Offer generator: LOI, email, text and call script", "Private pipeline and buyer list with matching", "Property data lookups"],
    features: investor,
  },
  firm: {
    id: "firm", name: "Firm", priceMonthly: 149, stripePriceEnv: "STRIPE_PRICE_FIRM", analyses: 250, analysesPeriod: "month", seats: 5, teams: 1, dealLimit: null, rank: 2,
    hook: "About $30 per person", trialDays: 7,
    blurb: "For acquisition teams working one shared pipeline.",
    bullets: ["250 AI analyses a month", "Everything in Investor", "Shared team space for 5 people", "Your own buy box rules on every score", "CSV export of deals and buyers"],
    features: { ...investor, csvExport: true, teamSpace: true, buyBoxRules: true },
  },
  fund: {
    id: "fund", name: "Fund", priceMonthly: 399, stripePriceEnv: "STRIPE_PRICE_FUND", analyses: 1000, analysesPeriod: "month", seats: 15, teams: 3, dealLimit: null, rank: 3,
    hook: "Unlimited, fair use", trialDays: 0,
    blurb: "For operators who screen volume and sell deals to buyers.",
    bullets: ["Unlimited analyses (fair use, 1,000 a month)", "Everything in Firm", "3 team spaces, up to 15 people each", "Bulk analyzer: score 500 deals at once", "Priority support and an onboarding call"],
    features: { ...investor, csvExport: true, teamSpace: true, bulk: true, buyBoxRules: true },
  },
};

export const PAID_PLANS = ["investor", "firm", "fund"] as const satisfies readonly Plan[];
export type PaidPlan = (typeof PAID_PLANS)[number];
export const isPaidPlan = (p: unknown): p is PaidPlan => typeof p === "string" && (PAID_PLANS as readonly string[]).includes(p);

/** Stripe statuses that keep paid access. past_due stays on through Stripe's retry window. */
const PAID_STATUSES = new Set(["active", "trialing", "past_due"]);

export function effectivePlan(sub: Pick<Subscription, "plan" | "status">): Plan {
  return sub.plan !== "free" && PAID_STATUSES.has(sub.status) && sub.plan in PLANS ? sub.plan : "free";
}

export const planFor = (sub: Pick<Subscription, "plan" | "status">) => PLANS[effectivePlan(sub)];

/** Higher of two plans. A team space runs on the better of its own subscription and its owner's. */
export const maxPlan = (a: Plan, b: Plan): Plan => (PLANS[a].rank >= PLANS[b].rank ? a : b);

/** Start of the current quota window, as an ISO string. */
export function quotaWindowStart(plan: PlanConfig, now = new Date()): string {
  if (plan.analysesPeriod === "lifetime") return new Date(0).toISOString();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Map a Stripe price ID to a plan using the env vars. Unknown prices are null (never guess a tier). */
export function planForPriceId(priceId: string, envs: Record<string, string | undefined> = process.env): PaidPlan | null {
  for (const p of PAID_PLANS) {
    const key = PLANS[p].stripePriceEnv;
    if (key && envs[key] && envs[key] === priceId) return p;
  }
  // Legacy single-tier price from the WeStor build maps to Investor.
  if (envs.STRIPE_PRICE_PRO_MONTHLY && envs.STRIPE_PRICE_PRO_MONTHLY === priceId) return "investor";
  return null;
}
