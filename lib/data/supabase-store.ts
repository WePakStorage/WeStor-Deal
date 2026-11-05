import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Buyer, Org, Subscription } from "../types";
import { freeSubscription, type Store } from "./store";

/** Throw on error. For maybeSingle() callers, null data is still possible at runtime and is checked. */
function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? null) as T;
}

/**
 * Supabase-backed store. Pass a user-scoped client for requests (RLS applies) or the service-role
 * client for webhooks. org_id filters are applied explicitly so the service-role path is safe too.
 */
export function supabaseStore(sb: SupabaseClient, admin?: SupabaseClient): Store {
  // Subscription writes bypass RLS by design: only the Stripe webhook (service role) writes them.
  const priv = admin ?? sb;
  return {
    async getOrg(orgId) {
      return check(await sb.from("orgs").select("id, name").eq("id", orgId).maybeSingle()) as Org | null;
    },

    async getSubscription(orgId) {
      const data = check(await sb.from("subscriptions").select("*").eq("org_id", orgId).maybeSingle());
      return (data as Subscription | null) ?? freeSubscription(orgId);
    },
    async upsertSubscription(sub) {
      check(await priv.from("subscriptions").upsert(sub, { onConflict: "org_id" }));
    },
    async findOrgIdByStripeCustomer(customerId) {
      const data = check(await priv.from("subscriptions").select("org_id").eq("stripe_customer_id", customerId).maybeSingle()) as { org_id: string } | null;
      return data?.org_id ?? null;
    },

    async listBuyers(orgId) {
      return check(await sb.from("buyers").select("*").eq("org_id", orgId).order("firm_name")) as Buyer[];
    },
    async upsertBuyer(orgId, buyer) {
      if (buyer.id) {
        return check(await sb.from("buyers").update(buyer).eq("org_id", orgId).eq("id", buyer.id).select("*").single()) as Buyer;
      }
      return check(await sb.from("buyers").insert({ ...buyer, org_id: orgId }).select("*").single()) as Buyer;
    },
    async deleteBuyer(orgId, buyerId) {
      check(await sb.from("buyers").delete().eq("org_id", orgId).eq("id", buyerId));
    },
  };
}
