/**
 * WeStor DealFlow underwriting engine.
 *
 * Every money calculation in the product lives here. The UI and API routes
 * call these pure functions and never do their own finance math.
 * Rates are decimals (0.075 = 7.5%). Money is plain dollars (number).
 */

export interface UnitMixRow {
  unit_type: string;
  width: number;
  depth: number;
  count: number;
  occupied: number;
  street_rent: number;
  in_place_rent: number;
  climate: boolean;
}

const finite = (n: number) => (Number.isFinite(n) ? n : 0);

/** Annual debt service with standard amortization, monthly compounding. */
export function annualDebtService(loan: number, annualRate: number, years: number): number {
  if (loan <= 0) return 0;
  const n = Math.round(years * 12);
  if (n <= 0) return loan;
  const r = annualRate / 12;
  if (r === 0) return (loan / n) * 12;
  const monthly = (loan * r) / (1 - Math.pow(1 + r, -n));
  return monthly * 12;
}

/** Annual debt service per $1 of loan (the loan constant). */
export function loanConstant(annualRate: number, years: number): number {
  return annualDebtService(1, annualRate, years);
}

export const capRate = (noi: number, price: number): number => (price > 0 ? noi / price : 0);

export const dscr = (noi: number, debtService: number): number =>
  debtService > 0 ? noi / debtService : Number.POSITIVE_INFINITY;

export const cashFlow = (noi: number, debtService: number): number => noi - debtService;

export const cashOnCash = (annualCashFlow: number, equity: number): number =>
  equity > 0 ? annualCashFlow / equity : 0;

export const pricePerNrsf = (price: number, nrsf: number): number => (nrsf > 0 ? price / nrsf : 0);

export const pricePerUnit = (price: number, units: number): number => (units > 0 ? price / units : 0);

export const economicOccupancy = (egi: number, potentialRent: number): number =>
  potentialRent > 0 ? egi / potentialRent : 0;

export const expenseRatio = (totalExpenses: number, egi: number): number =>
  egi > 0 ? totalExpenses / egi : 0;

export const physicalOccupancy = (rows: UnitMixRow[]): number => {
  const total = rows.reduce((s, r) => s + r.count, 0);
  const occ = rows.reduce((s, r) => s + r.occupied, 0);
  return total > 0 ? occ / total : 0;
};

export type DscrBand = "go" | "amber" | "stop";

/** Green ≥ 1.25, amber 1.10–1.24, red < 1.10. */
export function dscrBand(value: number): DscrBand {
  const rounded = Math.round(value * 100) / 100;
  if (rounded >= 1.25) return "go";
  if (rounded >= 1.1) return "amber";
  return "stop";
}

export interface RentGapRow {
  unit_type: string;
  count: number;
  occupied: number;
  street_rent: number;
  in_place_rent: number;
  gap_per_unit: number;
  gap_pct: number;
  monthly_upside: number;
}

export interface RentGapResult {
  rows: RentGapRow[];
  monthly_upside: number;
  annual_upside: number;
  potential_rent_monthly: number;
  potential_rent_annual: number;
}

/** Gap between street and in-place rent on occupied units. */
export function rentGap(unitMix: UnitMixRow[]): RentGapResult {
  const rows = unitMix.map((u) => {
    const gap = Math.max(0, u.street_rent - u.in_place_rent);
    return {
      unit_type: u.unit_type,
      count: u.count,
      occupied: u.occupied,
      street_rent: u.street_rent,
      in_place_rent: u.in_place_rent,
      gap_per_unit: gap,
      gap_pct: u.street_rent > 0 ? (u.street_rent - u.in_place_rent) / u.street_rent : 0,
      monthly_upside: gap * u.occupied,
    };
  });
  const monthly = rows.reduce((s, r) => s + r.monthly_upside, 0);
  const potential = unitMix.reduce((s, u) => s + u.street_rent * u.count, 0);
  return {
    rows,
    monthly_upside: monthly,
    annual_upside: monthly * 12,
    potential_rent_monthly: potential,
    potential_rent_annual: potential * 12,
  };
}

