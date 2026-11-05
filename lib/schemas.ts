import { z } from "zod";
import { BUYER_TYPES, PROPERTY_TYPES } from "./types";

const optNum = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : typeof v === "string" ? Number(v.replace(/[$,\s]/g, "")) : v), z.number().finite().nullable());
const optInt = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : typeof v === "string" ? Number(v.replace(/[,\s]/g, "")) : v), z.number().int().nullable());

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
