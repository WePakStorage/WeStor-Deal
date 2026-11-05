/**
 * Facts extraction: the prompt and schema for the AI read step, plus a deterministic
 * fallback that pulls obvious numbers out of pasted text (used in demo mode, when no
 * API key is set, and to fill gaps the model leaves).
 */
import { z } from "zod";
import { ASSETS, assetOf, defaultType, isAssetClass, PROPERTY_TYPE_LABELS, type AssetClass } from "./assets";
import { emptyFacts, type DealFacts } from "./engine";
import type { ParsedLink } from "./linkparse";

/** "1,250,000", "$1.25M", "850k", 850000 → number. Anything else → null. */
export function toNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim().toLowerCase().replace(/[$,\s]/g, "");
  const m = s.match(/^(-?\d+(?:\.\d+)?)(k|m|mm)?$/);
  if (!m) return null;
  const n = Number(m[1]) * (m[2] === "k" ? 1e3 : m[2] ? 1e6 : 1);
  return Number.isFinite(n) ? n : null;
}

const num = z.preprocess(toNumber, z.number().nullable()).catch(null);
const str = z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 300) : null), z.string().nullable()).catch(null);

export const extractedSchema = z.object({
  name: z.preprocess((v) => (typeof v === "string" ? v.trim().slice(0, 140) : ""), z.string()).catch(""),
  city: str,
  state: z.preprocess((v) => (typeof v === "string" && /^[a-z]{2}$/i.test(v.trim()) ? v.trim().toUpperCase() : null), z.string().nullable()).catch(null),
  type: z.preprocess((v) => (typeof v === "string" ? v : ""), z.string()).catch(""),
  list: num,
  noi: num,
  rentMonthly: num,
  grossAnnual: num,
  expensesAnnual: num,
  statedCapPct: num,
  arv: num,
  rehab: num,
  nrsf: num,
  units: num,
  yearBuilt: num,
  occupancyPct: num,
  appraised: num,
  daysOnMarket: num,
  leaseNote: str,
  motivation: z
    .object({
      score: z.preprocess(toNumber, z.number().min(0).max(10)).catch(0),
      signals: z.array(z.string()).catch([]).transform((a) => a.filter((s) => s.trim()).slice(0, 5)),
      leverage: z.string().catch(""),
    })
    .nullable()
    .catch(null),
  missing: z.array(z.string()).catch([]),
});
export type Extracted = z.infer<typeof extractedSchema>;

export const memoSchema = z.object({
  headline: z.string().min(1),
  thesis: z.array(z.string()).catch([]).transform((a) => a.slice(0, 3)),
  risks: z.array(z.string()).catch([]).transform((a) => a.slice(0, 3)),
  nextSteps: z.array(z.string()).catch([]).transform((a) => a.slice(0, 4)),
  killers: z.array(z.string()).catch([]).transform((a) => a.slice(0, 3)),
  mustBeTrue: z.array(z.string()).catch([]).transform((a) => a.slice(0, 3)),
  offerScript: z.string().catch(""),
});

const FACTS_SHAPE = `{"name": string, "city": string|null, "state": "2-letter"|null, "type": ${JSON.stringify(Object.keys(PROPERTY_TYPE_LABELS).join("|"))},
 "list": number|null, "noi": number|null, "rentMonthly": number|null, "grossAnnual": number|null, "expensesAnnual": number|null, "statedCapPct": number|null,
 "arv": number|null, "rehab": number|null, "nrsf": number|null, "units": number|null, "yearBuilt": number|null, "occupancyPct": number|null, "appraised": number|null,
 "daysOnMarket": number|null, "leaseNote": string|null,
 "motivation": {"score": 0-10, "signals": [up to 5 short phrases from the listing], "leverage": "one sentence on how to use them in the negotiation"},
 "missing": [important fields you could not find]}`;

export const EXTRACT_SYSTEM = "You extract facts from real estate listings and offering memorandums for an investor. You only report what the document states. You reply with JSON only.";

