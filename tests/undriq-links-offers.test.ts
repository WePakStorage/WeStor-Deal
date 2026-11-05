import { describe, expect, it } from "vitest";
import { parseListingUrl } from "@/lib/undriq/linkparse";
import { offerDefaults, offerDocs } from "@/lib/undriq/offers";
import { analyze, emptyFacts } from "@/lib/undriq/engine";

describe("parseListingUrl", () => {
  it("reads a Zillow homedetails slug", () => {
    const p = parseListingUrl("https://www.zillow.com/homedetails/1234-Main-St-Memphis-TN-38118/42000000_zpid/")!;
    expect(p.site).toBe("Zillow");
    expect(p.street).toBe("1234 Main St");
    expect(p.city).toBe("Memphis");
    expect(p.state).toBe("TN");
    expect(p.zip).toBe("38118");
    expect(p.asset).toBe("residential");
  });
  it("reads a Redfin path", () => {
    const p = parseListingUrl("https://www.redfin.com/TX/Houston/55-Elm-Ave-77002/home/123")!;
    expect(p.state).toBe("TX");
    expect(p.city).toBe("Houston");
    expect(p.street).toBe("55 Elm Ave");
  });
  it("reads a Crexi slug with a multi-word state and guesses storage", () => {
    const p = parseListingUrl("https://www.crexi.com/properties/123456/north-carolina-greenville-self-storage")!;
    expect(p.state).toBe("NC");
    expect(p.asset).toBe("storage");
    expect(p.name).toContain("Greenville");
  });
  it("rejects non-http and garbage", () => {
    expect(parseListingUrl("javascript:alert(1)")).toBeNull();
    expect(parseListingUrl("not a url")).toBeNull();
  });
});

describe("offers", () => {
  const f = { ...emptyFacts("residential", "sfr", "12 Oak St"), city: "Memphis", state: "TN", list: 120_000, arv: 210_000, rehab: 35_000, rentMonthly: 1_650 };
  const a = analyze(f);
  it("defaults to the anchor price and a 1% earnest deposit floor", () => {
    const t = offerDefaults(f, a);
    expect(t.price).toBe(a.ladder![0]!.price);
    expect(t.emd).toBeGreaterThanOrEqual(1000);
    expect(t.property).toBe("12 Oak St, Memphis, TN");
  });
  it("doesn't repeat the city when the name already has it", () => {
    const t = offerDefaults({ ...f, name: "12 Oak St, Memphis" }, a);
    expect(t.property).toBe("12 Oak St, Memphis, TN");
  });
  it("writes a numbered LOI with the price and an assignment clause when assignable", () => {
    const t = { ...offerDefaults(f, a), type: "assign" as const, price: 95_000, buyer: "Jordan Smith" };
    const d = offerDocs(t, f, a.noi, new Date("2026-11-05T12:00:00Z"));
    expect(d.letter).toContain("$95,000");
    expect(d.letter).toContain("and/or assigns");
    expect(d.letter).toMatch(/Assignment: Buyer may assign/);
    expect(d.email).toContain("Subject: Offer on 12 Oak St, Memphis, TN: $95,000");
    expect(d.text).toContain("Jordan");
  });
  it("seller finance terms show the note and payment", () => {
    const t = { ...offerDefaults(f, a), type: "seller" as const, price: 100_000, down: 0.1, rate: 0.06, years: 30 };
    const d = offerDocs(t, f, a.noi);
    expect(d.letter).toContain("note of $90,000");
    expect(d.letter).toContain("about $540 per month");
  });
});
