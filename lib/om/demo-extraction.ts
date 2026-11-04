import type { OmExtraction } from "./schema";

/**
 * Used only when ANTHROPIC_API_KEY is not set, so the review flow can be
 * explored end to end. Mirrors a typical small drive-up OM.
 */
export const DEMO_EXTRACTION: OmExtraction = {
  property: {
    name: "Secure Spaces Storage",
    city: "San Antonio",
    state: "TX",
    address: "Confidential",
    property_type: "drive_up",
    units: 87,
    nrsf: 21_650,
    acres: 1.5,
    buildings: 4,
    year_built: 1960,
    construction: "Metal over steel and wood frame, gravel drives",
    confidence: "high",
  },
  occupancy: { physical_pct: 84, economic_pct: null, confidence: "high" },
  pricing: { asking_price: 760_000, stated_cap_rate_pct: 10.5, appraised_value: 725_000, confidence: "high" },
  broker: { name: "Demo Broker", firm: "Demo Commercial Realty" },
  unit_mix: {
    rows: [
      { unit_type: "10x20 NC", width: 10, depth: 20, count: 36, occupied: 34, street_rent: 125, in_place_rent: 116, climate: false },
      { unit_type: "10x25 NC", width: 10, depth: 25, count: 17, occupied: 17, street_rent: 145, in_place_rent: 135, climate: false },
      { unit_type: "10x30 NC", width: 10, depth: 30, count: 34, occupied: 22, street_rent: 145, in_place_rent: 122, climate: false },
    ],
    stated_total_units: 87,
    stated_total_nrsf: 21_650,
    confidence: "high",
  },
  financials: {
    periods: [
      { period: "actual_year", period_label: "2025 actual", potential_rent: 142_740, vacancy: 10_392, other_income: 0, egi: 132_348, expenses: [], total_expenses: 31_180, noi: 101_168 },
      {
        period: "t12", period_label: "T-12", potential_rent: 142_740, vacancy: 38_120, other_income: 0, egi: 104_620,
        expenses: [
          { label: "Taxes", amount: 11_427 }, { label: "Insurance", amount: 9_151 }, { label: "Utilities", amount: 1_955 },
          { label: "Repairs", amount: 4_401 }, { label: "Management software", amount: 7_164 }, { label: "Bank charges", amount: 3_471 },
          { label: "Dumpster", amount: 1_938 }, { label: "Marketing", amount: 0 },
        ],
        total_expenses: 39_507, noi: 65_113,
      },
      { period: "year1_proj", period_label: "Year 1 projected", potential_rent: 142_740, vacancy: 21_411, other_income: 1_800, egi: 123_129, expenses: [], total_expenses: 47_288, noi: 75_841 },
    ],
    confidence: "high",
  },
};