export function extractPrompt(asset: AssetClass, link: ParsedLink | null, hasText: boolean): string {
  const lk = link
    ? `Listing link: ${link.url} (${link.site}). You cannot open it. The link itself says: ${[link.street || link.name, link.city, link.state, link.zip].filter(Boolean).join(", ") || "no address"}.\n`
    : "";
  return `Extract the facts of one real estate listing. Asset class selected: ${ASSETS[asset].label}.
${lk}Rules: use only numbers stated in the ${hasText ? "text" : "document"}. Money as plain numbers (no $ or commas). Annual NOI and expenses; monthly rent is the TOTAL for the property. Percentages as numbers (7.5 means 7.5%). If the text is a copied web page, ignore menus, ads, mortgage calculators and "similar homes" or "nearby listings": use only the subject property. Use null when a value isn't there. For a house, put a stated or estimated repair cost in rehab and an after-repair value or renovated comps in arv only if the text gives them. Score seller motivation from the listing language (price drops, days on market, as-is, estate, vacant, tired landlord, bring all offers).
Reply with only this JSON object:
${FACTS_SHAPE}`;
}

export const MEMO_SYSTEM =
  "You are UndrIq, an acquisitions analyst for real estate investors and wholesalers. You write short, direct deal memos using only the computed numbers you are given. You never recalculate or invent figures, and you argue honestly against a deal where the numbers are weak. You reply with JSON only.";

export function memoPrompt(data: unknown): string {
  return `Write the memo for this deal using ONLY these computed numbers:
${JSON.stringify(data)}

Reply with only this JSON object:
{"headline": "one plain sentence an investor can act on, naming the best exit and the target price",
 "thesis": [up to 3 short strings], "risks": [up to 3 short strings], "nextSteps": [up to 4 short strings],
 "killers": [exactly 3 short ways this deal fails], "mustBeTrue": [exactly 3 assumptions that must hold for the best exit],
 "offerScript": "a 3-4 sentence opening message to the agent or seller proposing the anchor price"}`;
}

/** Turn extracted JSON into engine facts. Percent fields arrive as 7.5 or 0.075; both work. */
export function factsFrom(x: Extracted, asset: AssetClass, typeHint: string | null, fallbackName: string): DealFacts {
  const pct = (v: number | null) => (v == null ? null : v > 1 ? v / 100 : v);
  const type = typeHint && assetOf(typeHint) === asset ? typeHint : x.type && assetOf(x.type) === asset ? x.type : defaultType(asset);
  return {
    ...emptyFacts(asset, type, x.name || fallbackName),
    city: x.city,
    state: x.state,
    list: x.list,
    noi: x.noi,
    rentMonthly: x.rentMonthly,
    gross: x.grossAnnual,
    expenses: x.expensesAnnual,
    statedCap: pct(x.statedCapPct),
    arv: x.arv,
    rehab: x.rehab,
    nrsf: x.nrsf,
    units: x.units,
    yearBuilt: x.yearBuilt && x.yearBuilt > 1800 && x.yearBuilt <= new Date().getFullYear() + 2 ? x.yearBuilt : null,
    occupancy: pct(x.occupancyPct),
    appraised: x.appraised,
    daysOnMarket: x.daysOnMarket,
    leaseNote: x.leaseNote,
  };
}

const MONEY = String.raw`\$?\s?(\d[\d,]*(?:\.\d+)?)\s?(k|m|mm|million)?\b`;
function moneyAfter(text: string, labels: string): number | null {
  const re = new RegExp(String.raw`(?:${labels})[^\d$\n]{0,24}` + MONEY, "i");
  const m = text.match(re);
  if (!m) return null;
  const unit = (m[2] ?? "").toLowerCase();
  const n = Number(m[1]!.replace(/,/g, "")) * (unit === "k" ? 1e3 : unit ? 1e6 : 1);
  return Number.isFinite(n) && n > 0 ? n : null;
}
function numAfter(text: string, labels: string): number | null {
  const m = text.match(new RegExp(String.raw`(?:${labels})[^\d\n]{0,16}(\d[\d,]*(?:\.\d+)?)`, "i"));
  return m ? Number(m[1]!.replace(/,/g, "")) : null;
}

