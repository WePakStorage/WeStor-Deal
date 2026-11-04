import { describe, expect, it } from "vitest";
import { inboundToken, parseAlertHeuristic } from "@/lib/sourcing/alerts";
import { classifyOwner, parseCountyRow, scoreFacility } from "@/lib/sourcing/offmarket";

const SAMPLE_ALERT = `New listings match your saved search "TX self storage"

Hill Country Mini Storage
Kerrville, TX
$1,250,000 · 142 units · 18,400 SF · 8.1% cap
NOI: $101,250
https://www.crexi.com/properties/123456

Retail strip center
Austin, TX
$4,000,000

Gulf Breeze RV & Boat Storage
Corpus Christi, TX
$2.1M · 96 units
https://www.loopnet.com/Listing/abc`;

describe("alert parsing", () => {
  const r = parseAlertHeuristic(SAMPLE_ALERT);
  it("keeps only storage listings", () => expect(r.listings.map((l) => l.name)).toEqual(["Hill Country Mini Storage", "Gulf Breeze RV & Boat Storage"]));
  it("reads price, units, NOI and link", () => {
    const l = r.listings[0]!;
    expect(l).toMatchObject({ city: "Kerrville", state: "TX", price: 1_250_000, units: 142, nrsf: 18_400, noi: 101_250, cap_rate_pct: 8.1 });
    expect(l.url).toContain("crexi.com");
    expect(r.listings[1]?.price).toBe(2_100_000);
  });
  it("finds the org token", () => expect(inboundToken(["Deals <alerts+demo-wepak@inbound.westor.app>"])).toBe("demo-wepak"));
});

describe("off-market scoring", () => {
  it("classifies owners", () => {
    expect(classifyOwner("SMITH JOHN & MARY")).toBe("individual");
    expect(classifyOwner("Bexar Storage Partners LLC")).toBe("small_llc");
    expect(classifyOwner("PUBLIC STORAGE PROPERTIES XV INC")).toBe("institutional");
  });
  it("scores a motivated owner high", () => {
    const row = parseCountyRow({ "Prop ID": "123", "Owner Name": "GARZA ROBERT", "Situs City": "San Antonio", "Bldg SF": "24,000", "Year Built": "1978", "Deed Date": "2001-05-01", Delinquent: "Y", "Use Code": "F2 MINI WAREHOUSE" }, "TX", new Date("2026-11-01"))!;
    const s = scoreFacility(row);
    expect(s.score).toBe(100);
    expect(s.reasons).toContain("Tax delinquent");
  });
  it("scores a REIT low", () => {
    const row = parseCountyRow({ "Owner Name": "Extra Space Properties", "Bldg SF": "95000", "Year Built": "2015", "Deed Date": "2020-01-01" }, "TX", new Date("2026-11-01"))!;
    expect(scoreFacility(row).score).toBeLessThan(20);
  });
});
