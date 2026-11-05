/**
 * RentCast property data (https://developers.rentcast.io). Licensed public-record, AVM and MLS-derived
 * listing data looked up by ADDRESS. UndrIq never fetches or scrapes Zillow or any listing site; a
 * pasted link only gives us the address.
 *
 * Pure parsing lives here so it can be unit-tested; the HTTP call takes an injectable fetch.
 */
import { z } from "zod";
import type { AssetClass } from "../undriq/assets";
import { parseListingUrl } from "../undriq/linkparse";

/** Override only for local testing against a mock server. */
export const RENTCAST_BASE = process.env.RENTCAST_BASE_URL || "https://api.rentcast.io/v1";
/** A full lookup makes up to this many API calls (property, value, rent, sale listing). */
export const CALLS_PER_LOOKUP = 4;

export interface LookupAddress {
  street: string;
  city: string;
  state: string;
  zip: string | null;
}

export const formatAddress = (a: LookupAddress) => `${a.street}, ${a.city}, ${a.state}${a.zip ? ` ${a.zip}` : ""}`;

/** Cache key: same property typed slightly differently hits the same row. */
export function addressKey(a: LookupAddress): string {
  return formatAddress(a)
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\b(street)\b/g, "st").replace(/\b(avenue)\b/g, "ave").replace(/\b(road)\b/g, "rd").replace(/\b(drive)\b/g, "dr")
    .replace(/\b(lane)\b/g, "ln").replace(/\b(boulevard)\b/g, "blvd").replace(/\b(court)\b/g, "ct")
    .replace(/\s+/g, " ")
    .trim();
}

