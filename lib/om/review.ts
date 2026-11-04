import { z } from "zod";
import type { Period } from "../types";
import type { UnitMixRow } from "../underwriting";
import { omExtractionSchema, type OmExtraction } from "./schema";

/** Flat, editable shape for the review screen. */
export interface ReviewData {
  property: {
    name: string;
    market_city: string;
    market_state: string;
    property_type: "drive_up" | "climate" | "mixed" | "rv_boat";
    units: number | null;
    nrsf: number | null;
    acres: number | null;
    buildings: number | null;
    year_built: number | null;
    construction: string;
  };
  pricing: { list_price: number | null; appraised_value: number | null; stated_cap_pct: number | null };
  occupancy: { physical_pct: number | null; economic_pct: number | null };
  broker: { name: string; firm: string };
  unitMix: UnitMixRow[];
  periods: {
    period: Period;
    period_label: string;
    potential_rent: number | null;
    vacancy: number | null;
    other_income: number | null;
    egi: number | null;
    total_expenses: number | null;
    noi: number | null;
    expenses: { label: string; amount: number }[];
  }[];
  confidence: Record<"property" | "pricing" | "occupancy" | "unit_mix" | "financials", "high" | "medium" | "low">;
}

const nn = z.number().finite().nullable();
export const reviewSchema = z.object({
  property: z.object({
    name: z.string().trim().min(1, "Give the deal a name"),
    market_city: z.string().trim(),
    market_state: z.string().trim().max(2).transform((s) => s.toUpperCase()),
    property_type: z.enum(["drive_up", "climate", "mixed", "rv_boat"]),
    units: nn, nrsf: nn, acres: nn, buildings: nn, year_built: nn,
    construction: z.string(),
  }),
  pricing: z.object({ list_price: nn, appraised_value: nn, stated_cap_pct: nn }),
  occupancy: z.object({ physical_pct: nn, economic_pct: nn }),
  broker: z.object({ name: z.string(), firm: z.string() }),
  unitMix: z.array(z.object({
    unit_type: z.string().min(1), width: z.number(), depth: z.number(), count: z.number().int(), occupied: z.number().int(),
    street_rent: z.number(), in_place_rent: z.number(), climate: z.boolean(),
  })),
  periods: z.array(z.object({
    period: z.enum(["actual_year", "t12", "year1_proj"]), period_label: z.string(),
    potential_rent: nn, vacancy: nn, other_income: nn, egi: nn, total_expenses: nn, noi: nn,
    expenses: z.array(z.object({ label: z.string(), amount: z.number() })),
  })),
  confidence: z.record(z.string(), z.enum(["high", "medium", "low"])),
});

export function toReview(raw: unknown, fallbackName: string): ReviewData {
  const parsed = omExtractionSchema.safeParse(raw);
  const e: OmExtraction | null = parsed.success ? parsed.data : null;
  const p = e?.property;
  return {
    property: {
      name: p?.name ?? fallbackName,
      market_city: p?.city ?? "",
      market_state: (p?.state ?? "").slice(0, 2).toUpperCase(),
      property_type: p?.property_type ?? "drive_up",
      units: p?.units ?? e?.unit_mix.stated_total_units ?? null,
      nrsf: p?.nrsf ?? e?.unit_mix.stated_total_nrsf ?? null,
      acres: p?.acres ?? null,
      buildings: p?.buildings ?? null,
      year_built: p?.year_built ?? null,
      construction: p?.construction ?? "",
    },
    pricing: {
      list_price: e?.pricing.asking_price ?? null,
      appraised_value: e?.pricing.appraised_value ?? null,
      stated_cap_pct: e?.pricing.stated_cap_rate_pct ?? null,
    },
    occupancy: { physical_pct: e?.occupancy.physical_pct ?? null, economic_pct: e?.occupancy.economic_pct ?? null },
    broker: { name: e?.broker.name ?? "", firm: e?.broker.firm ?? "" },
    unitMix: (e?.unit_mix.rows ?? []).map((r) => ({
      unit_type: r.unit_type,
      width: r.width ?? 0,
      depth: r.depth ?? 0,
      count: Math.round(r.count ?? 0),
      occupied: Math.round(r.occupied ?? 0),
      street_rent: r.street_rent ?? 0,
      in_place_rent: r.in_place_rent ?? r.street_rent ?? 0,
      climate: r.climate ?? false,
    })),
    periods: (e?.financials.periods ?? []).map((f) => ({
      period: f.period,
      period_label: f.period_label,
      potential_rent: f.potential_rent,
      vacancy: f.vacancy,
      other_income: f.other_income,
      egi: f.egi,
      total_expenses: f.total_expenses ?? (f.expenses.length ? f.expenses.reduce((s, x) => s + (x.amount ?? 0), 0) : null),
      noi: f.noi,
      expenses: f.expenses.map((x) => ({ label: x.label, amount: x.amount ?? 0 })),
    })),
    confidence: {
      property: p?.confidence ?? "low",
      pricing: e?.pricing.confidence ?? "low",
      occupancy: e?.occupancy.confidence ?? "low",
      unit_mix: e?.unit_mix.confidence ?? "low",
      financials: e?.financials.confidence ?? "low",
    },
  };
}

export const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
