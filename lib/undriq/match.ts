/** Buyer fit for an UndrIq analysis: state, price, size, asset type and assignment terms. Pure and tested. */
import type { Buyer } from "../types";
import { ASSETS, assetOf } from "./assets";
import { fmtK, type DealFacts } from "./engine";

export interface BuyerFit {
  buyerId: string;
  firm: string;
  contact: string;
  email: string;
  score: number;
  yes: string[];
  no: string[];
}

export function scoreBuyerFit(f: DealFacts, price: number | null, b: Buyer): BuyerFit {
  const yes: string[] = [];
  const no: string[] = [];
  let s = 0;
  if (!b.states.length) {
    s += 15;
    yes.push("Any state");
  } else if (f.state && b.states.includes(f.state)) {
    s += 30;
    yes.push(`Buys in ${f.state}`);
  } else no.push(`Not in ${f.state || "this market"}`);

  if (price == null) s += 12;
  else if (b.min_price == null && b.max_price == null) {
    s += 12;
    yes.push("No price limit");
  } else if ((b.min_price == null || price >= b.min_price) && (b.max_price == null || price <= b.max_price)) {
    s += 25;
    yes.push("Price fits");
  } else no.push(`Price ${fmtK(price)} outside range`);

  if (f.nrsf == null || (b.min_nrsf == null && b.max_nrsf == null)) s += 7;
  else if ((b.min_nrsf == null || f.nrsf >= b.min_nrsf) && (b.max_nrsf == null || f.nrsf <= b.max_nrsf)) {
    s += 15;
    yes.push("Size fits");
  } else no.push("Size outside range");

  const types = b.property_types as string[];
  if (!types.length) s += 5;
  else if (types.includes(f.type)) {
    s += 10;
    yes.push("Wants this property type");
  } else if (types.some((t) => assetOf(t) === f.asset)) {
    s += 6;
    yes.push(`Buys ${ASSETS[f.asset].label.toLowerCase()}`);
  } else no.push("Different asset class");

  s += b.strategy === "any" ? 10 : 5;
  if (b.accepts_assignment) {
    s += 10;
    yes.push("Takes assignments");
  } else no.push("Direct purchase only");

  return { buyerId: b.id, firm: b.firm_name, contact: b.contact_name, email: b.email, score: Math.round(s), yes, no };
}

export function topBuyers(f: DealFacts, price: number | null, buyers: Buyer[], n = 5): BuyerFit[] {
  return buyers.map((b) => scoreBuyerFit(f, price, b)).filter((x) => x.score >= 50).sort((a, b) => b.score - a.score).slice(0, n);
}
