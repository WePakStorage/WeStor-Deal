import { describe, expect, it, vi } from "vitest";
import { addressKey, CALLS_PER_LOOKUP, fetchRentcast, parseRecord, parseTypedAddress, resolveAddress, suggestFacts } from "@/lib/integrations/rentcast";
import { listing, property, rent, value } from "./fixtures/rentcast";

const addr = { street: "1234 Main St", city: "Memphis", state: "TN", zip: "38118" };

describe("addresses", () => {
  it("parses a typed address", () => {
    expect(parseTypedAddress("1234 Main St, Memphis, TN 38118")).toEqual(addr);
    expect(parseTypedAddress("1234 Main St, Memphis, tn")).toEqual({ ...addr, zip: null });
    expect(parseTypedAddress("Main St Memphis")).toBeNull();
  });
  it("normalizes cache keys", () => {
    expect(addressKey({ ...addr, street: "1234 Main Street" })).toBe(addressKey(addr));
  });
  it("takes the address from a Zillow link when none is typed", () => {
    expect(resolveAddress(null, "https://www.zillow.com/homedetails/1234-Main-St-Memphis-TN-38118/42_zpid/")).toEqual(addr);
    expect(resolveAddress(null, "https://www.crexi.com/properties/1/texas-storage")).toBeNull();
  });
});

describe("parseRecord", () => {
  const r = parseRecord("1234 Main St, Memphis, TN 38118", { property, value, rent, listing });
  it("maps the property record, latest tax year, and keeps owner names out", () => {
    expect(r.property).toMatchObject({ beds: 3, baths: 2, sqft: 1450, yearBuilt: 1972, taxAssessed: 104000, annualTax: 1984, ownerType: "Individual", ownerOccupied: false });
    expect(JSON.stringify(r)).not.toContain("Private Person");
  });
  it("maps value, rent, comps and the listing with its agent", () => {
    expect(r.value).toMatchObject({ estimate: 205000, low: 188000, high: 222000 });
    expect(r.value!.comps).toHaveLength(2);
    expect(r.rent!.estimate).toBe(1625);
    expect(r.listing).toMatchObject({ price: 129900, daysOnMarket: 96, office: "Main Street Realty" });
    expect(r.listing!.agent!.email).toBe("pat@brokerage.example");
    expect(r.missing).toEqual([]);
  });
  it("survives missing or malformed endpoints and says what's missing", () => {
    const x = parseRecord("a", { property: [], value: { price: "abc" }, rent: null, listing: [] });
    expect(x.property).toBeNull();
    expect(x.value).toBeNull();
    expect(x.listing).toBeNull();
    expect(x.missing).toEqual(["property record", "value estimate", "rent estimate"]);
  });
});

describe("suggestFacts", () => {
  const r = parseRecord("a", { property, value, rent, listing });
  it("fills asking from an active listing, rent for a single-family home, value as ARV with a caution", () => {
    const s = suggestFacts(r, "residential");
    expect(s).toMatchObject({ list: 129900, rentMonthly: 1625, arv: 205000, yearBuilt: 1972, nrsf: 1450, daysOnMarket: 96 });
    expect(s.notes.join(" ")).toMatch(/typical condition/);
  });
  it("doesn't use a per-unit rent as total rent for multifamily, and no asking without a listing", () => {
    const mf = parseRecord("a", { property: [{ ...property[0], propertyType: "Multi-Family", features: { unitCount: 4 } }], value, rent, listing: [] });
    const s = suggestFacts(mf, "multifamily");
    expect(s.rentMonthly).toBeNull();
    expect(s.arv).toBeNull();
    expect(s.list).toBeNull();
    expect(s.units).toBe(4);
    expect(s.notes.join(" ")).toMatch(/per unit/);
  });
});

describe("fetchRentcast", () => {
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  it("calls the four endpoints with the key header and parses them", async () => {
    const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)["X-Api-Key"]).toBe("k");
      const u = String(url);
      expect(u).toContain("address=1234+Main+St%2C+Memphis%2C+TN+38118");
      return ok(u.includes("/properties") ? property : u.includes("/avm/value") ? value : u.includes("/avm/rent") ? rent : listing);
    });
    const { record, calls } = await fetchRentcast(addr, "k", f as unknown as typeof fetch);
    expect(calls).toBe(CALLS_PER_LOOKUP);
    expect(f).toHaveBeenCalledTimes(4);
    expect(record.listing?.price).toBe(129900);
  });
  it("one failing endpoint isn't fatal", async () => {
    const f = vi.fn(async (url: string | URL | Request) => (String(url).includes("/listings") ? new Response("boom", { status: 500 }) : ok(String(url).includes("/properties") ? property : value)));
    const { record } = await fetchRentcast(addr, "k", f as unknown as typeof fetch);
    expect(record.listing).toBeNull();
    expect(record.property?.beds).toBe(3);
  });
  it("a rejected key is a clear error", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 401 }));
    await expect(fetchRentcast(addr, "bad", f as unknown as typeof fetch)).rejects.toThrow(/rejected the API key/);
  });
});