/** Deterministic read of the obvious numbers. Never guesses: a missing label stays null. */
export function heuristicExtract(text: string): Extracted {
  const t = text.replace(/ /g, " ");
  const occ = t.match(/(\d{1,3}(?:\.\d+)?)\s?%\s*(?:occupied|occupancy|leased)/i) ?? t.match(/occupancy[^\d\n]{0,12}(\d{1,3}(?:\.\d+)?)\s?%/i);
  const cap = t.match(/(\d{1,2}(?:\.\d+)?)\s?%\s*cap/i) ?? t.match(/cap rate[^\d\n]{0,12}(\d{1,2}(?:\.\d+)?)/i);
  const dom = t.match(/(\d{1,4})\s*days? on (?:market|zillow|redfin|site)/i);
  const year = t.match(/(?:built in|year built)[^\d\n]{0,6}(1[89]\d\d|20\d\d)/i);
  const signals = [
    /price (?:cut|drop|reduced|reduction)/i.test(t) && "Price reduced",
    /as[- ]is/i.test(t) && "Sold as-is",
    /estate|probate|inherit/i.test(t) && "Estate sale",
    /vacant/i.test(t) && "Vacant",
    /motivated|bring (?:all )?offers|must sell/i.test(t) && "Motivated seller language",
    /tired landlord|retir/i.test(t) && "Tired landlord or retiring owner",
  ].filter((x): x is string => !!x);
  return {
    name: (t.split("\n").map((l) => l.trim()).find((l) => l.length > 4 && l.length < 90) ?? "").slice(0, 140),
    city: null,
    state: null,
    type: "",
    list: moneyAfter(t, "asking price|list price|listed (?:at|for)|price|asking|offered at"),
    noi: moneyAfter(t, "net operating income|\\bnoi\\b"),
    rentMonthly: moneyAfter(t, "monthly rent|rent(?:s)? (?:of|at)|rents? for|gross rent(?:s)?/mo|rent/mo|total rent"),
    grossAnnual: moneyAfter(t, "gross (?:annual )?income|gross revenue|effective gross income|\\begi\\b|total income"),
    expensesAnnual: moneyAfter(t, "operating expenses|total expenses|\\bopex\\b|expenses"),
    statedCapPct: cap ? Number(cap[1]) : null,
    arv: moneyAfter(t, "after[- ]repair value|\\barv\\b"),
    rehab: moneyAfter(t, "repairs?|rehab|renovation (?:budget|cost)|needs about"),
    nrsf: numAfter(t, "nrsf|net rentable|rentable (?:sq|square)"),
    units: numAfter(t, "units?:|unit count|total units"),
    yearBuilt: year ? Number(year[1]) : null,
    occupancyPct: occ ? Number(occ[1]) : null,
    appraised: moneyAfter(t, "appraised (?:value|at)|appraisal"),
    daysOnMarket: dom ? Number(dom[1]) : null,
    leaseNote: /month[- ]to[- ]month|mtm/i.test(t) ? "Month-to-month leases" : null,
    motivation: signals.length ? { score: Math.min(10, signals.length * 2 + 1), signals, leverage: "Use the listed signals to justify a lower opening number and a fast, clean close." } : null,
    missing: [],
  };
}

/** Fill nulls in the AI read with the deterministic read (the AI wins wherever it found a value). */
export function mergeExtracted(ai: Extracted, h: Extracted): Extracted {
  const out = { ...ai } as Record<string, unknown>;
  for (const [k, v] of Object.entries(h)) if ((out[k] == null || out[k] === "") && v != null && v !== "") out[k] = v;
  return out as Extracted;
}

export { isAssetClass };
