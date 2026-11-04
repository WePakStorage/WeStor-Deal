import { describe, expect, it } from "vitest";
import { computeFlags } from "@/lib/om/flags";
import { seedFinancials, seedUnitMix, SEED_IDS } from "@/lib/seed";

const fins = seedFinancials().filter((f) => f.deal_id === SEED_IDS.sanAntonio);
const mix = seedUnitMix();

const base = {
  units: 87,
  nrsf: 21_650,
  physicalOccupancy: 73 / 87,
  askingPrice: 760_000,
  appraisedValue: 725_000,
  unitMix: mix,
  periods: fins,
};

describe("San Antonio flags", () => {
  const flags = computeFlags(base);
  const codes = flags.map((f) => f.code);

  it("flags the actual → T-12 NOI swing", () => {
    const swing = flags.find((f) => f.code === "noi_swing");
    expect(swing?.message).toContain("down 35.6%");
  });
  it("does not flag the T-12 → Year 1 change (16%)", () => {
    expect(flags.filter((f) => f.code === "noi_swing")).toHaveLength(2); // actual→t12, actual→year1
  });
  it("flags the 10x30 rent gap only", () => {
    const gaps = flags.filter((f) => f.code === "rent_gap");
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.message).toContain("10x30");
  });
  it("flags physical vs economic occupancy gap", () => expect(codes).toContain("occupancy_gap"));
  it("flags the low 2025 expense ratio", () => expect(codes).toContain("expense_ratio_low"));
  it("flags asking above appraisal", () => expect(codes).toContain("price_above_appraisal"));
  it("unit mix ties", () => {
    expect(codes).toContain("unit_mix_ties");
    expect(codes).not.toContain("unit_count_mismatch");
    expect(codes).not.toContain("nrsf_mismatch");
  });
});

describe("other checks", () => {
  it("catches unit count mismatch", () => {
    expect(computeFlags({ ...base, units: 90 }).map((f) => f.code)).toContain("unit_count_mismatch");
  });
  it("stated cap mismatch", () => {
    expect(computeFlags({ ...base, statedCapRate: 0.105 }).map((f) => f.code)).toContain("stated_cap_mismatch");
    // 101,168 / 760,000 = 13.31%
    expect(computeFlags({ ...base, statedCapRate: 0.1331 }).map((f) => f.code)).not.toContain("stated_cap_mismatch");
  });
});
