import { describe, expect, it } from "vitest";
import { effectivePlan, maxPlan, PLANS, planForPriceId, quotaWindowStart } from "@/lib/billing/plans";
import { scoreBuyerFit } from "@/lib/undriq/match";
import { emptyFacts } from "@/lib/undriq/engine";
import type { Buyer } from "@/lib/types";

describe("plans", () => {
  it("maps Stripe prices to tiers from env, never guessing", () => {
    const env = { STRIPE_PRICE_INVESTOR: "price_i", STRIPE_PRICE_FIRM: "price_f", STRIPE_PRICE_FUND: "price_x", STRIPE_PRICE_PRO_MONTHLY: "price_old" };
    expect(planForPriceId("price_i", env)).toBe("investor");
    expect(planForPriceId("price_f", env)).toBe("firm");
    expect(planForPriceId("price_x", env)).toBe("fund");
    expect(planForPriceId("price_old", env)).toBe("investor");
    expect(planForPriceId("price_unknown", env)).toBeNull();
  });
  it("only paid statuses keep a paid plan", () => {
    expect(effectivePlan({ plan: "firm", status: "past_due" })).toBe("firm");
    expect(effectivePlan({ plan: "firm", status: "canceled" })).toBe("free");
    expect(effectivePlan({ plan: "fund", status: "incomplete" })).toBe("free");
  });
  it("seats and team features follow the tier", () => {
    expect(PLANS.firm.seats).toBe(5);
    expect(PLANS.fund.seats).toBe(15);
    expect(PLANS.investor.features.teamSpace).toBe(false);
    expect(PLANS.fund.features.bulk && PLANS.fund.features.buyBoxRules).toBe(true);
    expect(PLANS.free.features.fullAnalysis).toBe(false);
    expect(maxPlan("investor", "fund")).toBe("fund");
  });
  it("Scout quota is lifetime, paid quota resets on the 1st (UTC)", () => {
    expect(quotaWindowStart(PLANS.free)).toBe(new Date(0).toISOString());
    expect(quotaWindowStart(PLANS.firm, new Date("2026-11-19T10:00:00Z"))).toBe("2026-11-01T00:00:00.000Z");
  });
});

describe("buyer fit", () => {
  const b: Buyer = { id: "b1", org_id: "o", firm_name: "Acme", contact_name: "", email: "a@x.com", phone: "", buyer_type: "fund", accepts_assignment: true, states: ["TN"], min_price: 50_000, max_price: 300_000, min_nrsf: null, max_nrsf: null, property_types: [], strategy: "any", financing: "either", notes: "", created_at: "" };
  it("rewards state, price and assignment fit", () => {
    const f = { ...emptyFacts("residential", "sfr"), state: "TN" };
    const fit = scoreBuyerFit(f, 120_000, b);
    expect(fit.score).toBeGreaterThanOrEqual(80);
    expect(fit.yes).toContain("Buys in TN");
  });
  it("penalises out-of-state and out-of-range", () => {
    const f = { ...emptyFacts("residential", "sfr"), state: "TX" };
    const fit = scoreBuyerFit(f, 900_000, b);
    expect(fit.score).toBeLessThan(50);
    expect(fit.no.length).toBeGreaterThanOrEqual(2);
  });
});
