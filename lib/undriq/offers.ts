/** Offer generator: deterministic LOI, email and text built from the terms. No AI, no invented numbers. */
import { annualDebtService } from "../underwriting";
import { fmtK, fmtUsd, type Analysis, type DealFacts } from "./engine";

export const OFFER_TYPES = { cash: "Cash, as-is", assign: "Cash, assignable", finance: "Financed purchase", seller: "Seller financing" } as const;
export type OfferType = keyof typeof OFFER_TYPES;
export const OFFER_STATUSES = ["drafted", "sent", "countered", "accepted", "rejected"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export interface OfferTerms {
  rung: string;
  price: number;
  type: OfferType;
  emd: number;
  inspect: number;
  close: number;
  down: number;
  rate: number;
  years: number;
  balloon: number;
  costs: "each" | "buyer";
  asIs: boolean;
  expires: number;
  recipient: string;
  property: string;
  buyer: string;
  entity: string;
  phone: string;
  email: string;
}

const r1k = (v: number) => Math.round(v / 1000) * 1000;

export function offerDefaults(f: DealFacts, a: Analysis, me: Partial<Pick<OfferTerms, "buyer" | "entity" | "phone" | "email">> = {}): OfferTerms {
  const resi = f.asset === "residential";
  const best = a.best?.key;
  const type: OfferType = best === "seller" ? "seller" : best === "wholesale" ? "assign" : (best === "hold" || best === "brrrr") && !resi ? "finance" : "cash";
  const price = a.ladder ? a.ladder[0]!.price : f.list ?? 0;
  return {
    rung: a.ladder ? "Anchor" : "Custom",
    price,
    type,
    emd: Math.max(resi ? 1000 : 5000, r1k(price * 0.01)),
    inspect: type === "assign" ? (resi ? 14 : 45) : resi ? 10 : 30,
    close: resi ? 21 : 45,
    down: 0.1,
    rate: 0.06,
    years: 30,
    balloon: 5,
    costs: "each",
    asIs: resi,
    expires: 48,
    recipient: "",
    // Property line uses the deal name and market only; we never store or print a separate street address.
    property: [f.name, f.city && !f.name.toLowerCase().includes(f.city.toLowerCase()) ? f.city : null, f.state].filter(Boolean).join(", "),
    buyer: me.buyer ?? "",
    entity: me.entity ?? "",
    phone: me.phone ?? "",
    email: me.email ?? "",
  };
}

export interface OfferDocs {
  letter: string;
  email: string;
  text: string;
}

export function offerDocs(t: OfferTerms, f: Pick<DealFacts, "arv" | "rehab">, noi: number | null, today = new Date()): OfferDocs {
  const price = fmtUsd(t.price);
  const date = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const who = t.buyer || "[Your name]";
  const buyerLine = `${who}${t.entity ? `, on behalf of ${t.entity}` : ""}${t.type === "assign" ? " and/or assigns" : ""}`;
  const note = t.price * (1 - t.down);
  const pmt = note > 0 ? annualDebtService(note, t.rate, t.years) / 12 : 0;
  const financing: Record<OfferType, string> = {
    cash: "All cash. No financing contingency.",
    assign: "All cash. No financing contingency.",
    finance: `Buyer will obtain conventional financing and deliver a loan commitment within ${t.inspect + 7} days of acceptance.`,
    seller: `Seller financing. Buyer pays ${fmtUsd(t.price * t.down)} down (${Math.round(t.down * 100)}%). Seller carries a note of ${fmtUsd(note)} at ${(t.rate * 100).toFixed(2)}% interest, amortized over ${t.years} years (about ${fmtUsd(pmt)} per month), with the balance due in ${t.balloon} years.`,
  };
  const terms = [
    `Purchase price: ${price}`,
    `Financing: ${financing[t.type]}`,
    `Earnest money: ${fmtUsd(t.emd)}, deposited with the title or escrow company within 3 business days of acceptance.`,
    `Inspection period: ${t.inspect} days from acceptance. Buyer may cancel for any reason during this period and receive a full refund of earnest money.`,
    `Closing: on or before ${t.close} days after acceptance, at a title company chosen by Buyer.`,
    ...(t.asIs ? ["Condition: Buyer accepts the property in its present, as-is condition."] : []),
    `Closing costs: ${t.costs === "buyer" ? "Buyer pays all closing costs." : "Each party pays its customary closing costs."}`,
    ...(t.type === "assign" ? ["Assignment: Buyer may assign the purchase agreement without Seller's consent."] : []),
    `Expiration: this offer expires ${t.expires} hours after delivery.`,
  ];
  const sig = [who, t.entity, [t.phone, t.email].filter(Boolean).join(" · ")].filter(Boolean).join("\n");
  const prop = t.property || "[Property]";
  const letter = `Letter of intent to purchase\n\nDate: ${date}\nTo: ${t.recipient || "Seller and listing agent"}\nProperty: ${prop}\n\n${buyerLine} ("Buyer") submits this non-binding letter of intent to purchase the property above on these terms:\n\n${terms.map((x, i) => `${i + 1}. ${x}`).join("\n")}\n\nThis letter is non-binding and only outlines the terms of a purchase agreement. Neither party is bound until both sign a definitive purchase agreement.\n\nSincerely,\n${sig}`;
  const why = f.arv && f.rehab
    ? `My number reflects about ${fmtK(f.rehab)} in repairs against an after-repair value near ${fmtK(f.arv)}.`
    : noi ? `My number is based on the property's income of about ${fmtK(noi)} a year.` : "";
  const sellerTerms = t.type === "seller" ? `\n• Terms: ${Math.round(t.down * 100)}% down, ${(t.rate * 100).toFixed(2)}% over ${t.years} years, ${t.balloon}-year balloon` : "";
  const email = `Subject: Offer on ${prop}: ${price}\n\nHi ${t.recipient || "there"},\n\nI'd like to make an offer on ${prop}:\n\n• Price: ${price} (${OFFER_TYPES[t.type].toLowerCase()})\n• Earnest money: ${fmtUsd(t.emd)}\n• Inspection: ${t.inspect} days\n• Closing: within ${t.close} days${t.asIs ? ", as-is" : ""}${sellerTerms}\n\n${why ? `${why} ` : ""}My letter of intent with the full terms is attached. This offer is good for ${t.expires} hours.\n\nThanks,\n${sig}`;
  const short = prop.split(",")[0];
  const how = t.type === "cash" || t.type === "assign" ? " cash" : t.type === "seller" ? " with you carrying part of the price" : "";
  const text = `Hi, this is ${t.buyer ? t.buyer.split(" ")[0] : "[your name]"}. I'd like to buy ${short}. I can do ${price}${how} and close in ${t.close} days${t.asIs ? ", as-is with no repairs" : ""}. Do you have a few minutes to talk today?`;
  return { letter, email, text };
}