export interface UnderwriteInput {
  price: number;
  noi: number;
  downPct: number; // 0.3 = 30% down
  rate: number;
  years: number;
  nrsf?: number;
  units?: number;
  appraisedValue?: number | null;
}

export interface UnderwriteResult {
  price: number;
  equity: number;
  loan: number;
  debtService: number;
  capRate: number;
  dscr: number;
  dscrBand: DscrBand;
  cashFlow: number;
  cashOnCash: number;
  pricePerNrsf: number;
  pricePerUnit: number;
  spreadToAppraisal: number | null;
  spreadToAppraisalPct: number | null;
}

/** One call that powers the live underwriting panel. */
export function underwrite(i: UnderwriteInput): UnderwriteResult {
  const equity = i.price * i.downPct;
  const loan = Math.max(0, i.price - equity);
  const ds = annualDebtService(loan, i.rate, i.years);
  const d = dscr(i.noi, ds);
  const cf = cashFlow(i.noi, ds);
  const spread = i.appraisedValue ? i.appraisedValue - i.price : null;
  return {
    price: i.price,
    equity,
    loan,
    debtService: ds,
    capRate: capRate(i.noi, i.price),
    dscr: d,
    dscrBand: dscrBand(d),
    cashFlow: cf,
    cashOnCash: cashOnCash(cf, equity),
    pricePerNrsf: pricePerNrsf(i.price, i.nrsf ?? 0),
    pricePerUnit: pricePerUnit(i.price, i.units ?? 0),
    spreadToAppraisal: spread,
    spreadToAppraisalPct: spread !== null && i.appraisedValue ? spread / i.appraisedValue : null,
  };
}

export interface MaxOfferInput {
  noi: number;
  targetDscr: number;
  targetCap: number;
  rate: number;
  years: number;
  downPct: number;
  assignmentFee: number;
}

export type MaxOfferConstraint = "dscr" | "cap";

export interface MaxOfferResult {
  /** Highest contract price to the seller that satisfies every target. */
  maxOffer: number;
  /** All-in price the end buyer pays (contract price + assignment fee). */
  buyerPrice: number;
  priceAtDscr: number;
  priceAtCap: number;
  binding: MaxOfferConstraint;
  feasible: boolean;
}

/**
 * The end buyer pays contract price + assignment fee, so the DSCR and cap
 * targets are tested at the buyer's all-in price. The max offer to the seller
 * is that ceiling minus the fee. The lower ceiling is the binding constraint.
 */
export function maxOffer(i: MaxOfferInput): MaxOfferResult {
  const priceAtCap = i.targetCap > 0 ? i.noi / i.targetCap : Number.POSITIVE_INFINITY;
  const lc = loanConstant(i.rate, i.years);
  const loanFraction = 1 - i.downPct;
  const priceAtDscr =
    loanFraction <= 0 || lc <= 0 || i.targetDscr <= 0
      ? Number.POSITIVE_INFINITY
      : i.noi / (i.targetDscr * lc) / loanFraction;
  const binding: MaxOfferConstraint = priceAtDscr <= priceAtCap ? "dscr" : "cap";
  const buyerPrice = Math.min(priceAtDscr, priceAtCap);
  const offer = buyerPrice - i.assignmentFee;
  return {
    maxOffer: finite(Math.max(0, offer)),
    buyerPrice: finite(buyerPrice),
    priceAtDscr: finite(priceAtDscr),
    priceAtCap: finite(priceAtCap),
    binding,
    feasible: offer > 0 && Number.isFinite(buyerPrice),
  };
}

/** NOI from a financial period, falling back to EGI − expenses. */
export function periodNoi(p: { noi?: number | null; egi?: number | null; total_expenses?: number | null }): number {
  if (typeof p.noi === "number") return p.noi;
  return (p.egi ?? 0) - (p.total_expenses ?? 0);
}

/** Display rounding helpers used by previews (rounded ranges only). */
export function roundedRange(value: number, step: number): [number, number] {
  const low = Math.floor(value / step) * step;
  return [low, low + step];
}
