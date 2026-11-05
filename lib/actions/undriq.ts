"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { HttpError, run } from "../server/run";
import { requireFeature } from "../server/gate";
import { ASSET_CLASSES, assetOf, defaultType, PROPERTY_TYPE_LABELS } from "../undriq/assets";
import { analyze, emptyFacts, normalizeRules, teaser, type DealFacts } from "../undriq/engine";
import { toNumber } from "../undriq/extract";
import { OFFER_STATUSES, OFFER_TYPES, type OfferTerms } from "../undriq/offers";
import { rulesFor } from "../undriq/service";
import { ANALYSIS_STAGES, type SavedOffer } from "../undriq/types";
import type { InviteResult } from "../data/uq-store";
import type { ActionResult } from "./result";

const id = z.string().uuid("Invalid id.");
const done = () => {
  revalidatePath("/app", "layout");
  return null;
};

// ───────────────────────── Spaces
export async function switchSpace(orgId: string): Promise<ActionResult> {
  return run(async ({ uq, user }) => {
    await uq.switchSpace(user.id, id.parse(orgId));
    return done();
  });
}

export async function createTeam(name: string): Promise<ActionResult<{ id: string }>> {
  return run(async ({ uq, user }) => {
    const n = z.string().trim().min(2, "Name the team.").max(80).parse(name);
    const orgId = await uq.createTeam(user.id, n);
    await uq.switchSpace(user.id, orgId);
    revalidatePath("/app", "layout");
    return { id: orgId };
  });
}

export async function inviteToTeam(orgId: string, email: string): Promise<ActionResult<{ result: InviteResult }>> {
  return run(async ({ uq, user }) => {
    const e = z.string().trim().toLowerCase().email("Enter a valid email address.").parse(email);
    const result = await uq.inviteToTeam(user.id, id.parse(orgId), e);
    revalidatePath("/app/team");
    return { result };
  });
}

export async function removeFromTeam(orgId: string, userId: string): Promise<ActionResult> {
  return run(async ({ uq, user }) => {
    await uq.removeFromTeam(user.id, id.parse(orgId), id.parse(userId));
    return done();
  });
}

export async function leaveTeam(orgId: string): Promise<ActionResult> {
  return run(async ({ uq, user }) => {
    await uq.removeFromTeam(user.id, id.parse(orgId), user.id);
    return done();
  });
}

export async function revokeInvite(orgId: string, email: string): Promise<ActionResult> {
  return run(async ({ uq, user }) => {
    await uq.revokeInvite(user.id, id.parse(orgId), z.string().email().parse(email));
    revalidatePath("/app/team");
    return null;
  });
}

export async function renameTeam(orgId: string, name: string): Promise<ActionResult> {
  return run(async ({ uq, user }) => {
    await uq.renameTeam(user.id, id.parse(orgId), z.string().trim().min(2, "Name the team.").max(80).parse(name));
    return done();
  });
}

export async function deleteTeam(orgId: string, confirmName: string): Promise<ActionResult> {
  return run(async ({ uq, user, spaces }) => {
    const target = id.parse(orgId);
    const s = spaces.find((x) => x.orgId === target);
    if (!s || s.kind !== "team") throw new HttpError(404, "Team not found.");
    if (confirmName.trim() !== s.name) throw new HttpError(400, "Type the team name exactly to confirm.");
    await uq.deleteTeam(user.id, target);
    return done();
  });
}

// ───────────────────────── Pipeline
export async function setStage(analysisId: string, stage: string): Promise<ActionResult> {
  return run(async (ctx) => {
    requireFeature(ctx, "pipeline");
    await ctx.uq.updateAnalysis(ctx.orgId, id.parse(analysisId), { stage: z.enum(ANALYSIS_STAGES).parse(stage) });
    return done();
  });
}

export async function saveNotes(analysisId: string, notes: string): Promise<ActionResult> {
  return run(async (ctx) => {
    requireFeature(ctx, "pipeline");
    await ctx.uq.updateAnalysis(ctx.orgId, id.parse(analysisId), { notes: z.string().max(20_000).parse(notes) });
    revalidatePath(`/app/analyses/${analysisId}`);
    return null;
  });
}

export async function deleteAnalysis(analysisId: string): Promise<ActionResult> {
  return run(async (ctx) => {
    await ctx.uq.deleteAnalysis(ctx.orgId, id.parse(analysisId));
    return done();
  });
}

// ───────────────────────── Offers
const termsSchema = z.object({
  rung: z.string().max(20),
  price: z.number().positive("Enter an offer price.").max(1e10),
  type: z.enum(Object.keys(OFFER_TYPES) as [keyof typeof OFFER_TYPES, ...(keyof typeof OFFER_TYPES)[]]),
  emd: z.number().min(0).max(1e9),
  inspect: z.number().int().min(0).max(365),
  close: z.number().int().min(1).max(730),
  down: z.number().min(0).max(1),
  rate: z.number().min(0).max(0.3),
  years: z.number().int().min(1).max(40),
  balloon: z.number().int().min(1).max(40),
  costs: z.enum(["each", "buyer"]),
  asIs: z.boolean(),
  expires: z.number().int().min(1).max(720),
  recipient: z.string().max(120),
  property: z.string().max(200),
  buyer: z.string().max(120),
  entity: z.string().max(160),
  phone: z.string().max(40),
  email: z.string().max(160),
}) satisfies z.ZodType<OfferTerms>;

