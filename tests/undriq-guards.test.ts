import { describe, expect, it } from "vitest";
import { analyze, emptyFacts } from "@/lib/undriq/engine";
import { dollarsIn, groundMemo, isGrounded, sanityCheck } from "@/lib/undriq/guards";

const base = { ...emptyFacts("residential", "sfr", "12 Oak St"), list: 120_000 };

describe("sanityCheck", () => {
  it("turns an annual rent read as monthly into monthly, and says so", () => {
    const { facts, checks } = sanityCheck({ ...base, rentMonthly: 19_800 });
    expect(facts.rentMonthly).toBe(1_650);
    expect(checks[0]).toMatch(/looked annual/);
  });
  it("drops an impossible NOI and a far-off ARV", () => {
    const { facts, checks } = sanityCheck({ ...base, noi: 90_000, arv: 2_000_000 });
    expect(facts.noi).toBeNull();
    expect(facts.arv).toBeNull();
    expect(checks).toHaveLength(2);
  });
  it("never changes numbers the user typed", () => {
    const { facts, checks } = sanityCheck({ ...base, rentMonthly: 19_800, arv: 2_000_000 }, new Set(["rentMonthly", "arv"] as const));
    expect(facts.rentMonthly).toBe(19_800);
    expect(facts.arv).toBe(2_000_000);
    expect(checks).toHaveLength(0);
  });
  it("leaves sensible numbers alone and surfaces checks as red-flag info lines", () => {
    expect(sanityCheck({ ...base, rentMonthly: 1_650, arv: 210_000, rehab: 35_000 }).checks).toEqual([]);
    const a = analyze(sanityCheck({ ...base, noi: 90_000 }).facts);
    expect(a.flags.some(([, m]) => m.includes("Ignored an NOI"))).toBe(true);
  });
});

describe("groundMemo", () => {
  const data = { asking: 120_000, ladder: [{ price: 98_000 }, { price: 113_000 }, { price: 118_000 }], exits: [{ keyNumber: "$28,900 profit" }] };
  const fallback = { headline: "Computed headline.", thesis: [], risks: [], nextSteps: [], killers: [], mustBeTrue: [], offerScript: "" };
  it("parses dollar formats", () => {
    expect(dollarsIn("Offer $98K, ARV $1.2M, fee $10,000")).toEqual([98_000, 1_200_000, 10_000]);
  });
  it("keeps lines with computed figures (rounded) and drops invented ones", () => {
    expect(isGrounded("Target about $113K and profit near $29K.", [113_000, 28_900])).toBe(true);
    const g = groundMemo({ ...fallback, headline: "Buy at $150K for a $60K profit.", thesis: ["Anchor at $98K.", "Rents will hit $2,400."], offerScript: "Would you take $98,000?" }, data, fallback);
    expect(g.memo.headline).toBe("Computed headline.");
    expect(g.memo.thesis).toEqual(["Anchor at $98K."]);
    expect(g.memo.offerScript).toBe("Would you take $98,000?");
    expect(g.dropped).toBe(2);
  });
});
