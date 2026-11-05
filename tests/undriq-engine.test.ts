import { describe, expect, it } from "vitest";
import { analyze, buyerMax, DEFAULT_RULES, emptyFacts, exitMatrix, income, normalizeRules, offerLadder, redFlags, stressTest, teaser, type DealFacts } from "@/lib/undriq/engine";
import { annualDebtService } from "@/lib/underwriting";

const house = (p: Partial<DealFacts> = {}): DealFacts => ({ ...emptyFacts("residential", "sfr", "12 Oak St, Memphis"), list: 120_000, arv: 210_000, rehab: 35_000, rentMonthly: 1_650, ...p });
const storage = (p: Partial<DealFacts> = {}): DealFacts => ({ ...emptyFacts("storage", "climate", "Lakeland Self Storage"), list: 1_950_000, noi: 152_000, gross: 228_000, expenses: 76_000, ...p });

describe("income", () => {
  it("uses stated NOI and backs out gross", () => {
    const i = income(storage({ gross: null, expenses: null }));
    expect(i.noi).toBe(152_000);
    expect(i.gross).toBeCloseTo(152_000 / 0.65, 0);
    expect(i.estimated).toBe(false);
  });
  it("estimates NOI from rent with the asset's expense ratio and flags it", () => {
    const i = income(house());
    expect(i.gross).toBe(19_800);
    expect(i.noi).toBeCloseTo(19_800 * 0.6, 6);
    expect(i.estimated).toBe(true);
  });
  it("uses gross minus expenses when both are given", () => {
    const i = income({ ...emptyFacts("industrial", "warehouse"), gross: 300_000, expenses: 60_000 });
    expect(i.noi).toBe(240_000);
    expect(i.estimated).toBe(false);
  });
});

describe("exit matrix", () => {
  it("residential wholesale MAO is ARV × 70% − repairs − fee", () => {
    const w = exitMatrix(house(), DEFAULT_RULES).find((e) => e.key === "wholesale")!;
    expect(w.maxPrice).toBe(210_000 * 0.7 - 35_000 - 10_000);
    // asking 120K vs MAO 102K: 15% gap → 52
    expect(w.score).toBe(52);
  });
  it("commercial wholesale uses the buyer's max at cap and DSCR minus the fee", () => {
    const f = storage();
    const w = exitMatrix(f, DEFAULT_RULES).find((e) => e.key === "wholesale")!;
    const m = buyerMax(152_000, 0.085, DEFAULT_RULES);
    expect(w.maxPrice).toBeCloseTo(m.buyer - 25_000, 2);
  });
  it("buyer max at DSCR matches the amortization formula", () => {
    const m = buyerMax(100_000, 0.01, DEFAULT_RULES);
    const perDollar = annualDebtService(1, 0.075, 25);
    expect(m.atDscr).toBeCloseTo(100_000 / (1.25 * perDollar) / 0.7, 4);
    expect(m.binding).toBe("dscr");
  });
  it("BRRRR only for residential and multifamily", () => {
    expect(exitMatrix(house(), DEFAULT_RULES).some((e) => e.key === "brrrr")).toBe(true);
    expect(exitMatrix(storage({ arv: 2_400_000 }), DEFAULT_RULES).some((e) => e.key === "brrrr")).toBe(false);
  });
  it("sorts by score, best first", () => {
    const ex = exitMatrix(house(), DEFAULT_RULES);
    for (let i = 1; i < ex.length; i++) expect(ex[i - 1]!.score).toBeGreaterThanOrEqual(ex[i]!.score);
  });
  it("custom rules change the answer", () => {
    const tight = normalizeRules({ ...DEFAULT_RULES, arvPct: 0.65 });
    const w = exitMatrix(house(), tight).find((e) => e.key === "wholesale")!;
    expect(w.maxPrice).toBe(210_000 * 0.65 - 35_000 - 10_000);
  });
});

describe("ladder and stress", () => {
  it("anchor < target < walk-away and walk-away never exceeds asking", () => {
    const f = storage();
    const a = analyze(f);
    const l = a.ladder!;
    expect(l[0]!.price).toBeLessThan(l[1]!.price);
    expect(l[1]!.price).toBeLessThan(l[2]!.price);
    expect(l[2]!.price).toBeLessThanOrEqual(f.list!);
  });
  it("no ladder without a price or an exit", () => {
    expect(offerLadder(emptyFacts("storage", "climate"), null)).toBeNull();
  });
  it("stress rows get worse in the combined shock", () => {
    const s = stressTest(storage(), 1_700_000, DEFAULT_RULES)!;
    expect(s.rows).toHaveLength(5);
    expect(s.rows[4]!.dscr).toBeLessThan(s.rows[0]!.dscr);
    expect(s.breakEven).toBeGreaterThan(0);
    expect(s.breakEven).toBeLessThan(1);
  });
});

describe("flags and score", () => {
  it("flags a stated cap that doesn't match NOI ÷ price", () => {
    const flags = redFlags(storage({ statedCap: 0.09 }));
    expect(flags.some(([lvl, m]) => lvl === "warn" && m.includes("cap"))).toBe(true);
  });
  it("score stays in 4..97 and verdict follows the score", () => {
    const a = analyze(house());
    expect(a.score).toBeGreaterThanOrEqual(4);
    expect(a.score).toBeLessThanOrEqual(97);
    expect(["go", "amber", "stop"]).toContain(a.verdict.band);
  });
  it("teaser strips the exit matrix, ladder and stress test", () => {
    const t = teaser(analyze(storage())) as Record<string, unknown>;
    expect(t.exits).toBeUndefined();
    expect(t.ladder).toBeUndefined();
    expect(t.stress).toBeUndefined();
    expect(t.score).toBeTypeOf("number");
  });
});

describe("normalizeRules", () => {
  it("clamps nonsense and fills defaults", () => {
    const r = normalizeRules({ arvPct: 5, rate: "x", caps: { storage: -1 } });
    expect(r.arvPct).toBe(1);
    expect(r.rate).toBe(DEFAULT_RULES.rate);
    expect(r.caps.storage).toBe(0.01);
    expect(r.caps.residential).toBe(DEFAULT_RULES.caps.residential);
  });
});
