import { PROPERTY_TYPE_LABEL, type Buyer, type Deal, type UnitMix } from "./types";
import { compactMoney } from "./format";
import { rentGap } from "./underwriting";

export interface MatchResult {
  buyer: Buyer;
  score: number;
  reasons: string[];
  misses: string[];
  /** Buyer won't take an assignment and this deal is one. Listed separately. */
  directOnly: boolean;
}

const k = compactMoney;

/** Pre-contract deals are treated as intended assignments (wholesale default). */
export function isAssignmentDeal(deal: Pick<Deal, "contract_signed_at" | "assignable">): boolean {
  return deal.contract_signed_at ? deal.assignable : true;
}

export function dealStrategy(deal: Pick<Deal, "physical_occupancy">, unitMix: UnitMix[]): "value_add" | "stabilized" {
  const gap = rentGap(unitMix);
  const gapPct = gap.potential_rent_monthly > 0 ? gap.monthly_upside / gap.potential_rent_monthly : 0;
  return (deal.physical_occupancy ?? 1) < 0.85 || gapPct > 0.05 ? "value_add" : "stabilized";
}

function range(value: number | null, min: number | null, max: number | null, points: number, label: string, fmt: (n: number) => string, reasons: string[], misses: string[]): number {
  if (value === null) return 0;
  if (min === null && max === null) {
    reasons.push(`No ${label} limit set`);
    return points / 2;
  }
  if ((min === null || value >= min) && (max === null || value <= max)) {
    reasons.push(`${label[0]!.toUpperCase()}${label.slice(1)} ${fmt(value)} fits ${min !== null ? fmt(min) : "any"}–${max !== null ? fmt(max) : "any"}`);
    return points;
  }
  misses.push(`${label[0]!.toUpperCase()}${label.slice(1)} ${fmt(value)} is outside ${min !== null ? fmt(min) : "any"}–${max !== null ? fmt(max) : "any"}`);
  return 0;
}

/**
 * Score 0–100: state 30, price 25, NRSF 15, property type 10, strategy 10,
 * assignment 10. Buyers who don't accept assignments are excluded from
 * assignment deals and flagged directOnly.
 */
export function scoreBuyer(deal: Deal, unitMix: UnitMix[], buyer: Buyer): MatchResult {
  const reasons: string[] = [];
  const misses: string[] = [];
  let score = 0;

  if (buyer.states.length === 0) {
    score += 15;
    reasons.push("Buys in any state");
  } else if (buyer.states.includes(deal.market_state)) {
    score += 30;
    reasons.push(`Buys in ${deal.market_state}`);
  } else misses.push(`Doesn't buy in ${deal.market_state}`);

  const price = deal.contract_price ?? deal.target_price ?? deal.list_price;
  score += range(price, buyer.min_price, buyer.max_price, 25, "price", k, reasons, misses);
  score += range(deal.nrsf, buyer.min_nrsf, buyer.max_nrsf, 15, "NRSF", (n) => `${n.toLocaleString("en-US")} SF`, reasons, misses);

  if (buyer.property_types.length === 0) score += 5;
  else if (buyer.property_types.includes(deal.property_type)) {
    score += 10;
    reasons.push(`Wants ${PROPERTY_TYPE_LABEL[deal.property_type].toLowerCase()}`);
  } else misses.push(`Prefers ${buyer.property_types.map((t) => PROPERTY_TYPE_LABEL[t].toLowerCase()).join(" or ")}`);

  const strat = dealStrategy(deal, unitMix);
  if (buyer.strategy === "any" || buyer.strategy === strat) {
    score += 10;
    reasons.push(strat === "value_add" ? "Value-add fit" : "Stabilized fit");
  } else misses.push(`Looks for ${buyer.strategy === "value_add" ? "value-add" : "stabilized"} deals`);

  const assignment = isAssignmentDeal(deal);
  const directOnly = assignment && !buyer.accepts_assignment;
  if (!assignment || buyer.accepts_assignment) {
    score += 10;
    if (assignment) reasons.push("Accepts assignments");
  } else misses.push("Direct purchase only");

  return { buyer, score: Math.round(score), reasons, misses, directOnly };
}

export function rankBuyers(deal: Deal, unitMix: UnitMix[], buyers: Buyer[]) {
  const all = buyers.map((b) => scoreBuyer(deal, unitMix, b)).sort((a, b) => b.score - a.score);
  return { matches: all.filter((m) => !m.directOnly), directOnly: all.filter((m) => m.directOnly) };
}
