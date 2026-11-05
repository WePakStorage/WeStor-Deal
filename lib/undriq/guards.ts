/**
 * Guards that keep the agent's output reasonable:
 * 1. sanityCheck: catches misread numbers (annual rent read as monthly, NOI bigger than a third of the
 *    price, ARV far from the price...) before they reach the engine. Every change is explained to the user.
 * 2. groundMemo: the memo may only quote dollar figures the engine actually computed or the listing stated.
 *    Sentences with made-up figures are dropped; an ungrounded headline is replaced by the computed one.
 */
import type { DealFacts } from "./engine";
import type { Memo } from "./types";

/** `trusted` fields (typed by the user) are never changed, but still used to check the others. */
export function sanityCheck(input: DealFacts, trusted: ReadonlySet<keyof DealFacts> = new Set()): { facts: DealFacts; checks: string[] } {
  const f = { ...input };
  const checks: string[] = [];
  const drop = <K extends keyof DealFacts>(k: K, why: string) => {
    if (trusted.has(k)) return;
    (f[k] as unknown) = null;
    checks.push(why);
  };

  if (f.list != null && (f.list < 1_000 || f.list > 2e9)) drop("list", "Ignored an asking price that didn't look real. Check the price.");
  if (f.rentMonthly != null) {
    if (f.rentMonthly < 50) drop("rentMonthly", "Ignored a rent under $50 a month. Enter the monthly rent.");
    else if (f.list && f.rentMonthly > f.list * 0.05) {
      // Monthly rent above 5% of the price is almost always an annual figure read as monthly.
      const monthly = f.rentMonthly / 12;
      if (trusted.has("rentMonthly")) {
        // typed by the user: leave it alone
      } else if (monthly <= f.list * 0.05) {
        f.rentMonthly = Math.round(monthly);
        checks.push(`Rent looked annual, so we used ${monthly.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} a month. Check it.`);
      } else drop("rentMonthly", "Ignored a rent that was too high for the price. Enter the monthly rent.");
    }
  }
  if (f.gross != null && f.list && f.gross > f.list * 0.6) drop("gross", "Ignored a gross income above 60% of the price. Check the income.");
  if (f.noi != null && f.list && f.noi > f.list * 0.3) drop("noi", "Ignored an NOI above 30% of the price (a 30%+ cap rate). Check the NOI.");
  if (f.expenses != null && f.gross != null && f.expenses > f.gross) drop("expenses", "Ignored expenses larger than gross income.");
  if (f.arv != null && f.list && (f.arv < f.list * 0.5 || f.arv > f.list * 6)) drop("arv", "Ignored an after-repair value far from the asking price. Check the ARV.");
  if (f.rehab != null && ((f.arv && f.rehab > f.arv) || (f.list && f.rehab > f.list * 3))) drop("rehab", "Ignored a repair estimate larger than the property's value.");
  if (f.occupancy != null && (f.occupancy < 0 || f.occupancy > 1)) drop("occupancy", "Ignored an occupancy outside 0–100%.");
  if (f.statedCap != null && (f.statedCap <= 0 || f.statedCap > 0.25)) drop("statedCap", "Ignored a stated cap rate outside 0–25%.");
  if (f.units != null && (f.units < 1 || f.units > 5_000)) drop("units", "Ignored an implausible unit count.");
  if (f.daysOnMarket != null && (f.daysOnMarket < 0 || f.daysOnMarket > 3_650)) drop("daysOnMarket", "Ignored an implausible days-on-market.");
  if (f.appraised != null && f.list && (f.appraised < f.list * 0.3 || f.appraised > f.list * 5)) drop("appraised", "Ignored an appraisal far from the asking price.");
  return { facts: { ...f, checks: [...(input.checks ?? []), ...checks] }, checks };
}

/** "$113K", "$1.2M", "$98,000" → dollars. */
export function dollarsIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\$\s?(\d[\d,]*(?:\.\d+)?)\s?(k|m|mm|million|thousand)?\b/gi)) {
    const unit = (m[2] ?? "").toLowerCase();
    const n = Number(m[1]!.replace(/,/g, "")) * (unit === "k" || unit === "thousand" ? 1e3 : unit ? 1e6 : 1);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/** Every number in the data the memo was given, at any depth. */
export function numbersIn(data: unknown, out: number[] = []): number[] {
  if (typeof data === "number" && Number.isFinite(data)) out.push(data, data / 12, data * 12);
  else if (typeof data === "string") out.push(...dollarsIn(data));
  else if (Array.isArray(data)) data.forEach((d) => numbersIn(d, out));
  else if (data && typeof data === "object") Object.values(data).forEach((d) => numbersIn(d, out));
  return out;
}

const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1_000, Math.abs(b) * 0.03);

export function isGrounded(text: string, allowed: number[]): boolean {
  return dollarsIn(text).every((d) => d < 100 || allowed.some((a) => close(d, a)));
}

export function groundMemo(memo: Memo, data: unknown, fallback: Memo): { memo: Memo; dropped: number } {
  const allowed = numbersIn(data);
  let dropped = 0;
  const keep = (xs: string[]) =>
    xs.filter((x) => {
      const ok = isGrounded(x, allowed);
      if (!ok) dropped++;
      return ok;
    });
  const headlineOk = isGrounded(memo.headline, allowed);
  const scriptOk = isGrounded(memo.offerScript, allowed);
  if (!headlineOk) dropped++;
  if (!scriptOk) dropped++;
  return {
    memo: {
      headline: headlineOk ? memo.headline : fallback.headline,
      thesis: keep(memo.thesis),
      risks: keep(memo.risks),
      nextSteps: keep(memo.nextSteps),
      killers: keep(memo.killers),
      mustBeTrue: keep(memo.mustBeTrue),
      offerScript: scriptOk ? memo.offerScript : "",
    },
    dropped,
  };
}
