/**
 * UndrIq deal engine. Every number a customer sees is computed here, never by the model.
 * The AI only reads listings (facts in) and writes the memo (words out).
 * Debt service comes from lib/underwriting.ts so there is one amortization formula.
 */
import { annualDebtService } from "../underwriting";
import { ASSETS, type AssetClass } from "./assets";

// ───────────────────────── Buy box rules
export interface BuyBoxRules {
  arvPct: number;
  feeResi: number;
  feeComm: number;
  caps: Record<AssetClass, number>;
  down: number;
  rate: number;
  years: number;
  targetDscr: number;
  sellPct: number;
  holdMonths: number;
  flipMargin: number;
  refiLtv: number;
  sfDown: number;
  sfRate: number;
}

export const DEFAULT_RULES: BuyBoxRules = {
  arvPct: 0.7,
  feeResi: 10_000,
  feeComm: 25_000,
  caps: { residential: 0.07, multifamily: 0.065, storage: 0.085, industrial: 0.075, commercial: 0.08 },
  down: 0.3,
  rate: 0.075,
  years: 25,
  targetDscr: 1.25,
  sellPct: 0.08,
  holdMonths: 6,
  flipMargin: 0.15,
  refiLtv: 0.75,
  sfDown: 0.1,
  sfRate: 0.06,
};

