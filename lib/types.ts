import type { UnitMixRow } from "./underwriting";

export const STAGES = [
  "sourced",
  "underwriting",
  "negotiating",
  "under_contract",
  "assigned",
  "closed",
  "dead",
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  sourced: "Sourced",
  underwriting: "Underwriting",
  negotiating: "Negotiating",
  under_contract: "Under contract",
  assigned: "Assigned",
  closed: "Closed",
  dead: "Dead",
};

export const PROPERTY_TYPES = ["drive_up", "climate", "mixed", "rv_boat"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  drive_up: "Drive-up",
  climate: "Climate controlled",
  mixed: "Mixed",
  rv_boat: "RV and boat",
};

export type Period = "actual_year" | "t12" | "year1_proj";
export const PERIOD_LABEL: Record<Period, string> = {
  actual_year: "Actual year",
  t12: "T-12",
  year1_proj: "Year 1",
};

export type Source = "seller" | "broker_om" | "appraisal" | "user" | "calculated";
export const SOURCE_LABEL: Record<Source, string> = {
  seller: "Seller financials",
  broker_om: "Broker OM",
  appraisal: "Appraisal",
  user: "You",
  calculated: "Calculated",
};

export interface Org {
  id: string;
  name: string;
  brand_name: string;
  brand_tagline: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  disclosure_entity: string;
  logo_url: string | null;
  inbound_token: string;
  defaults: UnderwritingDefaults;
}

export interface UnderwritingDefaults {
  down_pct: number;
  rate: number;
  years: number;
  target_dscr: number;
  target_cap: number;
  assignment_fee: number;
}

export const DEFAULT_ASSUMPTIONS: UnderwritingDefaults = {
  down_pct: 0.3,
  rate: 0.075,
  years: 20,
  target_dscr: 1.25,
  target_cap: 0.085,
  assignment_fee: 25_000,
};

export interface Profile {
  user_id: string;
  org_id: string;
  full_name: string;
  email: string;
  role: "owner" | "member";
}

export type Plan = "free" | "pro";
export interface Subscription {
  org_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: Plan;
  status: string; // Stripe status: active, trialing, past_due, canceled...
  current_period_end: string | null;
}

export interface Deal {
  id: string;
  org_id: string;
  name: string;
  market_city: string;
  market_state: string;
  address: string | null;
  property_type: PropertyType;
  units: number | null;
  nrsf: number | null;
  acres: number | null;
  buildings: number | null;
  year_built: number | null;
  physical_occupancy: number | null; // decimal
  list_price: number | null;
  target_price: number | null;
  appraised_value: number | null;
  appraisal_date: string | null;
  stage: Stage;
  contract_signed_at: string | null;
  contract_price: number | null;
  assignable: boolean;
  notes: string;
  is_sample: boolean;
  construction: string | null;
  listing_url: string | null;
  /** Where each fact came from, keyed by deal field name. */
  sources: Partial<Record<string, Source>>;
  created_at: string;
  updated_at: string;
}

export interface ExpenseLine {
  label: string;
  amount: number;
}

export interface DealFinancial {
  id: string;
  deal_id: string;
  period: Period;
  period_label: string;
  potential_rent: number | null;
  vacancy: number | null;
  other_income: number | null;
  egi: number | null;
  expenses: ExpenseLine[];
  total_expenses: number | null;
  noi: number | null;
  source: Source;
}

export interface UnitMix extends UnitMixRow {
  id: string;
  deal_id: string;
}

export interface DealFlag {
  id: string;
  deal_id: string;
  level: "warn" | "info" | "ok";
  code: string;
  message: string;
  source: string;
}

export type DocKind = "broker_om" | "appraisal" | "t12" | "rent_roll" | "generated_om" | "generated_preview";
export const DOC_KIND_LABEL: Record<DocKind, string> = {
  broker_om: "Broker OM",
  appraisal: "Appraisal",
  t12: "T-12",
  rent_roll: "Rent roll",
  generated_om: "Generated OM",
  generated_preview: "Pre-contract preview",
};

export interface DealDocument {
  id: string;
  deal_id: string;
  kind: DocKind;
  name: string;
  storage_path: string;
  parsed: boolean;
  parse_status: "pending" | "parsed" | "needs_review" | "failed" | "n/a";
  parse_error: string | null;
  extraction?: unknown;
  created_at: string;
}

export const BUYER_TYPES = ["private_operator", "fund", "reit", "individual"] as const;
export type BuyerType = (typeof BUYER_TYPES)[number];
export const BUYER_TYPE_LABEL: Record<BuyerType, string> = {
  private_operator: "Private operator",
  fund: "Fund",
  reit: "REIT",
  individual: "Individual",
};

export interface Buyer {
  id: string;
  org_id: string;
  firm_name: string;
  contact_name: string;
  email: string;
  phone: string;
  buyer_type: BuyerType;
  accepts_assignment: boolean;
  states: string[];
  min_price: number | null;
  max_price: number | null;
  min_nrsf: number | null;
  max_nrsf: number | null;
  property_types: PropertyType[];
  strategy: "value_add" | "stabilized" | "any";
  financing: "cash" | "debt" | "either";
  notes: string;
  created_at: string;
}

export type MatchStatus = "suggested" | "contacted" | "interested" | "passed";
export interface DealBuyerMatch {
  deal_id: string;
  buyer_id: string;
  status: MatchStatus;
}

export interface Task {
  id: string;
  deal_id: string;
  title: string;
  due_date: string | null;
  done: boolean;
  assignee: string | null;
  created_at: string;
}

export interface Activity {
  id: string;
  org_id: string;
  deal_id: string | null;
  actor: string;
  action: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface DealBundle {
  deal: Deal;
  financials: DealFinancial[];
  unitMix: UnitMix[];
  flags: DealFlag[];
  documents: DealDocument[];
  tasks: Task[];
  activity: Activity[];
  narrative: string | null;
}

/** Deal row plus the NOI per period, for lists and the kanban. */
export interface DealSummary extends Deal {
  noi: Partial<Record<Period, number>>;
}
