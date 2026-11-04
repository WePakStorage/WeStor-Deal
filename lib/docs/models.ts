import { compactMoney, money, pct } from "../format";
import { PERIOD_LABEL, PROPERTY_TYPE_LABEL, type DealBundle, type Org, type Period, type UnderwritingDefaults } from "../types";
import { capRate, periodNoi, rentGap, roundedRange, underwrite } from "../underwriting";

export const FOOTER =
  "Confidential. For discussion purposes only. This is not an offer to sell or a solicitation of an offer to buy any security. Information is believed reliable but is not guaranteed; any buyer must perform its own due diligence.";

export interface PreviewModel {
  brand: string;
  tagline: string;
  title: string;
  market: string;
  propertyType: string;
  facts: { label: string; value: string }[];
  thesis: string[];
  disclaimer: string[];
  contact: { name: string; phone: string; email: string };
  footer: string;
  generatedOn: string;
}

const range = (v: number, step: number, fmt: (n: number) => string) => {
  const [lo, hi] = roundedRange(v, step);
  return `${fmt(lo)}–${fmt(hi)}`;
};

/**
 * Anonymous pre-contract preview. Never includes the property name, address,
 * exact unit count or seller financials: rounded ranges only.
 */
export function buildPreviewModel(bundle: DealBundle, org: Org): PreviewModel {
  const { deal, unitMix, financials } = bundle;
  const facts: { label: string; value: string }[] = [];
  facts.push({ label: "Market", value: deal.market_state ? `${deal.market_city ? `${deal.market_city} area` : "Metro"}, ${deal.market_state}` : "Disclosed on request" });
  facts.push({ label: "Property type", value: PROPERTY_TYPE_LABEL[deal.property_type] });
  if (deal.units) facts.push({ label: "Size", value: `${range(deal.units, 25, String)} units` });
  if (deal.nrsf) facts.push({ label: "Net rentable area", value: `${range(deal.nrsf, 5000, (n) => n.toLocaleString("en-US"))} SF` });
  if (deal.acres) facts.push({ label: "Land", value: deal.acres < 1 ? "Under 1 acre" : `${range(deal.acres, 1, String)} acres` });
  if (deal.year_built) facts.push({ label: "Vintage", value: `${Math.floor(deal.year_built / 10) * 10}s` });
  if (deal.physical_occupancy !== null) facts.push({ label: "Occupancy", value: `${range(deal.physical_occupancy * 100, 5, (n) => `${n}%`)}` });
  const price = deal.target_price ?? deal.list_price;
  if (price) {
    const step = price >= 2_000_000 ? 250_000 : 100_000;
    facts.push({ label: "Indicative pricing", value: range(price, step, compactMoney) });
  }
  const t12 = financials.find((f) => f.period === "t12") ?? financials[0];
  if (t12 && price) {
    const cap = capRate(periodNoi(t12), price) * 100;
    if (cap > 0) facts.push({ label: "Indicative cap rate", value: range(cap, 1, (n) => `${n}%`) });
  }

  const thesis: string[] = [];
  const gap = rentGap(unitMix);
  if (gap.potential_rent_monthly > 0 && gap.monthly_upside / gap.potential_rent_monthly > 0.03) thesis.push("In-place rents trail current street rates, with room to bring existing tenants to market.");
  if (deal.physical_occupancy !== null && deal.physical_occupancy < 0.88) thesis.push("Lease-up upside: occupancy sits below stabilized levels for the submarket.");
  if (deal.acres && deal.nrsf && deal.acres * 43_560 * 0.35 > deal.nrsf) thesis.push("Site coverage leaves potential room for expansion, subject to zoning.");
  if (deal.property_type === "drive_up") thesis.push("Drive-up, non-climate product keeps operating costs and management needs low.");
  if (thesis.length === 0) thesis.push("Established facility in a growing storage market.");

  const name = org.brand_name || org.name;
  return {
    brand: name,
    tagline: org.brand_tagline,
    title: `Self-storage opportunity · ${deal.market_state || "US"}`,
    market: facts[0]!.value,
    propertyType: PROPERTY_TYPE_LABEL[deal.property_type],
    facts,
    thesis,
    disclaimer: [
      "No contract is signed for this property.",
      `${name} does not own, control, or hold any interest in this property, and this preview is not an offer to sell it.`,
      "Figures are rounded ranges for discussion only. Property-specific details are shared only after a contract is in place and a confidentiality agreement is signed.",
    ],
    contact: { name: org.contact_name, phone: org.contact_phone, email: org.contact_email },
    footer: FOOTER,
    generatedOn: new Date().toISOString().slice(0, 10),
  };
}

export interface OmModel {
  brand: string;
  tagline: string;
  logoUrl: string | null;
  title: string;
  subtitle: string;
  summary: { label: string; value: string }[];
  narrative: string;
  highlights: string[];
  unitMix: { type: string; units: string; occupied: string; street: string; inPlace: string }[];
  unitMixTotals: { units: string; occupied: string; upside: string };
  income: { period: string; rows: { label: string; value: string }[] }[];
  returns: { label: string; value: string }[];
  returnsNote: string;
  contact: { name: string; phone: string; email: string };
  disclosure: string;
  footer: string;
  generatedOn: string;
}

