import "server-only";
import { z } from "zod";
import { quotaWindowStart } from "../billing/plans";
import { isAnthropicConfigured } from "../env";
import { explainAiError, jsonFromClaude, pdfBlock } from "../ai/claude";
import { HttpError } from "../server/run";
import type { Ctx } from "../server/context";
import { ASSET_CLASSES, assetOf, PROPERTY_TYPE_LABELS, type AssetClass } from "./assets";
import { analyze, DEFAULT_RULES, fmtPct, normalizeRules, teaser, type Analysis, type BuyBoxRules, type DealFacts } from "./engine";
import { EXTRACT_SYSTEM, extractedSchema, extractPrompt, factsFrom, heuristicExtract, MEMO_SYSTEM, memoPrompt, memoSchema, mergeExtracted, toNumber, type Extracted } from "./extract";
import { parseListingUrl } from "./linkparse";
import { groundMemo, sanityCheck } from "./guards";
import { cachedRecord } from "../integrations/lookup-service";
import { resolveAddress, suggestFacts, type PropertyRecord } from "../integrations/rentcast";
import type { AnalysisRow, Memo, Motivation, StoredResult } from "./types";

const optNum = z.preprocess(toNumber, z.number().nonnegative().nullable()).optional();

export const analyzeInput = z.object({
  asset: z.enum(ASSET_CLASSES),
  type: z.string().max(40).optional(),
  link: z.string().max(2000).optional(),
  text: z.string().max(60_000).optional(),
  name: z.string().max(140).optional(),
  /** Street address for the property-data lookup ("1234 Main St, Memphis, TN 38118"). */
  address: z.string().max(200).optional(),
  city: z.string().max(80).optional(),
  state: z.string().max(2).optional(),
  // Quick numbers typed by the user always win over anything read from the listing.
  list: optNum,
  rentMonthly: optNum,
  noi: optNum,
  arv: optNum,
  rehab: optNum,
});
export type AnalyzeInput = z.infer<typeof analyzeInput>;

export async function rulesFor(ctx: Ctx): Promise<BuyBoxRules> {
  return ctx.plan.features.buyBoxRules ? normalizeRules(await ctx.uq.getBuyBox(ctx.orgId)) : DEFAULT_RULES;
}

export async function quotaFor(ctx: Ctx) {
  const used = await ctx.uq.countUsage(ctx.orgId, "analysis", quotaWindowStart(ctx.plan));
  return { used, total: ctx.plan.analyses, left: Math.max(0, ctx.plan.analyses - used), period: ctx.plan.analysesPeriod };
}

/** What the browser may see for this row on this plan. Scout never receives the full engine output. */
export function viewFor(ctx: Ctx, row: AnalysisRow, rules: BuyBoxRules): { full: Analysis | null; teaser: ReturnType<typeof teaser>; sample: boolean } {
  if (ctx.plan.features.fullAnalysis) {
    // Recompute from facts so the page always reflects the space's current buy box rules.
    const a = analyze(row.facts, rules);
    return { full: a, teaser: teaser(a), sample: false };
  }
  // Scout's free first analysis stays fully visible (it was computed and stored in full on purpose).
  if (row.result.full && row.result.sample) return { full: row.result.analysis, teaser: teaser(row.result.analysis), sample: true };
  if (row.result.full) return { full: null, teaser: teaser(row.result.analysis), sample: false };
  return { full: null, teaser: row.result.teaser, sample: false };
}

const k1 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? null : Math.round(v / 1000) * 1000);
/** Drop null/empty fields so the memo doesn't ask for things that don't apply (e.g. ARV on a warehouse). */
const compact = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && !v.length)));

function memoData(f: DealFacts, a: Analysis, motivation: Motivation | null) {
  return compact({
    property: compact({
      name: f.name, location: [f.city, f.state].filter(Boolean).join(", "), type: PROPERTY_TYPE_LABELS[f.type], asking: f.list, arv: f.arv, repairs: f.rehab,
      monthlyRent: f.rentMonthly, noi: k1(a.noi), noiEstimated: a.estimated || null, yearBuilt: f.yearBuilt, daysOnMarket: f.daysOnMarket,
      occupancy: f.occupancy != null ? fmtPct(f.occupancy, 0) : null, units: f.units, squareFeet: f.nrsf, leaseNote: f.leaseNote,
    }),
    dealScore: a.score,
    verdict: a.verdict.text,
    exits: a.exits.map((x) => ({ exit: x.name, score: x.score, keyNumber: x.metric, detail: x.sub, maxPrice: k1(x.maxPrice) })),
    offerLadder: a.ladder,
    stress: a.stress ? { breakEvenOccupancy: fmtPct(a.stress.breakEven, 0), allThreeShocksDSCR: +a.stress.rows[4]!.dscr.toFixed(2) } : null,
    redFlags: a.flags.map((x) => x[1]),
    sellerMotivation: motivation,
    style: "Round dollar figures to the nearest thousand (e.g. $1.07M, $135K). Only mention inputs that appear in this data.",
  });
}

