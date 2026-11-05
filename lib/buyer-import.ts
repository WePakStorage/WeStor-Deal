import type { BuyerInput } from "./schemas";
import { BUYER_TYPES, PROPERTY_TYPES } from "./types";

export const BUYER_FIELDS = [
  { key: "firm_name", label: "Firm name", required: true },
  { key: "contact_name", label: "Contact name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "buyer_type", label: "Buyer type" },
  { key: "accepts_assignment", label: "Accepts assignment" },
  { key: "states", label: "States" },
  { key: "min_price", label: "Min price" },
  { key: "max_price", label: "Max price" },
  { key: "min_nrsf", label: "Min size (sq ft)" },
  { key: "max_nrsf", label: "Max size (sq ft)" },
  { key: "property_types", label: "Property types" },
  { key: "strategy", label: "Strategy" },
  { key: "financing", label: "Financing" },
  { key: "notes", label: "Notes" },
] as const;

export type BuyerFieldKey = (typeof BUYER_FIELDS)[number]["key"];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const ALIASES: Record<BuyerFieldKey, string[]> = {
  firm_name: ["firm", "firmname", "company", "companyname", "buyer", "organization", "name"],
  contact_name: ["contact", "contactname", "fullname", "person"],
  email: ["email", "emailaddress", "mail"],
  phone: ["phone", "phonenumber", "mobile", "cell", "tel"],
  buyer_type: ["buyertype", "type", "investortype"],
  accepts_assignment: ["acceptsassignment", "assignment", "assignments", "takesassignments"],
  states: ["states", "state", "markets", "geography"],
  min_price: ["minprice", "pricemin", "minimumprice", "min"],
  max_price: ["maxprice", "pricemax", "maximumprice", "max"],
  min_nrsf: ["minnrsf", "minsf", "minsize"],
  max_nrsf: ["maxnrsf", "maxsf", "maxsize"],
  property_types: ["propertytypes", "propertytype", "producttype", "assettypes"],
  strategy: ["strategy", "investmentstrategy"],
  financing: ["financing", "funding", "capital"],
  notes: ["notes", "comments", "note"],
};

/** Guess a column → field mapping from CSV headers. */
export function guessMapping(headers: string[]): Partial<Record<BuyerFieldKey, string>> {
  const out: Partial<Record<BuyerFieldKey, string>> = {};
  const used = new Set<string>();
  for (const f of BUYER_FIELDS) {
    const hit = headers.find((h) => !used.has(h) && (norm(h) === norm(f.key) || ALIASES[f.key].includes(norm(h))));
    if (hit) {
      out[f.key] = hit;
      used.add(hit);
    }
  }
  return out;
}

const list = (v: string) => v.split(/[;,|/]/).map((s) => s.trim()).filter(Boolean);
const bool = (v: string) => /^(y|yes|true|1|x)$/i.test(v.trim());

function propertyTypes(v: string) {
  return list(v)
    .map((t) => {
      const n = norm(t);
      if (n.includes("climate")) return "climate";
      if (n.includes("rv") || n.includes("boat")) return "rv_boat";
      if (n.includes("mixed")) return "mixed";
      if (n.includes("drive") || n.includes("noncli") || n === "nc") return "drive_up";
      return (PROPERTY_TYPES as readonly string[]).includes(t) ? t : null;
    })
    .filter((t): t is (typeof PROPERTY_TYPES)[number] => t !== null);
}

function buyerType(v: string): BuyerInput["buyer_type"] {
  const n = norm(v);
  if (n.includes("reit")) return "reit";
  if (n.includes("fund")) return "fund";
  if (n.includes("individual") || n.includes("private investor")) return "individual";
  return (BUYER_TYPES as readonly string[]).includes(v) ? (v as BuyerInput["buyer_type"]) : "private_operator";
}

/** Map one CSV row to buyer input. Validation happens server-side. */
export function mapRow(row: Record<string, string>, mapping: Partial<Record<BuyerFieldKey, string>>): BuyerInput {
  const get = (k: BuyerFieldKey) => (mapping[k] ? (row[mapping[k]!] ?? "").trim() : "");
  const strat = norm(get("strategy"));
  const fin = norm(get("financing"));
  return {
    firm_name: get("firm_name"),
    contact_name: get("contact_name"),
    email: get("email"),
    phone: get("phone"),
    buyer_type: buyerType(get("buyer_type")),
    accepts_assignment: mapping.accepts_assignment ? bool(get("accepts_assignment")) : true,
    states: list(get("states")).map((s) => s.toUpperCase()).filter((s) => s.length === 2),
    min_price: get("min_price") || null,
    max_price: get("max_price") || null,
    min_nrsf: get("min_nrsf") || null,
    max_nrsf: get("max_nrsf") || null,
    property_types: propertyTypes(get("property_types")),
    strategy: strat.includes("value") ? "value_add" : strat.includes("stab") ? "stabilized" : "any",
    financing: fin.includes("cash") ? "cash" : fin.includes("debt") || fin.includes("loan") ? "debt" : "either",
    notes: get("notes"),
  } as BuyerInput;
}
