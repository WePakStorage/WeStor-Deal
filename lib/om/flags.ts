import { PERIOD_LABEL, type DealFlag, type Period } from "../types";
import { capRate, economicOccupancy, expenseRatio, periodNoi, type UnitMixRow } from "../underwriting";

export interface FlagInput {
  units: number | null;
  nrsf: number | null;
  physicalOccupancy: number | null; // decimal
  economicOccupancy?: number | null; // decimal, when stated
  askingPrice: number | null;
  appraisedValue: number | null;
  statedCapRate?: number | null; // decimal
  unitMix: UnitMixRow[];
  periods: { period: Period; period_label?: string; potential_rent: number | null; egi: number | null; total_expenses: number | null; noi: number | null }[];
}

export type NewFlag = Omit<DealFlag, "id" | "deal_id">;

const PERIOD_ORDER: Period[] = ["actual_year", "t12", "year1_proj"];
const pct1 = (n: number) => `${(n * 100).toFixed(1)}%`;
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** Deterministic underwriting checks (code, not AI). Thresholds per spec section 6.4. */
export function computeFlags(i: FlagInput, source = "checks"): NewFlag[] {
  const flags: NewFlag[] = [];
  const warn = (code: string, message: string) => flags.push({ level: "warn", code, message, source });
  const info = (code: string, message: string) => flags.push({ level: "info", code, message, source });

  const periods = [...i.periods].sort((a, b) => PERIOD_ORDER.indexOf(a.period) - PERIOD_ORDER.indexOf(b.period));
  const label = (p: (typeof periods)[number]) => p.period_label || PERIOD_LABEL[p.period];

  // 1. NOI swing > 20% between periods
  for (let a = 0; a < periods.length; a++) {
    for (let b = a + 1; b < periods.length; b++) {
      const pa = periods[a]!;
      const pb = periods[b]!;
      const na = periodNoi(pa);
      const nb = periodNoi(pb);
      if (!na || !nb) continue;
      const swing = (nb - na) / Math.abs(na);
      if (Math.abs(swing) > 0.2) {
        warn("noi_swing", `NOI moves ${swing > 0 ? "up" : "down"} ${pct1(Math.abs(swing))} from ${label(pa)} (${usd(na)}) to ${label(pb)} (${usd(nb)}). Ask the seller what changed.`);
      }
    }
  }

  // 2. Unit mix totals vs stated totals
  if (i.unitMix.length) {
    const mixUnits = i.unitMix.reduce((s, r) => s + r.count, 0);
    const mixNrsf = i.unitMix.reduce((s, r) => s + r.width * r.depth * r.count, 0);
    if (i.units && mixUnits !== i.units) warn("unit_count_mismatch", `Unit mix adds up to ${mixUnits} units, but the stated total is ${i.units}.`);
    if (i.nrsf && mixNrsf > 0 && Math.abs(mixNrsf - i.nrsf) / i.nrsf > 0.02) {
      warn("nrsf_mismatch", `Unit mix adds up to ${mixNrsf.toLocaleString("en-US")} SF, but the stated NRSF is ${i.nrsf.toLocaleString("en-US")}.`);
    }
    if (i.units && i.nrsf && mixUnits === i.units && Math.abs(mixNrsf - i.nrsf) / i.nrsf <= 0.02) {
      flags.push({ level: "ok", code: "unit_mix_ties", message: "Unit mix ties to the stated unit count and NRSF.", source });
    }
  }

  // 3. Physical vs economic occupancy gap > 10 points
  if (i.physicalOccupancy !== null) {
    const t12 = periods.find((p) => p.period === "t12") ?? periods[0];
    const econ = i.economicOccupancy ?? (t12 && t12.egi && t12.potential_rent ? economicOccupancy(t12.egi, t12.potential_rent) : null);
    if (econ !== null && i.physicalOccupancy - econ > 0.1) {
      warn("occupancy_gap", `Physical occupancy is ${pct1(i.physicalOccupancy)} but economic occupancy is ${pct1(econ)}, a ${((i.physicalOccupancy - econ) * 100).toFixed(1)}-point gap. Check delinquencies, concessions and below-market rents.`);
    }
  }

  // 4. In-place rents more than 15% below street
  for (const r of i.unitMix) {
    if (r.street_rent > 0 && (r.street_rent - r.in_place_rent) / r.street_rent > 0.15) {
      info("rent_gap", `${r.unit_type} in-place rent ($${r.in_place_rent}) is ${pct1((r.street_rent - r.in_place_rent) / r.street_rent)} below street ($${r.street_rent}). Upside, if the market supports it.`);
    }
  }

  // 5. Expense ratio outside 25%–50%
  for (const p of periods) {
    if (!p.egi || p.total_expenses === null) continue;
    const er = expenseRatio(p.total_expenses, p.egi);
    if (er < 0.25) warn("expense_ratio_low", `${label(p)} expense ratio is ${pct1(er)}, below the usual 25% floor. Expenses may be missing (management, payroll, reserves).`);
    if (er > 0.5) warn("expense_ratio_high", `${label(p)} expense ratio is ${pct1(er)}, above 50%. Look for one-time items or mismanagement.`);
  }

  // 6. Asking price above appraisal
  if (i.askingPrice && i.appraisedValue && i.askingPrice > i.appraisedValue) {
    warn("price_above_appraisal", `Asking price ${usd(i.askingPrice)} is ${usd(i.askingPrice - i.appraisedValue)} above the appraised value of ${usd(i.appraisedValue)}.`);
  }

  // 7. Stated cap rate vs NOI ÷ price, within 0.2 points
  if (i.statedCapRate && i.askingPrice) {
    const computed = periods.map((p) => ({ p, cap: capRate(periodNoi(p), i.askingPrice!) })).filter((x) => x.cap > 0);
    if (computed.length && !computed.some((x) => Math.abs(x.cap - i.statedCapRate!) <= 0.002)) {
      const detail = computed.map((x) => `${label(x.p)} ${pct1(x.cap)}`).join(", ");
      warn("stated_cap_mismatch", `The OM states a ${pct1(i.statedCapRate)} cap, but NOI ÷ asking price gives ${detail}.`);
    }
  }

  return flags;
}
