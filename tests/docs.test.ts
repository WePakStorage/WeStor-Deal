import { describe, expect, it } from "vitest";
import { buildOmModel, buildPreviewModel } from "@/lib/docs/models";
import { seedDeals, seedFinancials, seedUnitMix, SEED_IDS } from "@/lib/seed";
import { DEFAULT_ASSUMPTIONS, type DealBundle, type Org } from "@/lib/types";

const org: Org = {
  id: "o", name: "WePak Storage", brand_name: "WePak Storage", brand_tagline: "", contact_name: "Wine", contact_phone: "555", contact_email: "a@b.c",
  disclosure_entity: "WePak WeShip LLC", logo_url: null, inbound_token: "x", defaults: DEFAULT_ASSUMPTIONS,
};
const deal = seedDeals("o").find((d) => d.id === SEED_IDS.sanAntonio)!;
const bundle: DealBundle = {
  deal, unitMix: seedUnitMix(), financials: seedFinancials().filter((f) => f.deal_id === deal.id),
  flags: [], documents: [], tasks: [], activity: [], narrative: null,
};

describe("pre-contract preview", () => {
  const json = JSON.stringify(buildPreviewModel(bundle, org));
  it("never shows the property name", () => expect(json).not.toContain("West San Antonio Storage"));
  it("never shows the address", () => {
    expect(json).not.toContain("4810");
    expect(json).not.toContain("Sample Rd");
  });
  it("never shows the exact unit count or seller NOI", () => {
    expect(json).not.toMatch(/\b87 units\b/);
    expect(json).not.toContain("65,113");
    expect(json).not.toContain("101,168");
  });
  it("uses rounded ranges", () => expect(json).toContain("75–100 units"));
  it("says no contract and no interest", () => {
    expect(json).toContain("No contract is signed");
    expect(json).toContain("does not own, control, or hold any interest");
  });
});

describe("full OM", () => {
  const om = buildOmModel({ ...bundle, deal: { ...deal, stage: "under_contract", contract_signed_at: "2026-11-01", contract_price: 715_000, assignable: true } }, org, DEFAULT_ASSUMPTIONS);
  const json = JSON.stringify(om);
  it("never shows the address", () => expect(json).not.toContain("Sample Rd"));
  it("names the disclosure entity", () => expect(om.disclosure).toContain("WePak WeShip LLC holds an equitable interest"));
  it("prices at contract + assignment fee", () => expect(om.summary[0]?.value).toBe("$740,000"));
});
