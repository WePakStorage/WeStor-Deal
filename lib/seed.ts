import type { Buyer, Deal, DealFinancial, PropertyType, Stage, UnitMix } from "./types";

/** Deterministic IDs so the SQL seed and the demo store agree. */
export const SEED_IDS = {
  sanAntonio: "5a000000-0000-4000-8000-000000000001",
  ocala: "5a000000-0000-4000-8000-000000000002",
  batonRouge: "5a000000-0000-4000-8000-000000000003",
  akron: "5a000000-0000-4000-8000-000000000004",
  lakeland: "5a000000-0000-4000-8000-000000000005",
} as const;

const now = "2026-10-01T15:00:00.000Z";

function deal(orgId: string, d: Partial<Deal> & { id: string; name: string; market_city: string; market_state: string; stage: Stage; property_type: PropertyType }): Deal {
  return {
    org_id: orgId,
    address: null,
    units: null,
    nrsf: null,
    acres: null,
    buildings: null,
    year_built: null,
    physical_occupancy: null,
    list_price: null,
    target_price: null,
    appraised_value: null,
    appraisal_date: null,
    contract_signed_at: null,
    contract_price: null,
    assignable: false,
    notes: "",
    is_sample: true,
    construction: null,
    listing_url: null,
    sources: {},
    created_at: now,
    updated_at: now,
    ...d,
  };
}

export function seedDeals(orgId: string): Deal[] {
  return [
    deal(orgId, {
      id: SEED_IDS.sanAntonio,
      name: "West San Antonio Storage",
      market_city: "San Antonio",
      market_state: "TX",
      address: "4810 Sample Rd, San Antonio, TX 78227",
      property_type: "drive_up",
      units: 87,
      nrsf: 21_650,
      acres: 1.5,
      buildings: 4,
      year_built: 1960,
      physical_occupancy: 73 / 87,
      list_price: 760_000,
      target_price: 715_000,
      appraised_value: 725_000,
      appraisal_date: "2026-08-15",
      stage: "negotiating",
      is_sample: false,
      construction: "Metal over steel and wood frame, gravel floors and drives",
      notes: "Seller open to a 30-day close. 10x30s are under-rented and 12 are vacant.",
      sources: { units: "seller", nrsf: "seller", acres: "appraisal", year_built: "appraisal", physical_occupancy: "seller", list_price: "broker_om", target_price: "user", appraised_value: "appraisal" },
    }),
    deal(orgId, { id: SEED_IDS.ocala, name: "Ocala Drive-Up Storage", market_city: "Ocala", market_state: "FL", property_type: "drive_up", units: 120, nrsf: 14_800, list_price: 1_150_000, target_price: 980_000, stage: "sourced", year_built: 1998, physical_occupancy: 0.88 }),
    deal(orgId, { id: SEED_IDS.batonRouge, name: "Baton Rouge Mini Storage", market_city: "Baton Rouge", market_state: "LA", property_type: "mixed", units: 210, nrsf: 31_500, list_price: 2_400_000, target_price: 2_050_000, stage: "underwriting", year_built: 2004, physical_occupancy: 0.91 }),
    deal(orgId, { id: SEED_IDS.akron, name: "Akron RV & Storage", market_city: "Akron", market_state: "OH", property_type: "rv_boat", units: 95, nrsf: 18_200, list_price: 890_000, target_price: 800_000, stage: "underwriting", year_built: 1987, physical_occupancy: 0.82 }),
    deal(orgId, { id: SEED_IDS.lakeland, name: "Lakeland Self Storage", market_city: "Lakeland", market_state: "FL", property_type: "climate", units: 160, nrsf: 26_000, list_price: 1_950_000, target_price: 1_780_000, stage: "under_contract", year_built: 2008, physical_occupancy: 0.93, contract_signed_at: "2026-09-20", contract_price: 1_760_000, assignable: true }),
  ];
}

let fid = 0;
const finId = () => `f1000000-0000-4000-8000-${String(++fid).padStart(12, "0")}`;

