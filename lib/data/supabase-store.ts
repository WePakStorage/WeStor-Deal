import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_ASSUMPTIONS, type DealBundle, type DealFinancial, type Org, type Subscription } from "../types";
import type { Store } from "./store";

const BUCKET = "deal-files";

/** Throw on error. For maybeSingle() callers, null data is still possible at runtime and is checked. */
function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? null) as T;
}

function toOrg(row: Record<string, unknown>): Org {
  return { ...(row as unknown as Org), defaults: { ...DEFAULT_ASSUMPTIONS, ...((row.defaults as object) ?? {}) } };
}

/**
 * Supabase-backed store. Pass a user-scoped client for requests (RLS applies)
 * or the service-role client for webhooks. org_id filters are still applied
 * explicitly so the service-role path is safe too.
 */
export function supabaseStore(sb: SupabaseClient, admin?: SupabaseClient): Store {
  // Subscription and usage writes bypass RLS by design (members cannot write them).
  const priv = admin ?? sb;
  return {
    async getOrg(orgId) {
      const data = check(await sb.from("orgs").select("*").eq("id", orgId).maybeSingle()) as Record<string, unknown> | null;
      return data ? toOrg(data) : null;
    },
    async updateOrg(orgId, patch) {
      return toOrg(check(await sb.from("orgs").update(patch).eq("id", orgId).select("*").single()));
    },
    async findOrgByInboundToken(token) {
      const data = check(await priv.from("orgs").select("*").eq("inbound_token", token).maybeSingle());
      return data ? toOrg(data) : null;
    },

    async listMembers(orgId) {
      const members = check(await sb.from("profiles").select("user_id, org_id, full_name, email, role").eq("org_id", orgId));
      const invites = check(await sb.from("org_invites").select("email, full_name").eq("org_id", orgId));
      return [
        ...members,
        ...invites.map((i) => ({ user_id: `invite:${i.email}`, org_id: orgId, full_name: `${i.full_name || i.email} (invited)`, email: i.email, role: "member" as const })),
      ];
    },
    async addMember(orgId, email, fullName) {
      check(await sb.from("org_invites").upsert({ org_id: orgId, email, full_name: fullName }, { onConflict: "org_id,email" }));
      return { user_id: `invite:${email}`, org_id: orgId, full_name: fullName, email, role: "member" };
    },

    async getSubscription(orgId) {
      const data = check(await sb.from("subscriptions").select("*").eq("org_id", orgId).maybeSingle());
      return (data as Subscription | null) ?? { org_id: orgId, stripe_customer_id: null, stripe_subscription_id: null, plan: "free", status: "none", current_period_end: null };
    },
    async upsertSubscription(sub) {
      check(await priv.from("subscriptions").upsert(sub, { onConflict: "org_id" }));
    },
    async findOrgIdByStripeCustomer(customerId) {
      const data = check(await priv.from("subscriptions").select("org_id").eq("stripe_customer_id", customerId).maybeSingle()) as { org_id: string } | null;
      return data?.org_id ?? null;
    },

    async listDeals(orgId) {
      const deals = check(await sb.from("deals").select("*").eq("org_id", orgId).order("updated_at", { ascending: false }));
      const fins = check(await sb.from("deal_financials").select("deal_id, period, noi").eq("org_id", orgId));
      return deals.map((d) => {
        const noi: Partial<Record<DealFinancial["period"], number>> = {};
        for (const f of fins) if (f.deal_id === d.id && f.noi !== null) noi[f.period as DealFinancial["period"]] = Number(f.noi);
        return { ...d, noi };
      });
    },
    async countUserDeals(orgId) {
      const res = await sb.from("deals").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("is_sample", false);
      if (res.error) throw new Error(res.error.message);
      return res.count ?? 0;
    },
    async getDealBundle(orgId, dealId) {
      const deal = check(await sb.from("deals").select("*").eq("org_id", orgId).eq("id", dealId).maybeSingle()) as (Record<string, unknown> & { om_narrative?: string | null }) | null;
      if (!deal) return null;
      const [financials, unitMix, flags, documents, tasks, activity] = await Promise.all([
        sb.from("deal_financials").select("*").eq("deal_id", dealId),
        sb.from("unit_mix").select("*").eq("deal_id", dealId).order("unit_type"),
        sb.from("deal_flags").select("*").eq("deal_id", dealId),
        sb.from("documents").select("*").eq("deal_id", dealId).order("created_at", { ascending: false }),
        sb.from("tasks").select("*").eq("deal_id", dealId).order("created_at"),
        sb.from("activity_log").select("*").eq("deal_id", dealId).order("created_at", { ascending: false }).limit(100),
      ]);
      const { om_narrative, ...rest } = deal;
      return {
        deal: rest as unknown as DealBundle["deal"],
        financials: check(financials),
        unitMix: check(unitMix),
        flags: check(flags),
        documents: check(documents),
        tasks: check(tasks),
        activity: check(activity),
        narrative: (om_narrative as string | null) ?? null,
      };
    },
    async createDeal(orgId, input) {
      return check(await sb.from("deals").insert({ ...input, org_id: orgId }).select("*").single());
    },
    async updateDeal(orgId, dealId, patch) {
      return check(await sb.from("deals").update(patch).eq("org_id", orgId).eq("id", dealId).select("*").single());
    },
    async setNarrative(orgId, dealId, narrative) {
      check(await sb.from("deals").update({ om_narrative: narrative }).eq("org_id", orgId).eq("id", dealId));
    },

    async replaceFinancials(orgId, dealId, rows) {
      check(await sb.from("deal_financials").delete().eq("org_id", orgId).eq("deal_id", dealId));
      if (rows.length) check(await sb.from("deal_financials").insert(rows.map((r) => ({ ...r, org_id: orgId, deal_id: dealId }))));
    },
    async replaceUnitMix(orgId, dealId, rows) {
      check(await sb.from("unit_mix").delete().eq("org_id", orgId).eq("deal_id", dealId));
      if (rows.length) check(await sb.from("unit_mix").insert(rows.map((r) => ({ ...r, org_id: orgId, deal_id: dealId }))));
    },
    async replaceFlags(orgId, dealId, rows) {
      check(await sb.from("deal_flags").delete().eq("org_id", orgId).eq("deal_id", dealId));
      if (rows.length) check(await sb.from("deal_flags").insert(rows.map((r) => ({ ...r, org_id: orgId, deal_id: dealId }))));
    },

    async addDocument(orgId, doc) {
      return check(await sb.from("documents").insert({ ...doc, org_id: orgId }).select("*").single());
    },
    async updateDocument(orgId, docId, patch) {
      check(await sb.from("documents").update(patch).eq("org_id", orgId).eq("id", docId));
    },
    async getDocument(orgId, docId) {
      return check(await sb.from("documents").select("*").eq("org_id", orgId).eq("id", docId).maybeSingle());
    },

    async listBuyers(orgId) {
      return check(await sb.from("buyers").select("*").eq("org_id", orgId).order("firm_name"));
    },
    async upsertBuyer(orgId, buyer) {
      if (buyer.id) {
        return check(await sb.from("buyers").update(buyer).eq("org_id", orgId).eq("id", buyer.id).select("*").single());
      }
      return check(await sb.from("buyers").insert({ ...buyer, org_id: orgId }).select("*").single());
    },
    async deleteBuyer(orgId, buyerId) {
      check(await sb.from("buyers").delete().eq("org_id", orgId).eq("id", buyerId));
    },

    async listMatchStatuses(orgId, dealId) {
      return check(await sb.from("deal_buyer_matches").select("deal_id, buyer_id, status").eq("org_id", orgId).eq("deal_id", dealId));
    },
    async setMatchStatus(orgId, dealId, buyerId, status, score, reasons) {
      check(
        await sb
          .from("deal_buyer_matches")
          .upsert({ org_id: orgId, deal_id: dealId, buyer_id: buyerId, status, score, reasons }, { onConflict: "deal_id,buyer_id" }),
      );
    },

    async addTask(orgId, task) {
      return check(await sb.from("tasks").insert({ ...task, org_id: orgId }).select("*").single());
    },
    async updateTask(orgId, taskId, patch) {
      check(await sb.from("tasks").update(patch).eq("org_id", orgId).eq("id", taskId));
    },
    async deleteTask(orgId, taskId) {
      check(await sb.from("tasks").delete().eq("org_id", orgId).eq("id", taskId));
    },

    async logActivity(entry) {
      check(await sb.from("activity_log").insert(entry));
    },
    async logUsage(orgId, kind, tokensIn, tokensOut) {
      check(await priv.from("usage_events").insert({ org_id: orgId, kind, tokens_in: tokensIn, tokens_out: tokensOut }));
    },
    async countUsageSince(orgId, sinceIso) {
      const res = await sb.from("usage_events").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("created_at", sinceIso);
      if (res.error) throw new Error(res.error.message);
      return res.count ?? 0;
    },

    async listCandidates(orgId) {
      return check(await sb.from("sourcing_candidates").select("*").eq("org_id", orgId).order("score", { ascending: false }).limit(1000));
    },
    async replaceCandidates(orgId, county, rows) {
      check(await sb.from("sourcing_candidates").delete().eq("org_id", orgId).eq("county", county));
      for (let i = 0; i < rows.length; i += 500) {
        check(await sb.from("sourcing_candidates").insert(rows.slice(i, i + 500).map((r) => ({ ...r, org_id: orgId }))));
      }
    },
    async markCandidateAdded(orgId, candidateId, dealId) {
      check(await sb.from("sourcing_candidates").update({ added_deal_id: dealId }).eq("org_id", orgId).eq("id", candidateId));
    },

    async putFile(path, bytes, contentType) {
      const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
      if (error) throw new Error(error.message);
    },
    async getFile(path) {
      const { data, error } = await sb.storage.from(BUCKET).download(path);
      if (error || !data) return null;
      return new Uint8Array(await data.arrayBuffer());
    },
  };
}
