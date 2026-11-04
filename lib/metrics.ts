import type { DealSummary } from "./types";
import { capRate } from "./underwriting";

/** Dashboard totals strip. */
export function pipelineTotals(deals: DealSummary[]) {
  const active = deals.filter((d) => d.stage !== "dead" && d.stage !== "closed");
  const targetValue = active.reduce((s, d) => s + (d.target_price ?? d.list_price ?? 0), 0);
  const contracted = deals.filter((d) => d.stage === "under_contract" || d.stage === "assigned");
  const caps = active
    .map((d) => (d.noi.t12 && d.target_price ? capRate(d.noi.t12, d.target_price) : null))
    .filter((c): c is number => c !== null);
  return {
    activeCount: active.length,
    targetValue,
    contractedCount: contracted.length,
    contractedValue: contracted.reduce((s, d) => s + (d.contract_price ?? d.target_price ?? 0), 0),
    avgT12Cap: caps.length ? caps.reduce((a, b) => a + b, 0) / caps.length : null,
    capSample: caps.length,
  };
}
