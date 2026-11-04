import { z } from "zod";
import { BUYER_TYPES, PROPERTY_TYPES, STAGES } from "./types";

const optNum = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : typeof v === "string" ? Number(v.replace(/[$,\s]/g, "")) : v), z.number().finite().nullable());
const optInt = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : typeof v === "string" ? Number(v.replace(/[,\s]/g, "")) : v), z.number().int().nullable());

export const dealInputSchema = z.object({
  name: z.string().trim().min(2, "Give the deal a name"),
  market_city: z.string().trim().min(1, "Enter the city"),
  market_state: z.string().trim().length(2, "Use the 2-letter state code").transform((s) => s.toUpperCase()),
  address: z.string().trim().nullable().optional().transform((v) => v || null),
  property_type: z.enum(PROPERTY_TYPES),
  units: optInt,
  nrsf: optInt,
  acres: optNum,
  buildings: optInt,
  year_built: optInt,
  physical_occupancy: optNum.transform((v) => (v !== null && v > 1 ? v / 100 : v)),
  list_price: optNum,
  target_price: optNum,
  appraised_value: optNum,
  appraisal_date: z.string().nullable().optional().transform((v) => v || null),
  stage: z.enum(STAGES).default("sourced"),
  notes: z.string().default(""),
  construction: z.string().nullable().optional().transform((v) => v || null),
  listing_url: z.string().nullable().optional().transform((v) => v || null),
  // Simple financials captured on manual entry
  t12_egi: optNum.optional(),
  t12_expenses: optNum.optional(),
  t12_noi: optNum.optional(),
});
export type DealInput = z.input<typeof dealInputSchema>;

export const dealPatchSchema = dealInputSchema
  .omit({ t12_egi: true, t12_expenses: true, t12_noi: true, stage: true })
  .partial();

export const expenseLineSchema = z.object({ label: z.string().min(1), amount: z.number().finite() });
export const financialSchema = z.object({
  period: z.enum(["actual_year", "t12", "year1_proj"]),
  period_label: z.string(),
  potential_rent: z.number().nullable(),
  vacancy: z.number().nullable(),
  other_income: z.number().nullable(),
  egi: z.number().nullable(),
  expenses: z.array(expenseLineSchema),
  total_expenses: z.number().nullable(),
  noi: z.number().nullable(),
  source: z.enum(["seller", "broker_om", "appraisal", "user", "calculated"]),
});

export const unitMixSchema = z.object({
  unit_type: z.string().min(1),
  width: z.number().nonnegative(),
  depth: z.number().nonnegative(),
  count: z.number().int().nonnegative(),
  occupied: z.number().int().nonnegative(),
  street_rent: z.number().nonnegative(),
  in_place_rent: z.number().nonnegative(),
  climate: z.boolean(),
});

export const buyerSchema = z.object({
  id: z.string().uuid().optional(),
  firm_name: z.string().trim().min(1, "Enter the firm name"),
  contact_name: z.string().default(""),
  email: z.string().trim().email("Enter a valid email").or(z.literal("")).default(""),
  phone: z.string().default(""),
  buyer_type: z.enum(BUYER_TYPES).default("private_operator"),
  accepts_assignment: z.boolean().default(true),
  states: z.array(z.string().length(2).transform((s) => s.toUpperCase())).default([]),
  min_price: optNum.default(null),
  max_price: optNum.default(null),
  min_nrsf: optInt.default(null),
  max_nrsf: optInt.default(null),
  property_types: z.array(z.enum(PROPERTY_TYPES)).default([]),
  strategy: z.enum(["value_add", "stabilized", "any"]).default("any"),
  financing: z.enum(["cash", "debt", "either"]).default("either"),
  notes: z.string().default(""),
});
export type BuyerInput = z.input<typeof buyerSchema>;
