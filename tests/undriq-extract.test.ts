import { describe, expect, it } from "vitest";
import { extractedSchema, factsFrom, heuristicExtract, mergeExtracted, toNumber } from "@/lib/undriq/extract";

describe("toNumber", () => {
  it("handles money formats", () => {
    expect(toNumber("$1,250,000")).toBe(1_250_000);
    expect(toNumber("850k")).toBe(850_000);
    expect(toNumber("1.2M")).toBe(1_200_000);
    expect(toNumber("n/a")).toBeNull();
  });
});

describe("extraction", () => {
  const text = `3 bed 2 bath ranch\nPrice: $185,000\nMonthly rent $1,650\nARV 245,000 per comps. Needs about $35,000 in repairs.\nBuilt in 1972. 120 days on market. Sold as-is, price reduced.`;
  it("reads obvious numbers and motivation without guessing", () => {
    const h = heuristicExtract(text);
    expect(h.list).toBe(185_000);
    expect(h.rentMonthly).toBe(1_650);
    expect(h.arv).toBe(245_000);
    expect(h.rehab).toBe(35_000);
    expect(h.yearBuilt).toBe(1972);
    expect(h.daysOnMarket).toBe(120);
    expect(h.noi).toBeNull();
    expect(h.motivation?.signals).toContain("Sold as-is");
  });
  it("AI values win; deterministic read fills gaps; bad AI fields are coerced, not fatal", () => {
    const ai = extractedSchema.parse({ name: "Ranch", list: "190,000", rentMonthly: null, occupancyPct: "95", state: "tennessee", motivation: "garbage" });
    expect(ai.list).toBe(190_000);
    expect(ai.state).toBeNull();
    expect(ai.motivation).toBeNull();
    const m = mergeExtracted(ai, heuristicExtract(text));
    expect(m.list).toBe(190_000);
    expect(m.rentMonthly).toBe(1_650);
    const f = factsFrom(m, "residential", "sfr", "fallback");
    expect(f.occupancy).toBeCloseTo(0.95);
    expect(f.name).toBe("Ranch");
  });
});