export async function saveOffer(analysisId: string, terms: OfferTerms): Promise<ActionResult<{ offerId: string }>> {
  return run(async (ctx) => {
    requireFeature(ctx, "offers");
    const t = termsSchema.parse(terms);
    const row = await ctx.uq.getAnalysis(ctx.orgId, id.parse(analysisId));
    if (!row) throw new HttpError(404, "Deal not found.");
    const offer: SavedOffer = { id: randomUUID(), at: new Date().toISOString(), status: "drafted", terms: t };
    const stage = row.stage === "analyzed" ? "offer_sent" : row.stage;
    await ctx.uq.updateAnalysis(ctx.orgId, row.id, { offers: [...row.offers, offer].slice(-50), stage });
    revalidatePath(`/app/analyses/${row.id}`);
    revalidatePath("/app/pipeline");
    return { offerId: offer.id };
  });
}

export async function setOfferStatus(analysisId: string, offerId: string, status: string): Promise<ActionResult> {
  return run(async (ctx) => {
    requireFeature(ctx, "offers");
    const s = z.enum(OFFER_STATUSES).parse(status);
    const row = await ctx.uq.getAnalysis(ctx.orgId, id.parse(analysisId));
    if (!row) throw new HttpError(404, "Deal not found.");
    const offers = row.offers.map((o) => (o.id === offerId ? { ...o, status: s } : o));
    const stage = s === "accepted" ? "under_contract" : s === "countered" && row.stage !== "under_contract" ? "negotiating" : row.stage;
    await ctx.uq.updateAnalysis(ctx.orgId, row.id, { offers, stage });
    return done();
  });
}

// ───────────────────────── Buy box rules (Fund)
export async function saveBuyBox(rules: unknown): Promise<ActionResult> {
  return run(async (ctx) => {
    requireFeature(ctx, "buyBoxRules");
    await ctx.uq.setBuyBox(ctx.orgId, normalizeRules(rules));
    return done();
  });
}

// ───────────────────────── Bulk analyzer (Fund): engine only, no AI, so it doesn't spend analyses
const bulkRow = z.object({
  name: z.string().max(140),
  asset: z.enum(ASSET_CLASSES).optional(),
  type: z.string().max(40).optional(),
  city: z.string().max(80).optional(),
  state: z.string().max(2).optional(),
  list: z.unknown().optional(),
  rentMonthly: z.unknown().optional(),
  noi: z.unknown().optional(),
  arv: z.unknown().optional(),
  rehab: z.unknown().optional(),
  units: z.unknown().optional(),
  nrsf: z.unknown().optional(),
});
export type BulkRowInput = z.infer<typeof bulkRow>;

function bulkFacts(r: BulkRowInput, fallbackAsset: (typeof ASSET_CLASSES)[number]): DealFacts {
  const type = r.type && r.type in PROPERTY_TYPE_LABELS ? r.type : null;
  const asset = r.asset ?? (type ? assetOf(type) : fallbackAsset);
  return {
    ...emptyFacts(asset, type ?? defaultType(asset), r.name.trim() || "Untitled"),
    city: r.city?.trim() || null,
    state: r.state?.trim().toUpperCase() || null,
    list: toNumber(r.list),
    rentMonthly: toNumber(r.rentMonthly),
    noi: toNumber(r.noi),
    arv: toNumber(r.arv),
    rehab: toNumber(r.rehab),
    units: toNumber(r.units),
    nrsf: toNumber(r.nrsf),
  };
}

export async function bulkSave(rows: BulkRowInput[], fallbackAsset: string): Promise<ActionResult<{ saved: number }>> {
  return run(async (ctx) => {
    requireFeature(ctx, "bulk");
    const list = z.array(bulkRow).min(1, "Pick at least one deal.").max(200, "Save up to 200 at a time.").parse(rows);
    const fa = z.enum(ASSET_CLASSES).parse(fallbackAsset);
    const rules = await rulesFor(ctx);
    for (const r of list) {
      const facts = bulkFacts(r, fa);
      const a = analyze(facts, rules);
      await ctx.uq.createAnalysis(ctx.orgId, ctx.user.id, {
        name: facts.name, asset: facts.asset, property_type: facts.type, city: facts.city, state: facts.state, listing_url: null, stage: "analyzed",
        score: a.score, facts, result: { full: true, analysis: a }, memo: null, motivation: null, offers: [], notes: "Added from the bulk analyzer.",
      });
    }
    revalidatePath("/app", "layout");
    return { saved: list.length };
  });
}

/** Score rows on the server with the space's rules (so Fund rules apply and the engine isn't shipped to lower plans). */
export async function bulkScore(rows: BulkRowInput[], fallbackAsset: string) {
  return run(async (ctx) => {
    requireFeature(ctx, "bulk");
    const list = z.array(bulkRow).max(500, "Up to 500 rows at a time.").parse(rows);
    const fa = z.enum(ASSET_CLASSES).parse(fallbackAsset);
    const rules = await rulesFor(ctx);
    return list.map((r, i) => {
      const facts = bulkFacts(r, fa);
      const a = analyze(facts, rules);
      return { i, name: facts.name, asset: facts.asset, city: facts.city, state: facts.state, list: facts.list, ...teaser(a), walkAway: a.ladder?.[2]?.price ?? null };
    });
  });
}
