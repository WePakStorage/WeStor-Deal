import { describe, expect, it } from "vitest";
import { rankBuyers, scoreBuyer } from "@/lib/matching";
import { seedBuyers, seedDeals, seedUnitMix, SEED_IDS } from "@/lib/seed";

const org = "org";
const sa = seedDeals(org).find((d) => d.id === SEED_IDS.sanAntonio)!;
const buyers = seedBuyers(org);
const mix = seedUnitMix();

describe("buyer matching", () => {
  it("Lone Star scores 100 on San Antonio", () => {
    const m = scoreBuyer(sa, mix, buyers[0]!);
    expect(m.score).toBe(100);
    expect(m.reasons).toContain("Buys in TX");
    expect(m.directOnly).toBe(false);
  });

  it("buyers who don't accept assignments are listed separately", () => {
    const r = rankBuyers(sa, mix, buyers);
    expect(r.directOnly.map((m) => m.buyer.firm_name)).toEqual(["Redline Holdings"]);
    expect(r.matches.some((m) => m.buyer.firm_name === "Redline Holdings")).toBe(false);
  });

  it("ranks by score and explains misses", () => {
    const r = rankBuyers(sa, mix, buyers);
    expect(r.matches[0]?.buyer.firm_name).toBe("Lone Star Storage Partners");
    const fl = r.matches.find((m) => m.buyer.firm_name === "Sunshine State Storage Co.")!;
    expect(fl.misses).toContain("Doesn't buy in TX");
    expect(fl.score).toBeLessThan(80);
  });

  it("direct deals don't exclude non-assignment buyers", () => {
    const direct = { ...sa, contract_signed_at: "2026-11-01", assignable: false };
    expect(rankBuyers(direct, mix, buyers).directOnly).toHaveLength(0);
  });
});
