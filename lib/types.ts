import { PROPERTY_TYPE_LABELS } from "./undriq/assets";

/** A space (personal or team). Branding columns stay in the database but aren't used by UndrIq. */
export interface Org {
  id: string;
  name: string;
}

export interface Profile {
  user_id: string;
  org_id: string;
  full_name: string;
  email: string;
  role: "owner" | "member";
}

export type Plan = "free" | "investor" | "firm" | "fund";
export interface Subscription {
  org_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: Plan;
  status: string; // Stripe status: active, trialing, past_due, canceled...
  current_period_end: string | null;
}

/** Property types a buyer can target: every UndrIq type (houses, multifamily, storage, industrial, retail/office). */
export const PROPERTY_TYPES = Object.keys(PROPERTY_TYPE_LABELS) as [string, ...string[]];
export type PropertyType = string;
export const PROPERTY_TYPE_LABEL: Record<string, string> = PROPERTY_TYPE_LABELS;

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
  /** Building size range in square feet (any asset class). Column names are historical. */
  min_nrsf: number | null;
  max_nrsf: number | null;
  property_types: PropertyType[];
  strategy: "value_add" | "stabilized" | "any";
  financing: "cash" | "debt" | "either";
  notes: string;
  created_at: string;
}
