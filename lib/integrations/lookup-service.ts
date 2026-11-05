import "server-only";
import { isDemoMode } from "../env";
import { quotaWindowStart } from "../billing/plans";
import { HttpError } from "../server/run";
import type { Ctx } from "../server/context";
import { supabaseAdmin } from "../supabase/server";
import { addressKey, CALLS_PER_LOOKUP, fetchRentcast, RentcastError, type LookupAddress, type PropertyRecord } from "./rentcast";

const CACHE_DAYS = 30;
export const isRentcastConfigured = () => Boolean(process.env.RENTCAST_API_KEY);
/** Monthly API-call budget across the whole app (RentCast's free tier is 50 calls). */
const monthlyBudget = () => Math.max(0, Number(process.env.RENTCAST_MONTHLY_CALLS || 50));

interface Cache {
  get(key: string): Promise<{ record: PropertyRecord; created_at: string } | null>;
  put(key: string, record: PropertyRecord, calls: number): Promise<void>;
  callsSince(iso: string): Promise<number>;
  logCalls(orgId: string, calls: number): Promise<void>;
}

const g = globalThis as unknown as { __undriqLookups?: { rows: Map<string, { record: PropertyRecord; created_at: string }>; calls: { at: string; n: number }[] } };
const memCache = (): Cache => {
  const m = (g.__undriqLookups ??= { rows: new Map<string, { record: PropertyRecord; created_at: string }>(), calls: [] as { at: string; n: number }[] });
  return {
    async get(k) { return m.rows.get(k) ?? null; },
    async put(k, record) { m.rows.set(k, { record, created_at: new Date().toISOString() }); },
    async callsSince(iso) { return m.calls.filter((c) => c.at >= iso).reduce((s, c) => s + c.n, 0); },
    async logCalls(_o, n) { m.calls.push({ at: new Date().toISOString(), n }); },
  };
};

const dbCache = (): Cache => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new HttpError(503, "Property data needs SUPABASE_SERVICE_ROLE_KEY on the server.");
  const db = supabaseAdmin();
  return {
    async get(k) {
      const { data } = await db.from("property_lookups").select("record, created_at").eq("address_key", k).maybeSingle();
      return (data as { record: PropertyRecord; created_at: string } | null) ?? null;
    },
    async put(k, record, calls) {
      await db.from("property_lookups").upsert({ address_key: k, record, calls, created_at: new Date().toISOString() }, { onConflict: "address_key" });
    },
    async callsSince(iso) {
      const { data } = await db.from("property_lookup_calls").select("calls").gte("created_at", iso);
      return ((data as { calls: number }[] | null) ?? []).reduce((s, r) => s + r.calls, 0);
    },
    async logCalls(orgId, n) {
      await db.from("property_lookup_calls").insert({ org_id: orgId, calls: n });
    },
  };
};

export const lookupCache = () => (isDemoMode() ? memCache() : dbCache());

/** Cached read only (used by analyze so the browser can't inject a fake record). */
export async function cachedRecord(a: LookupAddress): Promise<PropertyRecord | null> {
  if (!isRentcastConfigured()) return null;
  return (await lookupCache().get(addressKey(a)))?.record ?? null;
}

export async function lookupProperty(ctx: Ctx, a: LookupAddress): Promise<{ record: PropertyRecord; cached: boolean }> {
  const key = process.env.RENTCAST_API_KEY;
  if (!key) throw new HttpError(503, "Property data isn't connected yet. Add RENTCAST_API_KEY on the server.");
  const cache = lookupCache();
  const k = addressKey(a);
  const hit = await cache.get(k);
  if (hit && Date.now() - Date.parse(hit.created_at) < CACHE_DAYS * 86_400_000) return { record: hit.record, cached: true };

  // Per-space quota: lookups are allowed as often as analyses on the plan. Cache hits are free.
  const used = await ctx.uq.countUsage(ctx.orgId, "property_lookup", quotaWindowStart(ctx.plan));
  if (used >= ctx.plan.analyses) throw new HttpError(402, ctx.plan.id === "free" ? "You've used your free property lookups. Pick a plan to keep pulling property data." : "You've used this month's property lookups.");
  // App-wide budget so the RentCast bill can't run away.
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  if ((await cache.callsSince(monthStart)) + CALLS_PER_LOOKUP > monthlyBudget()) {
    throw new HttpError(503, "Property data is at its monthly limit. Paste the listing text instead, or raise RENTCAST_MONTHLY_CALLS.");
  }

  try {
    const { record, calls } = await fetchRentcast(a, key);
    await cache.logCalls(ctx.orgId, calls);
    await ctx.uq.recordUsage(ctx.orgId, ctx.user.id, "property_lookup", 0, 0);
    if (record.property || record.value || record.rent || record.listing) await cache.put(k, record, calls);
    return { record, cached: false };
  } catch (e) {
    if (e instanceof RentcastError) throw new HttpError(e.status, e.message);
    throw e;
  }
}