export function seedFinancials(): DealFinancial[] {
  fid = 0;
  const sa = SEED_IDS.sanAntonio;
  const simple = (deal_id: string, noi: number, egi: number): DealFinancial => ({
    id: finId(),
    deal_id,
    period: "t12",
    period_label: "T-12",
    potential_rent: null,
    vacancy: null,
    other_income: null,
    egi,
    expenses: [],
    total_expenses: egi - noi,
    noi,
    source: "broker_om",
  });
  return [
    {
      id: finId(), deal_id: sa, period: "actual_year", period_label: "2025 actual",
      potential_rent: 142_740, vacancy: 10_392, other_income: 0, egi: 132_348,
      expenses: [], total_expenses: 31_180, noi: 101_168, source: "seller",
    },
    {
      id: finId(), deal_id: sa, period: "t12", period_label: "T-12",
      potential_rent: 142_740, vacancy: 38_120, other_income: 0, egi: 104_620,
      expenses: [
        { label: "Taxes", amount: 11_427 },
        { label: "Insurance", amount: 9_151 },
        { label: "Utilities", amount: 1_955 },
        { label: "Repairs", amount: 4_401 },
        { label: "Management software", amount: 7_164 },
        { label: "Bank charges", amount: 3_471 },
        { label: "Dumpster", amount: 1_938 },
        { label: "Marketing", amount: 0 },
      ],
      total_expenses: 39_507, noi: 65_113, source: "seller",
    },
    {
      id: finId(), deal_id: sa, period: "year1_proj", period_label: "Year 1 projected",
      potential_rent: 142_740, vacancy: 21_411, other_income: 1_800, egi: 123_129,
      expenses: [], total_expenses: 47_288, noi: 75_841, source: "broker_om",
    },
    simple(SEED_IDS.ocala, 88_000, 132_000),
    simple(SEED_IDS.batonRouge, 171_000, 262_000),
    simple(SEED_IDS.akron, 70_400, 104_000),
    simple(SEED_IDS.lakeland, 152_000, 228_000),
  ];
}

export function seedUnitMix(): UnitMix[] {
  const sa = SEED_IDS.sanAntonio;
  return [
    { id: "u1000000-0000-4000-8000-000000000001", deal_id: sa, unit_type: "10x20 NC", width: 10, depth: 20, count: 36, occupied: 34, street_rent: 125, in_place_rent: 116, climate: false },
    { id: "u1000000-0000-4000-8000-000000000002", deal_id: sa, unit_type: "10x25 NC", width: 10, depth: 25, count: 17, occupied: 17, street_rent: 145, in_place_rent: 135, climate: false },
    { id: "u1000000-0000-4000-8000-000000000003", deal_id: sa, unit_type: "10x30 NC", width: 10, depth: 30, count: 34, occupied: 22, street_rent: 145, in_place_rent: 122, climate: false },
  ];
}

export function seedBuyers(orgId: string): Buyer[] {
  const b = (x: Partial<Buyer> & { id: string; firm_name: string }): Buyer => ({
    org_id: orgId, contact_name: "", email: "", phone: "", buyer_type: "private_operator",
    accepts_assignment: true, states: [], min_price: null, max_price: null, min_nrsf: null,
    max_nrsf: null, property_types: [], strategy: "any", financing: "either", notes: "",
    created_at: now, ...x,
  });
  return [
    b({ id: "b1000000-0000-4000-8000-000000000001", firm_name: "Lone Star Storage Partners", contact_name: "Dana Ortiz", email: "dana@lonestarsp.example", buyer_type: "private_operator", states: ["TX", "OK"], min_price: 500_000, max_price: 3_000_000, min_nrsf: 15_000, max_nrsf: 80_000, property_types: ["drive_up", "mixed"], strategy: "value_add", financing: "debt" }),
    b({ id: "b1000000-0000-4000-8000-000000000002", firm_name: "Gulf Coast Self Storage Fund II", contact_name: "Marcus Hale", email: "mhale@gcssf.example", buyer_type: "fund", states: ["TX", "LA", "FL"], min_price: 1_500_000, max_price: 8_000_000, min_nrsf: 25_000, max_nrsf: 150_000, property_types: ["climate", "mixed"], strategy: "stabilized", financing: "debt" }),
    b({ id: "b1000000-0000-4000-8000-000000000003", firm_name: "Redline Holdings", contact_name: "Priya Nair", email: "priya@redline.example", buyer_type: "individual", states: ["TX"], min_price: 300_000, max_price: 1_200_000, property_types: ["drive_up"], strategy: "value_add", financing: "cash", accepts_assignment: false }),
    b({ id: "b1000000-0000-4000-8000-000000000004", firm_name: "Sunshine State Storage Co.", contact_name: "Tom Becker", email: "tom@sssc.example", states: ["FL", "GA"], min_price: 750_000, max_price: 2_500_000, min_nrsf: 12_000, max_nrsf: 40_000, property_types: ["drive_up", "climate"], strategy: "any", financing: "either" }),
  ];
}