/** Full branded OM. Never includes deal.address. */
export function buildOmModel(bundle: DealBundle, org: Org, defaults: UnderwritingDefaults): OmModel {
  const { deal, unitMix, financials, flags } = bundle;
  const price = deal.contract_price ?? deal.list_price ?? deal.target_price ?? 0;
  // The buyer's price includes the assignment fee when the contract is assigned.
  const buyerPrice = deal.assignable ? price + defaults.assignment_fee : price;
  const order: Period[] = ["actual_year", "t12", "year1_proj"];
  const periods = order.map((p) => financials.find((f) => f.period === p)).filter((f): f is NonNullable<typeof f> => Boolean(f));
  const basis = periods.find((p) => p.period === "t12") ?? periods[0];
  const noi = basis ? periodNoi(basis) : 0;
  const r = underwrite({ price: buyerPrice, noi, downPct: defaults.down_pct, rate: defaults.rate, years: defaults.years, nrsf: deal.nrsf ?? 0, units: deal.units ?? 0, appraisedValue: deal.appraised_value });
  const gap = rentGap(unitMix);
  const name = org.brand_name || org.name;

  const highlights: string[] = [];
  if (deal.units && deal.nrsf) highlights.push(`${deal.units} units across ${deal.nrsf.toLocaleString("en-US")} net rentable SF${deal.acres ? ` on ${deal.acres} acres` : ""}.`);
  if (deal.physical_occupancy !== null) highlights.push(`${pct(deal.physical_occupancy, 0)} physical occupancy${deal.physical_occupancy < 0.9 ? ", with lease-up upside" : ""}.`);
  if (gap.annual_upside > 0) highlights.push(`${money(gap.annual_upside)} a year in rent upside from moving occupied units to street rates.`);
  if (deal.appraised_value && buyerPrice < deal.appraised_value) highlights.push(`Priced ${money(deal.appraised_value - buyerPrice)} below the ${money(deal.appraised_value)} appraised value.`);
  if (noi && buyerPrice) highlights.push(`${pct(r.capRate)} ${basis ? PERIOD_LABEL[basis.period] : ""} cap rate at the offering price.`);
  for (const f of flags.filter((x) => x.code === "rent_gap").slice(0, 1)) highlights.push(f.message.replace(" Upside, if the market supports it.", "."));

  return {
    brand: name,
    tagline: org.brand_tagline,
    logoUrl: org.logo_url,
    title: deal.name,
    subtitle: `${[deal.market_city, deal.market_state].filter(Boolean).join(", ")} · ${PROPERTY_TYPE_LABEL[deal.property_type]} self storage`,
    summary: [
      { label: "Offering price", value: money(buyerPrice) },
      { label: "Units", value: deal.units ? String(deal.units) : "—" },
      { label: "Net rentable SF", value: deal.nrsf ? deal.nrsf.toLocaleString("en-US") : "—" },
      { label: "Acres", value: deal.acres ? String(deal.acres) : "—" },
      { label: "Year built", value: deal.year_built ? String(deal.year_built) : "—" },
      { label: "Occupancy", value: pct(deal.physical_occupancy, 0) },
      { label: "Price per SF", value: r.pricePerNrsf ? `$${r.pricePerNrsf.toFixed(2)}` : "—" },
      { label: `${basis ? PERIOD_LABEL[basis.period] : ""} NOI`, value: money(noi) },
    ],
    narrative: bundle.narrative ?? "",
    highlights,
    unitMix: unitMix.map((u) => ({ type: u.unit_type, units: String(u.count), occupied: String(u.occupied), street: money(u.street_rent), inPlace: money(u.in_place_rent) })),
    unitMixTotals: {
      units: String(unitMix.reduce((s, u) => s + u.count, 0)),
      occupied: String(unitMix.reduce((s, u) => s + u.occupied, 0)),
      upside: `${money(gap.monthly_upside)} / mo`,
    },
    income: periods.map((p) => ({
      period: p.period_label || PERIOD_LABEL[p.period],
      rows: [
        { label: "Potential rent", value: money(p.potential_rent) },
        { label: "Vacancy and loss", value: p.vacancy ? `(${money(p.vacancy)})` : "—" },
        { label: "Other income", value: money(p.other_income) },
        { label: "Effective gross income", value: money(p.egi) },
        ...p.expenses.filter((e) => e.amount).map((e) => ({ label: `  ${e.label}`, value: `(${money(e.amount)})` })),
        { label: "Total expenses", value: p.total_expenses !== null ? `(${money(p.total_expenses)})` : "—" },
        { label: "Net operating income", value: money(periodNoi(p)) },
      ],
    })),
    returns: [
      { label: "Price", value: money(buyerPrice) },
      { label: "Cap rate", value: pct(r.capRate) },
      { label: "Loan", value: `${money(r.loan)} (${Math.round((1 - defaults.down_pct) * 100)}% LTV)` },
      { label: "Annual debt service", value: money(r.debtService) },
      { label: "DSCR", value: Number.isFinite(r.dscr) ? `${r.dscr.toFixed(2)}x` : "All cash" },
      { label: "Annual cash flow", value: money(r.cashFlow) },
      { label: "Cash-on-cash", value: pct(r.cashOnCash, 1) },
    ],
    returnsNote: `Illustrative returns on ${basis ? PERIOD_LABEL[basis.period] : "stated"} NOI with ${Math.round(defaults.down_pct * 100)}% down, ${(defaults.rate * 100).toFixed(2)}% interest and ${defaults.years}-year amortization. Actual financing terms will vary.`,
    contact: { name: org.contact_name, phone: org.contact_phone, email: org.contact_email },
    disclosure: `${org.disclosure_entity || name} holds an equitable interest in this property under a purchase and sale agreement${deal.contract_signed_at ? ` dated ${deal.contract_signed_at}` : ""} and is not the owner of record. ${org.disclosure_entity || name} is marketing its contractual interest${deal.assignable ? " and intends to assign that contract to the buyer for a fee" : ""}. ${org.disclosure_entity || name} is not acting as a licensed real estate broker or agent for any party.`,
    footer: FOOTER,
    generatedOn: new Date().toISOString().slice(0, 10),
  };
}