const clamp = (v: unknown, lo: number, hi: number, dflt: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;

/** Merge stored rules over defaults with sane bounds, so a bad row can't break scoring. */
export function normalizeRules(raw: unknown): BuyBoxRules {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof BuyBoxRules, unknown>>;
  const caps = (r.caps && typeof r.caps === "object" ? r.caps : {}) as Partial<Record<AssetClass, unknown>>;
  const d = DEFAULT_RULES;
  return {
    arvPct: clamp(r.arvPct, 0.3, 1, d.arvPct),
    feeResi: clamp(r.feeResi, 0, 1e7, d.feeResi),
    feeComm: clamp(r.feeComm, 0, 1e7, d.feeComm),
    caps: {
      residential: clamp(caps.residential, 0.01, 0.25, d.caps.residential),
      multifamily: clamp(caps.multifamily, 0.01, 0.25, d.caps.multifamily),
      storage: clamp(caps.storage, 0.01, 0.25, d.caps.storage),
      industrial: clamp(caps.industrial, 0.01, 0.25, d.caps.industrial),
      commercial: clamp(caps.commercial, 0.01, 0.25, d.caps.commercial),
    },
    down: clamp(r.down, 0, 1, d.down),
    rate: clamp(r.rate, 0, 0.3, d.rate),
    years: clamp(r.years, 1, 40, d.years),
    targetDscr: clamp(r.targetDscr, 0.8, 3, d.targetDscr),
    sellPct: clamp(r.sellPct, 0, 0.2, d.sellPct),
    holdMonths: clamp(r.holdMonths, 1, 36, d.holdMonths),
    flipMargin: clamp(r.flipMargin, 0, 0.5, d.flipMargin),
    refiLtv: clamp(r.refiLtv, 0.3, 0.9, d.refiLtv),
    sfDown: clamp(r.sfDown, 0, 0.5, d.sfDown),
    sfRate: clamp(r.sfRate, 0, 0.2, d.sfRate),
  };
}

export const feeFor = (asset: AssetClass, R: BuyBoxRules) => (asset === "residential" ? R.feeResi : R.feeComm);
export const capFor = (asset: AssetClass, R: BuyBoxRules) => R.caps[asset] ?? ASSETS[asset].cap;

// ───────────────────────── Facts (what the AI reads or the user types)
export interface DealFacts {
  name: string;
  asset: AssetClass;
  type: string;
  city: string | null;
  state: string | null;
  list: number | null;
  noi: number | null;
  rentMonthly: number | null;
  gross: number | null;
  expenses: number | null;
  statedCap: number | null;
  arv: number | null;
  rehab: number | null;
  nrsf: number | null;
  units: number | null;
  yearBuilt: number | null;
  occupancy: number | null;
  appraised: number | null;
  daysOnMarket: number | null;
  leaseNote: string | null;
  /** Data-quality notes from the sanity checks (shown as red-flag info lines). */
  checks?: string[];
}

export const emptyFacts = (asset: AssetClass, type: string, name = "Untitled deal"): DealFacts => ({
  name, asset, type, city: null, state: null, list: null, noi: null, rentMonthly: null, gross: null, expenses: null, statedCap: null,
  arv: null, rehab: null, nrsf: null, units: null, yearBuilt: null, occupancy: null, appraised: null, daysOnMarket: null, leaseNote: null,
});

// ───────────────────────── Formatting used inside engine strings
export const fmtUsd = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const fmtK = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "—" : Math.abs(n) >= 1e6 ? `$${+(n / 1e6).toFixed(2)}M` : `$${Math.round(n / 1e3)}K`;
export const fmtPct = (n: number | null | undefined, d = 2) => (n == null || !Number.isFinite(n) ? "—" : `${(n * 100).toFixed(d)}%`);

const r1k = (v: number) => Math.round(v / 1000) * 1000;

// ───────────────────────── Core math
const ads = (loan: number, rate: number, years: number) => (loan <= 0 ? 0 : annualDebtService(loan, rate, years));

export type Band = "go" | "amber" | "stop";
export const dscrBandOf = (d: number): Band => {
  const x = Math.round(d * 100) / 100;
  return x >= 1.25 ? "go" : x >= 1.1 ? "amber" : "stop";
};
export const scoreBand = (s: number): Band => (s >= 75 ? "go" : s >= 42 ? "amber" : "stop");

export interface Underwriting {
  equity: number;
  loan: number;
  ds: number;
  dscr: number;
  band: Band;
  cap: number;
  cf: number;
  coc: number;
}

export function underwriteAt(price: number, noi: number, R: BuyBoxRules, rate = R.rate): Underwriting {
  const equity = price * R.down;
  const loan = Math.max(0, price - equity);
  const ds = ads(loan, rate, R.years);
  const dscr = ds > 0 ? noi / ds : Infinity;
  const cf = noi - ds;
  return { equity, loan, ds, dscr, band: dscrBandOf(dscr), cap: price > 0 ? noi / price : 0, cf, coc: equity > 0 ? cf / equity : 0 };
}

/** Highest price a buyer pays: lower of the price at the target cap and the price at the target DSCR. */
export function buyerMax(noi: number, tCap: number, R: BuyBoxRules) {
  const atCap = tCap > 0 ? noi / tCap : Infinity;
  const perDollar = ads(1, R.rate, R.years);
  const atDscr = R.down >= 1 || perDollar === 0 ? Infinity : noi / (R.targetDscr * perDollar) / (1 - R.down);
  return { atCap, atDscr, buyer: Math.min(atCap, atDscr), binding: atDscr <= atCap ? ("dscr" as const) : ("cap" as const) };
}

const EXP_RATIO: Record<AssetClass, number> = { residential: 0.4, multifamily: 0.45, storage: 0.35, industrial: 0.15, commercial: 0.3 };

export interface Income {
  gross: number | null;
  noi: number | null;
  expenses: number | null;
  estimated: boolean;
}

/** NOI from what we have: stated NOI, else gross minus expenses, else gross times the asset's typical margin. */
export function income(f: DealFacts): Income {
  const er = EXP_RATIO[f.asset] ?? 0.35;
  const gross0 = f.rentMonthly ? f.rentMonthly * 12 : f.gross ?? null;
  let noi = f.noi ?? null;
  let estimated = false;
  if (noi == null && gross0) {
    noi = f.expenses != null ? gross0 - f.expenses : gross0 * (1 - er);
    estimated = f.expenses == null;
  }
  const gross = gross0 ?? (noi != null ? noi / (1 - er) : null);
  return { gross, noi, expenses: gross != null && noi != null ? gross - noi : null, estimated };
}

// ───────────────────────── Exit Strategy Matrix
export type ExitKey = "wholesale" | "flip" | "hold" | "brrrr" | "seller";
export interface Exit {
  key: ExitKey;
  name: string;
  score: number;
  metric: string;
  sub: string;
  maxPrice: number | null;
  note: string;
}

export function exitMatrix(f: DealFacts, R: BuyBoxRules): Exit[] {
  const { noi } = income(f);
  const price = f.list;
  const arv = f.arv;
  const rehab = f.rehab ?? 0;
  const fee = feeFor(f.asset, R);
  const cap = capFor(f.asset, R);
  const out: Exit[] = [];
  const loanNote = `${Math.round(R.down * 100)}% down, ${(R.rate * 100).toFixed(2).replace(/\.?0+$/, "")}%, ${R.years}-year amortization`;

  // Wholesale assignment
  let mao: number | null = null;
  let basis = "";
  if (arv && f.asset === "residential") {
    mao = arv * R.arvPct - rehab - fee;
    basis = `${Math.round(R.arvPct * 100)}% of ARV, minus repairs and your fee`;
  } else if (noi) {
    const m = buyerMax(noi, cap, R);
    mao = Number.isFinite(m.buyer) ? Math.max(0, m.buyer - fee) : 0;
    basis = `Your buyer gets a ${fmtPct(cap, 1)} cap and ${R.targetDscr.toFixed(2)}x DSCR after your fee`;
  }
  if (mao != null) {
    const gap = price ? (price - mao) / price : 0;
    out.push({
      key: "wholesale",
      name: "Wholesale assignment",
      score: mao <= 0 ? 5 : gap <= 0 ? 94 : gap <= 0.1 ? 76 : gap <= 0.2 ? 52 : gap <= 0.3 ? 30 : 12,
      metric: mao > 0 ? `${fmtK(fee)} fee` : "No spread",
      sub: mao > 0 ? `Contract at or under ${fmtK(mao)}` : "Numbers don't support a fee",
      maxPrice: mao > 0 ? mao : null,
      note: mao > 0 && price ? (gap <= 0 ? "Asking is already under your max." : `Needs ${fmtPct(gap, 0)} off asking.`) : basis,
    });
  }

  // Fix and flip / value-add
  if (arv && price) {
    const carry = 0.01 * R.holdMonths;
    const sell = arv * R.sellPct;
    const hold = (price + rehab) * carry;
    const profit = arv - price - rehab - sell - hold;
    const cash = price * 0.2 + rehab;
    const roi = cash > 0 ? profit / cash : 0;
    const maxP = (arv * (1 - R.flipMargin) - rehab - sell - rehab * carry) / (1 + carry);
    out.push({
      key: "flip",
      name: f.asset === "residential" ? "Fix and flip" : "Value-add and sell",
      score: roi >= 0.4 ? 90 : roi >= 0.25 ? 74 : roi >= 0.15 ? 55 : roi >= 0 ? 28 : 6,
      metric: `${fmtUsd(profit)} profit`,
      sub: `${fmtPct(roi, 0)} on ${fmtK(cash)} cash · ${R.holdMonths}-month hold`,
      maxPrice: maxP > 0 ? maxP : null,
      note: `${fmtPct(R.sellPct, 0)} to sell, ${R.holdMonths} months of carry, 20% down plus repairs`,
    });
  }

  // Buy and hold
  if (noi && price) {
    const u = underwriteAt(price, noi, R);
    const bm = buyerMax(noi, cap, R).buyer;
    out.push({
      key: "hold",
      name: "Buy and hold",
      score: u.dscr >= R.targetDscr + 0.1 && u.coc >= 0.08 ? 86 : u.dscr >= R.targetDscr ? 66 : u.dscr >= 1.1 ? 40 : 14,
      metric: `${fmtUsd(u.cf / 12)}/mo`,
      sub: `${fmtPct(u.coc, 1)} cash-on-cash · ${Number.isFinite(u.dscr) ? u.dscr.toFixed(2) : "—"}x DSCR`,
      maxPrice: Number.isFinite(bm) ? bm : null,
      note: loanNote,
    });
  }

  // BRRRR
  if (arv && noi && price && (f.asset === "residential" || f.asset === "multifamily")) {
    const refi = arv * R.refiLtv;
    const allIn = price + rehab + price * 0.03;
    const left = allIn - refi;
    const cf = noi - ads(refi, R.rate, 30);
    out.push({
      key: "brrrr",
      name: "BRRRR",
      score: left <= 0 && cf > 0 ? 92 : left <= allIn * 0.15 && cf > 0 ? 74 : cf > 0 ? 48 : 12,
      metric: left <= 0 ? `${fmtK(-left)} cash out` : `${fmtK(left)} left in`,
      sub: `${fmtUsd(cf / 12)}/mo after a ${Math.round(R.refiLtv * 100)}% refi`,
      maxPrice: refi - rehab - price * 0.03 > 0 ? refi - rehab : null,
      note: `Refinance at ${Math.round(R.refiLtv * 100)}% of ARV, 30 years`,
    });
  }

  // Seller finance
  if (noi && price) {
    const down = price * R.sfDown;
    const cf = noi - ads(price * (1 - R.sfDown), R.sfRate, 30);
    const coc = down > 0 ? cf / down : 0;
    out.push({
      key: "seller",
      name: "Seller finance",
      score: coc >= 0.2 ? 86 : coc >= 0.1 ? 64 : cf > 0 ? 38 : 8,
      metric: `${fmtPct(coc, 0)} cash-on-cash`,
      sub: `${Math.round(R.sfDown * 100)}% down · ${(R.sfRate * 100).toFixed(1)}% · 30 yr · ${fmtUsd(cf / 12)}/mo`,
      maxPrice: price,
      note: "Ask the seller to carry: less cash in, faster close",
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

// ───────────────────────── Offer Ladder, Stress Test, Red flags
export interface Rung {
  rung: "Anchor" | "Target" | "Walk-away";
  price: number;
  why: string;
}

export function offerLadder(f: DealFacts, best: Exit | null): Rung[] | null {
  const list = f.list ?? 0;
  const base = best?.maxPrice || (list ? list * 0.85 : 0);
  if (!base) return null;
  const walk = Math.min(base, list || base);
  const target = walk * 0.96;
  const anchor = Math.min(walk * 0.88, (list || walk) * 0.82);
  return [
    { rung: "Anchor", price: r1k(anchor), why: "Open here. Lead with the red flags, repairs and days on market." },
    { rung: "Target", price: r1k(target), why: "Where you expect to land after one counter." },
    { rung: "Walk-away", price: r1k(walk), why: `Your ceiling for ${best ? best.name.toLowerCase() : "this exit"}. Above this the deal stops working.` },
  ];
}

export interface StressRow {
  label: string;
  dscr: number;
  cf: number;
  ok: boolean;
}

export function stressTest(f: DealFacts, price: number | null, R: BuyBoxRules): { rows: StressRow[]; breakEven: number } | null {
  const { noi, gross, expenses } = income(f);
  if (!noi || !price || !gross || expenses == null) return null;
  const row = (label: string, n: number, rate: number): StressRow => {
    const u = underwriteAt(price, n, R, rate);
    return { label, dscr: u.dscr, cf: u.cf, ok: u.dscr >= 1 };
  };
  const r0 = R.rate;
  const r1 = R.rate + 0.01;
  const rows = [
    row("Today", noi, r0),
    row("Rates up 1 point", noi, r1),
    row("Rents down 10%", noi - gross * 0.1, r0),
    row("Expenses up 15%", noi - expenses * 0.15, r0),
    row("All three at once", noi - gross * 0.1 - expenses * 0.15, r1),
  ];
  const ds = underwriteAt(price, noi, R).ds;
  return { rows, breakEven: (expenses + ds) / gross };
}

export type Flag = ["warn" | "info", string];

export function redFlags(f: DealFacts): Flag[] {
  const out: Flag[] = [];
  const { noi, estimated } = income(f);
  if (f.list && f.appraised && f.list > f.appraised) out.push(["warn", `Asking ${fmtK(f.list)} is above the ${fmtK(f.appraised)} appraisal.`]);
  if (f.arv && f.list && f.list > f.arv * 0.9) out.push(["warn", `Asking is ${fmtPct(f.list / f.arv, 0)} of ARV. Little room for repairs and profit.`]);
  if (f.arv && f.rehab && f.rehab > f.arv * 0.3) out.push(["warn", `Repairs are ${fmtPct(f.rehab / f.arv, 0)} of ARV. Get a contractor bid before you commit.`]);
  if (f.occupancy != null && f.occupancy < 0.8) out.push(["warn", `Occupancy is ${fmtPct(f.occupancy, 0)}. Lenders will haircut income until it stabilizes.`]);
  if (f.statedCap && f.list && noi && Math.abs(noi / f.list - f.statedCap) > 0.002)
    out.push(["warn", `Stated ${fmtPct(f.statedCap)} cap doesn't match NOI ÷ price (${fmtPct(noi / f.list)}).`]);
  if (f.yearBuilt && f.yearBuilt < 1980) out.push(["info", `Built ${f.yearBuilt}. Budget for roof, plumbing, electrical and deferred maintenance.`]);
  if (f.daysOnMarket && f.daysOnMarket > 90) out.push(["info", `${f.daysOnMarket} days on market. The seller may take less.`]);
  if (estimated) out.push(["info", "Income or expenses are estimated. Get the rent roll and T-12 before you lock a price."]);
  if (f.leaseNote && /month|mtm|vacant|expir/i.test(f.leaseNote)) out.push(["warn", `Lease risk: ${f.leaseNote}.`]);
  for (const c of f.checks ?? []) out.push(["info", c]);
  return out;
}

// ───────────────────────── Full analysis
export interface Verdict {
  band: Band;
  text: string;
}
export const verdictOf = (s: number): Verdict =>
  s >= 80
    ? { band: "go", text: "Strong deal. Move fast." }
    : s >= 60
      ? { band: "amber", text: "Worth pursuing at the right price." }
      : s >= 42
        ? { band: "amber", text: "Thin. Only works with a hard negotiation." }
        : { band: "stop", text: "Pass, or go much lower." };

export interface Analysis {
  noi: number | null;
  gross: number | null;
  estimated: boolean;
  exits: Exit[];
  best: Exit | null;
  ladder: Rung[] | null;
  stress: { rows: StressRow[]; breakEven: number } | null;
  flags: Flag[];
  score: number;
  verdict: Verdict;
  atAsking: Underwriting | null;
}

export function analyze(f: DealFacts, R: BuyBoxRules = DEFAULT_RULES): Analysis {
  const { noi, gross, estimated } = income(f);
  const exits = exitMatrix(f, R);
  const best = exits[0] ?? null;
  const ladder = offerLadder(f, best);
  const stress = stressTest(f, ladder ? ladder[1]!.price : f.list, R);
  const flags = redFlags(f);
  const combined = stress?.rows[4];
  const resil = !combined ? 50 : combined.dscr >= 1.2 ? 100 : combined.dscr >= 1 ? 72 : combined.dscr >= 0.9 ? 42 : 15;
  const warns = flags.filter((x) => x[0] === "warn").length;
  const score = Math.max(4, Math.min(97, Math.round((best?.score ?? 30) * 0.7 + resil * 0.3 - warns * 3)));
  const atAsking = noi && f.list ? underwriteAt(f.list, noi, R) : null;
  return { noi, gross, estimated, exits, best, ladder, stress, flags, score, verdict: verdictOf(score), atAsking };
}

/** What a Scout (free) account receives. The server strips the rest; the UI lock is cosmetic. */
export function teaser(a: Analysis) {
  return { score: a.score, verdict: a.verdict, best: a.best ? { name: a.best.name, metric: a.best.metric, sub: a.best.sub } : null, flagsCount: a.flags.length, noi: a.noi };
}
export type Teaser = ReturnType<typeof teaser>;