/** "1234 Main St, Memphis, TN 38118" → parts. Null if there's no street number, city and state. */
export function parseTypedAddress(raw: string): LookupAddress | null {
  const s = raw.trim().replace(/\s+/g, " ");
  const m = s.match(/^(\d+[\w\s.#-]*?),\s*([A-Za-z .'-]+?),\s*([A-Za-z]{2})(?:\s+(\d{5})(?:-\d{4})?)?$/);
  if (!m) return null;
  return { street: m[1]!.trim(), city: m[2]!.trim(), state: m[3]!.toUpperCase(), zip: m[4] ?? null };
}

/** Resolve an address from what the user typed, else from the listing link's path. */
export function resolveAddress(address?: string | null, link?: string | null): LookupAddress | null {
  if (address?.trim()) return parseTypedAddress(address);
  const p = link ? parseListingUrl(link) : null;
  return p && p.street && /^\d/.test(p.street) && p.city && p.state ? { street: p.street, city: p.city, state: p.state, zip: p.zip } : null;
}

// ───────────────────────── Lenient response schemas (fields RentCast documents; anything missing → null)
const n = z.number().finite().nullable().optional().catch(null);
const s = z.string().nullable().optional().catch(null);

const compSchema = z.object({
  formattedAddress: s,
  propertyType: s,
  bedrooms: n,
  bathrooms: n,
  squareFootage: n,
  yearBuilt: n,
  price: n,
  daysOnMarket: n,
  distance: n,
  listedDate: s,
  status: s,
});

const propertySchema = z.object({
  formattedAddress: s,
  city: s,
  state: s,
  zipCode: s,
  county: s,
  propertyType: s,
  bedrooms: n,
  bathrooms: n,
  squareFootage: n,
  lotSize: n,
  yearBuilt: n,
  lastSalePrice: n,
  lastSaleDate: s,
  ownerOccupied: z.boolean().nullable().optional().catch(null),
  hoa: z.object({ fee: n }).nullable().optional().catch(null),
  features: z.object({ unitCount: n, floorCount: n }).passthrough().nullable().optional().catch(null),
  taxAssessments: z.record(z.string(), z.object({ year: n, value: n }).passthrough()).nullable().optional().catch(null),
  propertyTaxes: z.record(z.string(), z.object({ year: n, total: n }).passthrough()).nullable().optional().catch(null),
  owner: z.object({ type: s }).passthrough().nullable().optional().catch(null),
});

const avmSchema = z.object({
  price: n,
  priceRangeLow: n,
  priceRangeHigh: n,
  rent: n,
  rentRangeLow: n,
  rentRangeHigh: n,
  comparables: z.array(compSchema.catch({})).nullable().optional().catch(null),
});

const contactSchema = z.object({ name: s, phone: s, email: s }).nullable().optional().catch(null);
const listingSchema = z.object({
  price: n,
  status: s,
  daysOnMarket: n,
  listedDate: s,
  mlsNumber: s,
  listingAgent: contactSchema,
  listingOffice: contactSchema,
});

export interface Comp {
  address: string;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  distanceMi: number | null;
  status: string | null;
}

export interface PropertyRecord {
  source: "RentCast";
  fetchedAt: string;
  address: string;
  property: {
    type: string | null;
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    lotSqft: number | null;
    yearBuilt: number | null;
    units: number | null;
    county: string | null;
    lastSalePrice: number | null;
    lastSaleDate: string | null;
    taxAssessed: number | null;
    annualTax: number | null;
    hoaMonthly: number | null;
    ownerOccupied: boolean | null;
    ownerType: string | null;
  } | null;
  value: { estimate: number | null; low: number | null; high: number | null; comps: Comp[] } | null;
  rent: { estimate: number | null; low: number | null; high: number | null; comps: Comp[] } | null;
  listing: {
    price: number | null;
    status: string | null;
    daysOnMarket: number | null;
    listedDate: string | null;
    mlsNumber: string | null;
    agent: { name: string | null; phone: string | null; email: string | null } | null;
    office: string | null;
  } | null;
  /** Endpoints that failed or returned nothing (shown to the user, never silently guessed around). */
  missing: string[];
}

const latest = <T extends { year?: number | null }>(rec: Record<string, T> | null | undefined): T | null => {
  if (!rec) return null;
  const rows = Object.entries(rec).map(([k, v]) => ({ y: v.year ?? Number(k), v }));
  rows.sort((a, b) => b.y - a.y);
  return rows[0]?.v ?? null;
};

const toComp = (c: z.infer<typeof compSchema>): Comp => ({
  address: c.formattedAddress ?? "",
  price: c.price ?? null,
  beds: c.bedrooms ?? null,
  baths: c.bathrooms ?? null,
  sqft: c.squareFootage ?? null,
  distanceMi: c.distance ?? null,
  status: c.status ?? null,
});

/** Turn raw endpoint JSON into a PropertyRecord. Each input may be null (call failed / no match). */
export function parseRecord(address: string, raw: { property: unknown; value: unknown; rent: unknown; listing: unknown }, now = new Date()): PropertyRecord {
  const missing: string[] = [];
  const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);

  const p = raw.property != null ? propertySchema.safeParse(first(raw.property)) : null;
  const prop = p?.success ? p.data : null;
  if (!prop) missing.push("property record");

  const v = raw.value != null ? avmSchema.safeParse(raw.value) : null;
  const val = v?.success && v.data.price != null ? v.data : null;
  if (!val) missing.push("value estimate");

  const r = raw.rent != null ? avmSchema.safeParse(raw.rent) : null;
  const rent = r?.success && r.data.rent != null ? r.data : null;
  if (!rent) missing.push("rent estimate");

  const l = raw.listing != null ? listingSchema.safeParse(first(raw.listing)) : null;
  const list = l?.success && l.data.price != null ? l.data : null;

  const tax = latest(prop?.taxAssessments ?? null);
  const ptax = latest(prop?.propertyTaxes ?? null);
  return {
    source: "RentCast",
    fetchedAt: now.toISOString(),
    address: prop?.formattedAddress ?? address,
    property: prop
      ? {
          type: prop.propertyType ?? null,
          beds: prop.bedrooms ?? null,
          baths: prop.bathrooms ?? null,
          sqft: prop.squareFootage ?? null,
          lotSqft: prop.lotSize ?? null,
          yearBuilt: prop.yearBuilt ?? null,
          units: prop.features?.unitCount ?? null,
          county: prop.county ?? null,
          lastSalePrice: prop.lastSalePrice ?? null,
          lastSaleDate: prop.lastSaleDate ?? null,
          taxAssessed: tax?.value ?? null,
          annualTax: ptax?.total ?? null,
          hoaMonthly: prop.hoa?.fee ?? null,
          ownerOccupied: prop.ownerOccupied ?? null,
          // Owner type only (Individual / Organization). We don't store owner names.
          ownerType: prop.owner?.type ?? null,
        }
      : null,
    value: val ? { estimate: val.price ?? null, low: val.priceRangeLow ?? null, high: val.priceRangeHigh ?? null, comps: (val.comparables ?? []).slice(0, 6).map(toComp) } : null,
    rent: rent ? { estimate: rent.rent ?? null, low: rent.rentRangeLow ?? null, high: rent.rentRangeHigh ?? null, comps: (rent.comparables ?? []).slice(0, 6).map(toComp) } : null,
    listing: list
      ? {
          price: list.price ?? null,
          status: list.status ?? null,
          daysOnMarket: list.daysOnMarket ?? null,
          listedDate: list.listedDate ?? null,
          mlsNumber: list.mlsNumber ?? null,
          agent: list.listingAgent ? { name: list.listingAgent.name ?? null, phone: list.listingAgent.phone ?? null, email: list.listingAgent.email ?? null } : null,
          office: list.listingOffice?.name ?? null,
        }
      : null,
    missing,
  };
}

const SINGLE_UNIT = /single|condo|townhouse|manufactured/i;

export interface SuggestedFacts {
  list: number | null;
  rentMonthly: number | null;
  arv: number | null;
  yearBuilt: number | null;
  nrsf: number | null;
  units: number | null;
  daysOnMarket: number | null;
  notes: string[];
}

/**
 * What a record fills in. Conservative on purpose:
 * - Asking price only from an ACTIVE listing.
 * - Rent only for single-unit homes (RentCast's rent estimate is for one unit).
 * - The value estimate assumes typical condition, so it is offered as ARV for houses with a note to check it.
 */
export function suggestFacts(rec: PropertyRecord, asset: AssetClass): SuggestedFacts {
  const notes: string[] = [];
  const active = rec.listing && /active|pending/i.test(rec.listing.status ?? "active");
  const singleUnit = SINGLE_UNIT.test(rec.property?.type ?? "") || (asset === "residential" && !rec.property?.units);
  const rentMonthly = singleUnit ? rec.rent?.estimate ?? null : null;
  if (rec.rent?.estimate && !singleUnit) notes.push(`Rent estimate is about $${Math.round(rec.rent.estimate).toLocaleString()} per unit. Enter the total rent for all units.`);
  const arv = asset === "residential" ? rec.value?.estimate ?? null : null;
  if (arv) notes.push("Value estimate assumes typical condition. Use it as ARV only if comps are renovated.");
  if (!active) notes.push("No active listing found. Enter the asking price.");
  return {
    list: active ? rec.listing!.price : null,
    rentMonthly,
    arv,
    yearBuilt: rec.property?.yearBuilt ?? null,
    nrsf: rec.property?.sqft ?? null,
    units: rec.property?.units ?? null,
    daysOnMarket: active ? rec.listing!.daysOnMarket : null,
    notes,
  };
}

export class RentcastError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Call the four endpoints in parallel. Failures of individual endpoints are recorded, not fatal. */
export async function fetchRentcast(a: LookupAddress, apiKey: string, fetchImpl: typeof fetch = fetch): Promise<{ record: PropertyRecord; calls: number }> {
  const address = formatAddress(a);
  const q = (path: string, extra: Record<string, string> = {}) => `${RENTCAST_BASE}${path}?${new URLSearchParams({ address, ...extra }).toString()}`;
  let calls = 0;
  let authFailed = false;
  const get = async (url: string): Promise<unknown> => {
    calls++;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 15_000);
    try {
      const res = await fetchImpl(url, { headers: { "X-Api-Key": apiKey, Accept: "application/json" }, signal: ctl.signal, cache: "no-store" });
      if (res.status === 401 || res.status === 403) authFailed = true;
      if (res.status === 429) throw new RentcastError(429, "RentCast rate limit reached. Try again in a minute.");
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      if (e instanceof RentcastError) throw e;
      return null;
    } finally {
      clearTimeout(t);
    }
  };
  const [property, value, rent, listing] = await Promise.all([
    get(q("/properties", { limit: "1" })),
    get(q("/avm/value", { compCount: "6" })),
    get(q("/avm/rent/long-term", { compCount: "6" })),
    get(q("/listings/sale", { limit: "1" })),
  ]);
  if (authFailed) throw new RentcastError(502, "RentCast rejected the API key. Check RENTCAST_API_KEY.");
  return { record: parseRecord(address, { property, value, rent, listing }), calls };
}
