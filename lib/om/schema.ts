import { z } from "zod";

/** Numbers from documents often arrive as "$1,234" strings; accept both. */
const money = z.preprocess((v) => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "string") {
    const n = Number(v.replace(/[$,%\s]/g, ""));
    return Number.isFinite(n) ? n : v;
  }
  return v;
}, z.number().finite().nullable());

const confidence = z.enum(["high", "medium", "low"]);

export const omExtractionSchema = z.object({
  property: z.object({
    name: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    address: z.string().nullable(),
    property_type: z.enum(["drive_up", "climate", "mixed", "rv_boat"]).nullable(),
    units: money,
    nrsf: money,
    acres: money,
    buildings: money,
    year_built: money,
    construction: z.string().nullable(),
    confidence,
  }),
  occupancy: z.object({
    physical_pct: money.describe("0-100"),
    economic_pct: money.describe("0-100"),
    confidence,
  }),
  pricing: z.object({
    asking_price: money,
    stated_cap_rate_pct: money,
    appraised_value: money,
    confidence,
  }),
  broker: z.object({ name: z.string().nullable(), firm: z.string().nullable() }),
  unit_mix: z.object({
    rows: z.array(
      z.object({
        unit_type: z.string(),
        width: money,
        depth: money,
        count: money,
        occupied: money,
        street_rent: money,
        in_place_rent: money,
        climate: z.boolean().nullable(),
      }),
    ),
    stated_total_units: money,
    stated_total_nrsf: money,
    confidence,
  }),
  financials: z.object({
    periods: z.array(
      z.object({
        period: z.enum(["actual_year", "t12", "year1_proj"]),
        period_label: z.string(),
        potential_rent: money,
        vacancy: money,
        other_income: money,
        egi: money,
        expenses: z.array(z.object({ label: z.string(), amount: money })),
        total_expenses: money,
        noi: money,
      }),
    ),
    confidence,
  }),
});

export type OmExtraction = z.infer<typeof omExtractionSchema>;

export const OM_SYSTEM_PROMPT = `You read self-storage offering memorandums (OMs) for an acquisitions team and extract facts into JSON.

Return only a single JSON object, no prose, matching this shape:
{
  "property": { "name", "city", "state" (2-letter), "address", "property_type" ("drive_up" | "climate" | "mixed" | "rv_boat"), "units", "nrsf", "acres", "buildings", "year_built", "construction", "confidence" },
  "occupancy": { "physical_pct" (0-100), "economic_pct" (0-100), "confidence" },
  "pricing": { "asking_price", "stated_cap_rate_pct" (e.g. 8.5 for 8.5%), "appraised_value", "confidence" },
  "broker": { "name", "firm" },
  "unit_mix": { "rows": [{ "unit_type", "width", "depth", "count", "occupied", "street_rent" (monthly), "in_place_rent" (monthly average actually paid), "climate" }], "stated_total_units", "stated_total_nrsf", "confidence" },
  "financials": { "periods": [{ "period" ("actual_year" | "t12" | "year1_proj"), "period_label", "potential_rent", "vacancy", "other_income", "egi", "expenses": [{ "label", "amount" }], "total_expenses", "noi" }], "confidence" }
}

Rules:
- Use numbers for money and counts (no $ or commas). Annual figures for financials, monthly for rents.
- Use null when the OM does not state a value. Never guess or compute a value the OM doesn't give.
- "actual_year" is the most recent full calendar or fiscal year of actuals, "t12" is trailing twelve months, "year1_proj" is the broker's year-one projection. Include only periods the OM shows.
- confidence is "high" when the value is printed clearly, "medium" when inferred from a table or chart, "low" when unclear.`;
