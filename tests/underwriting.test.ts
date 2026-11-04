import { describe, expect, it } from "vitest";
import {
  annualDebtService,
  capRate,
  cashOnCash,
  dscr,
  dscrBand,
  economicOccupancy,
  maxOffer,
  pricePerNrsf,
  pricePerUnit,
  rentGap,
  underwrite,
  type UnitMixRow,
} from "@/lib/underwriting";

// West San Antonio Storage (section 12 of the build spec)
const T12_NOI = 65_113;
const unitMix: UnitMixRow[] = [
  { unit_type: "10x20 NC", width: 10, depth: 20, count: 36, occupied: 34, street_rent: 125, in_place_rent: 116, climate: false },
  { unit_type: "10x25 NC", width: 10, depth: 25, count: 17, occupied: 17, street_rent: 145, in_place_rent: 135, climate: false },
  { unit_type: "10x30 NC", width: 10, depth: 30, count: 34, occupied: 22, street_rent: 145, in_place_rent: 122, climate: false },
];

describe("San Antonio at $715,000, 30% down, 7.5%, 20 years", () => {
  const r = underwrite({ price: 715_000, noi: T12_NOI, downPct: 0.3, rate: 0.075, years: 20, nrsf: 21_650, units: 87, appraisedValue: 725_000 });

  it("loan is $500,500", () => expect(r.loan).toBe(500_500));
  it("annual debt service ≈ $48,384", () => expect(Math.round(r.debtService)).toBeCloseTo(48_384, -1));
  it("T-12 cap is 9.11%", () => expect(Number((r.capRate * 100).toFixed(2))).toBe(9.11));
  it("DSCR is 1.35x", () => expect(Number(r.dscr.toFixed(2))).toBe(1.35));
  it("DSCR band is green", () => expect(r.dscrBand).toBe("go"));
  it("cash flow ≈ $16,729", () => expect(Math.abs(r.cashFlow - 16_729)).toBeLessThan(10));
  it("cash-on-cash is 7.8%", () => expect(Number((r.cashOnCash * 100).toFixed(1))).toBe(7.8));
  it("spread to appraisal is $10,000", () => expect(r.spreadToAppraisal).toBe(10_000));
  it("price per NRSF and unit", () => {
    expect(pricePerNrsf(715_000, 21_650)).toBeCloseTo(33.03, 2);
    expect(pricePerUnit(715_000, 87)).toBeCloseTo(8218.39, 1);
  });
});

describe("primitives", () => {
  it("annualDebtService handles zero rate and zero loan", () => {
    expect(annualDebtService(240_000, 0, 20)).toBe(12_000);
    expect(annualDebtService(0, 0.07, 25)).toBe(0);
  });
  it("cap rate and DSCR guard against zero", () => {
    expect(capRate(100, 0)).toBe(0);
    expect(dscr(100, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(cashOnCash(100, 0)).toBe(0);
  });
  it("DSCR bands", () => {
    expect(dscrBand(1.25)).toBe("go");
    expect(dscrBand(1.249)).toBe("go"); // rounds to 1.25
    expect(dscrBand(1.24)).toBe("amber");
    expect(dscrBand(1.1)).toBe("amber");
    expect(dscrBand(1.09)).toBe("stop");
  });
  it("economic occupancy", () => {
    expect(economicOccupancy(104_620, 142_740)).toBeCloseTo(0.733, 3);
  });
});

describe("rentGap", () => {
  const g = rentGap(unitMix);
  it("per-type gap", () => {
    expect(g.rows.map((r) => r.gap_per_unit)).toEqual([9, 10, 23]);
    expect(g.rows.map((r) => r.monthly_upside)).toEqual([306, 170, 506]);
  });
  it("total upside", () => {
    expect(g.monthly_upside).toBe(982);
    expect(g.annual_upside).toBe(11_784);
  });
  it("potential rent matches $142,740", () => {
    expect(g.potential_rent_annual).toBe(142_740);
  });
});

describe("maxOffer", () => {
  const base = { noi: T12_NOI, rate: 0.075, years: 20, downPct: 0.3 };
  it("DSCR binds when the cap target is loose", () => {
    const r = maxOffer({ ...base, targetDscr: 1.25, targetCap: 0.08, assignmentFee: 0 });
    expect(r.binding).toBe("dscr");
    // At the returned price, DSCR should be exactly the target.
    const u = underwrite({ price: r.buyerPrice, noi: T12_NOI, downPct: 0.3, rate: 0.075, years: 20 });
    expect(u.dscr).toBeCloseTo(1.25, 6);
  });
  it("cap binds when the cap target is tight", () => {
    const r = maxOffer({ ...base, targetDscr: 1.2, targetCap: 0.1, assignmentFee: 0 });
    expect(r.binding).toBe("cap");
    expect(r.buyerPrice).toBeCloseTo(651_130, 0);
  });
  it("assignment fee comes off the seller price", () => {
    const r = maxOffer({ ...base, targetDscr: 1.2, targetCap: 0.1, assignmentFee: 25_000 });
    expect(r.maxOffer).toBeCloseTo(626_130, 0);
    expect(r.feasible).toBe(true);
  });
  it("infeasible when fee exceeds ceiling", () => {
    const r = maxOffer({ ...base, targetDscr: 1.2, targetCap: 0.1, assignmentFee: 10_000_000 });
    expect(r.feasible).toBe(false);
    expect(r.maxOffer).toBe(0);
  });
});
