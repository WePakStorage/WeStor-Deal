import { describe, expect, it } from "vitest";
import { canGenerateOm, planStageMove } from "@/lib/pipeline";

const negotiating = { stage: "negotiating" as const, contract_signed_at: null, contract_price: null };

describe("planStageMove", () => {
  it("allows ordinary moves", () => {
    expect(planStageMove(negotiating, "dead")).toEqual({ ok: true, patch: { stage: "dead" } });
  });
  it("blocks Under contract without contract details", () => {
    const r = planStageMove(negotiating, "under_contract");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.needsContract).toBe(true);
  });
  it("blocks incomplete contract details", () => {
    expect(planStageMove(negotiating, "under_contract", { contract_signed_at: "", contract_price: 715000, assignable: true }).ok).toBe(false);
    expect(planStageMove(negotiating, "under_contract", { contract_signed_at: "2026-11-01", contract_price: 0, assignable: true }).ok).toBe(false);
  });
  it("accepts a full contract", () => {
    const r = planStageMove(negotiating, "under_contract", { contract_signed_at: "2026-11-01", contract_price: "715000", assignable: true });
    expect(r).toEqual({ ok: true, patch: { stage: "under_contract", contract_signed_at: "2026-11-01", contract_price: 715000, assignable: true } });
  });
  it("Under contract → Assigned keeps the recorded contract", () => {
    expect(planStageMove({ stage: "under_contract", contract_signed_at: "2026-11-01", contract_price: 715000 }, "assigned").ok).toBe(true);
  });
});

describe("canGenerateOm", () => {
  it("locks San Antonio in Negotiating", () => expect(canGenerateOm(negotiating).ok).toBe(false));
  it("locks Under contract without a date", () => expect(canGenerateOm({ stage: "under_contract", contract_signed_at: null }).ok).toBe(false));
  it("unlocks with a recorded contract", () => expect(canGenerateOm({ stage: "under_contract", contract_signed_at: "2026-11-01" }).ok).toBe(true));
});
