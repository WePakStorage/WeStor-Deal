import "server-only";
import { randomUUID } from "node:crypto";
import type { Buyer, Org, Profile, Subscription } from "../types";
import { freeSubscription, type Store } from "./store";

/**
 * Demo-mode store. Lives in process memory and resets on restart. Used whenever Supabase env vars
 * are missing, so the product can be explored end to end without any accounts. Starts empty.
 */
export const DEMO_ORG_ID = "0a000000-0000-4000-8000-000000000001";
export const DEMO_USER_ID = "0b000000-0000-4000-8000-000000000001";

interface DB {
  orgs: Org[];
  profiles: Profile[];
  subscriptions: Subscription[];
  buyers: Buyer[];
}

const fresh = (): DB => ({
  orgs: [{ id: DEMO_ORG_ID, name: "My space" }],
  profiles: [{ user_id: DEMO_USER_ID, org_id: DEMO_ORG_ID, full_name: "Demo User", email: "demo@undriq.app", role: "owner" }],
  subscriptions: [freeSubscription(DEMO_ORG_ID)],
  buyers: [],
});

const g = globalThis as unknown as { __undriqDemoDb?: DB };
const db = (): DB => (g.__undriqDemoDb ??= fresh());
const clone = <T>(v: T): T => structuredClone(v);

function mustOwn<T extends { org_id: string }>(row: T | undefined, orgId: string): T {
  if (!row || row.org_id !== orgId) throw new Error("Not found");
  return row;
}

export const memoryStore: Store = {
  async getOrg(orgId) {
    return clone(db().orgs.find((o) => o.id === orgId) ?? null);
  },

  async getSubscription(orgId) {
    return clone(db().subscriptions.find((x) => x.org_id === orgId) ?? freeSubscription(orgId));
  },
  async upsertSubscription(sub) {
    const list = db().subscriptions;
    const i = list.findIndex((x) => x.org_id === sub.org_id);
    if (i >= 0) list[i] = clone(sub);
    else list.push(clone(sub));
  },
  async findOrgIdByStripeCustomer(customerId) {
    return db().subscriptions.find((s) => s.stripe_customer_id === customerId)?.org_id ?? null;
  },

  async listBuyers(orgId) {
    return clone(db().buyers.filter((b) => b.org_id === orgId).sort((a, b) => a.firm_name.localeCompare(b.firm_name)));
  },
  async upsertBuyer(orgId, buyer) {
    const list = db().buyers;
    if (buyer.id) {
      const existing = mustOwn(list.find((b) => b.id === buyer.id), orgId);
      Object.assign(existing, buyer);
      return clone(existing);
    }
    const row: Buyer = { ...buyer, id: randomUUID(), org_id: orgId, created_at: new Date().toISOString() };
    list.push(row);
    return clone(row);
  },
  async deleteBuyer(orgId, buyerId) {
    mustOwn(db().buyers.find((b) => b.id === buyerId), orgId);
    db().buyers = db().buyers.filter((b) => b.id !== buyerId);
  },
};

/** Demo-only handles for the UndrIq space store (lib/data/uq-memory.ts). */
export const demoTables = {
  orgs: () => db().orgs,
  subscriptions: () => db().subscriptions,
  profiles: () => db().profiles,
};