/** Plain-language memo from the numbers alone, used when the AI is off or fails. */
export function fallbackMemo(a: Analysis): Memo {
  const best = a.best;
  const target = a.ladder?.[1]?.price;
  return {
    headline: best ? `${a.verdict.text} Best exit: ${best.name.toLowerCase()}${target ? `, targeting about $${Math.round(target / 1000)}K` : ""}.` : "Not enough numbers to pick an exit. Add the price and rent or NOI.",
    thesis: best ? [`${best.name}: ${best.metric} (${best.sub}).`] : [],
    risks: a.flags.filter((f) => f[0] === "warn").map((f) => f[1]).slice(0, 3),
    nextSteps: ["Get the rent roll and trailing 12-month financials.", "Verify repairs with a contractor walk-through.", "Send the anchor offer and log the response."],
    killers: [],
    mustBeTrue: [],
    offerScript: "",
  };
}

export async function runAnalysis(ctx: Ctx, input: AnalyzeInput, pdf: Uint8Array | null): Promise<AnalysisRow> {
  const q = await quotaFor(ctx);
  if (q.left <= 0) {
    throw new HttpError(402, ctx.plan.id === "free" ? `You've used your ${q.total} free analyses. Start a 7-day free trial to keep going.` : `You've used all ${q.total} analyses this month on ${ctx.plan.name}.`);
  }
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  if ((await ctx.uq.countUsage(ctx.orgId, "analysis", hourAgo)) >= 60) throw new HttpError(429, "That's a lot of analyses in an hour. Try again shortly.");

  const asset: AssetClass = input.asset;
  const link = input.link ? parseListingUrl(input.link) : null;
  const text = (input.text ?? "").trim();
  // Property data comes only from the server-side cache filled by /api/property-lookup.
  const addr = resolveAddress(input.address, input.link);
  const records: PropertyRecord | null = addr ? await cachedRecord(addr) : null;
  const hasQuick = [input.list, input.rentMonthly, input.noi, input.arv].some((v) => v != null);
  if (!pdf && text.length < 40 && !hasQuick && !records) throw new HttpError(400, "Paste the listing text, upload the OM, pull the property data, or type the price and rent.");

  // 1. Read (AI, with the deterministic read filling gaps). Numbers are never invented.
  let extracted: Extracted = heuristicExtract(text);
  let tokensIn = 0;
  let tokensOut = 0;
  // Track whether SI really ran, and why not, so a missing key or empty credits never fails silently.
  let readBySi = false;
  let siProblem: string | null = isAnthropicConfigured() ? null : "No Claude API key is set on the server, so SI is off. Add ANTHROPIC_API_KEY in Vercel and redeploy.";
  if (isAnthropicConfigured() && (pdf || text.length >= 40)) {
    const content = [
      ...(pdf ? [pdfBlock(pdf)] : []),
      { type: "text" as const, text: `${extractPrompt(asset, link, !!text)}${text ? `\n\nListing text:\n"""\n${text}\n"""` : ""}` },
    ];
    try {
      const r = await jsonFromClaude({ system: EXTRACT_SYSTEM, content, schema: extractedSchema, maxTokens: 4000 });
      tokensIn += r.usage.input;
      tokensOut += r.usage.output;
      if (r.ok) {
        extracted = mergeExtracted(r.data, extracted);
        readBySi = true;
      } else siProblem = "SI couldn't read this listing reliably, so the basic reader was used. Check the numbers.";
    } catch (e) {
      console.error("extract failed, using deterministic read", e);
      siProblem = explainAiError(e);
    }
  }


  const typeHint = input.type && input.type in PROPERTY_TYPE_LABELS && assetOf(input.type) === asset ? input.type : null;
  const fallbackName = input.name?.trim() || link?.name || `${PROPERTY_TYPE_LABELS[typeHint ?? ""] ?? "Deal"}${link?.city ? ` in ${link.city}` : ""}`;
  const facts: DealFacts = factsFrom(extracted, asset, typeHint, fallbackName);
  if (input.name?.trim()) facts.name = input.name.trim();
  facts.city = input.city?.trim() || facts.city || link?.city || null;
  facts.state = input.state?.trim().toUpperCase() || facts.state || link?.state || null;
  if (records) {
    // Records fill gaps only; anything read from the listing or typed by the user wins.
    const sug = suggestFacts(records, asset);
    for (const k of ["list", "rentMonthly", "arv", "yearBuilt", "nrsf", "units", "daysOnMarket"] as const) if (facts[k] == null && sug[k] != null) facts[k] = sug[k];
    if (!input.name?.trim() && !extracted.name && addr) facts.name = addr.street;
    facts.city ??= addr?.city ?? null;
    facts.state ??= addr?.state ?? null;
  }
  for (const k of ["list", "rentMonthly", "noi", "arv", "rehab"] as const) if (input[k] != null) facts[k] = input[k]!;
  const motivation: Motivation | null = extracted.motivation ? { score: extracted.motivation.score, signals: extracted.motivation.signals, leverage: extracted.motivation.leverage } : null;

  // Sanity-check what was read (typed numbers are trusted as entered).
  const typed = new Set((["list", "rentMonthly", "noi", "arv", "rehab"] as const).filter((k) => input[k] != null));
  Object.assign(facts, sanityCheck(facts, typed).facts);

  // 2. Compute (code only).
  const rules = await rulesFor(ctx);
  const a = analyze(facts, rules);
  if (!a.best && !a.noi && !facts.list) throw new HttpError(422, "We couldn't find a price or any income in that listing. Type the asking price and the rent or NOI, then run it again.");

  // Scout's first analysis is the full product, free: the best way to show what a paid plan gets.
  const sample = !ctx.plan.features.fullAnalysis && q.used === 0;
  const full = ctx.plan.features.fullAnalysis || sample;

  // 3. Write (AI, for full analyses only; numbers come from step 2).
  let memo: Memo | null = null;
  if (full) {
    memo = { ...fallbackMemo(a), source: "basic", problem: siProblem };
    if (isAnthropicConfigured() && !(siProblem && /key|credits|model/.test(siProblem))) {
      try {
        const r = await jsonFromClaude({ system: MEMO_SYSTEM, content: [{ type: "text", text: memoPrompt(memoData(facts, a, motivation)) }], schema: memoSchema, maxTokens: 3000 });
        tokensIn += r.usage.input;
        tokensOut += r.usage.output;
        if (r.ok) {
          // Drop any sentence quoting a dollar figure the engine didn't compute or the listing didn't state.
          const g = groundMemo(r.data, memoData(facts, a, motivation), memo);
          if (g.dropped) console.warn(`memo: dropped ${g.dropped} ungrounded line(s)`);
          memo = { ...g.memo, source: "si", problem: readBySi || !(pdf || text.length >= 40) ? null : siProblem };
        } else memo = { ...memo, problem: siProblem ?? "SI couldn't write the memo this time; this one is built from the numbers." };
      } catch (e) {
        console.error("memo failed, using computed memo", e);
        memo = { ...memo, problem: explainAiError(e) };
      }
    }
  }

  await ctx.uq.recordUsage(ctx.orgId, ctx.user.id, "analysis", tokensIn, tokensOut);
  const result: StoredResult = full ? { full: true, analysis: a, ...(sample ? { sample: true } : {}) } : { full: false, teaser: teaser(a) };
  return ctx.uq.createAnalysis(ctx.orgId, ctx.user.id, {
    name: facts.name.slice(0, 140),
    asset,
    property_type: facts.type,
    city: facts.city,
    state: facts.state,
    listing_url: link?.url ?? null,
    stage: "analyzed",
    score: a.score,
    facts,
    result,
    memo: memo ?? { ...fallbackMemo(a), thesis: [], risks: [], nextSteps: [], source: readBySi ? "si" : "basic", problem: siProblem },
    motivation: full ? motivation : null,
    offers: [],
    notes: "",
    records,
  });
}
