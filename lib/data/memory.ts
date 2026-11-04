import "server-only";
import { randomUUID } from "node:crypto";
import { seedBuyers, seedDeals, seedFinancials, seedUnitMix } from "../seed";
import {
  DEFAULT_ASSUMPTIONS,
  type Activity,
  type Buyer,
  type Deal,
  type DealBuyerMatch,
  type DealDocument,
  type DealFinancial,
  type DealFlag,
  type Org,
  type Profile,
  type Subscription,
  type Task,
  type UnitMix,
} from "../types";
import type { SourcingCandidate, Store } from "./store";

/**
 * Demo-mode store. Lives in process memory and resets on restart.
 * Used whenever Supabase env vars are missing so the product can be
 * explored end to end without any accounts.
 */
export const DEMO_ORG_ID = "0a000000-0000-4000-8000-000000000001";
export const DEMO_USER_ID = "0b000000-0000-4000-8000-000000000001";

interface DB {
  orgs: Org[];
  profiles: Profile[];
  subscriptions: Subscription[];
  deals: Deal[];
  financials: DealFinancial[];
  unitMix: UnitMix[];
  flags: DealFlag[];
  documents: DealDocument[];
  buyers: Buyer[];
  matches: (DealBuyerMatch & { org_id: string; score: number; reasons: string[] })[];
  tasks: (Task & { org_id: string })[];
  activity: Activity[];
  usage: { org_id: string; kind: string; tokens_in: number; tokens_out: number; created_at: string }[];
  narratives: Record<string, string>;
  candidates: SourcingCandidate[];
  files: Record<string, { bytes: Uint8Array; contentType: string }>;
}

function fresh(): DB {
  const iso = new Date().toISOString();
  return {
    orgs: [
      {
        id: DEMO_ORG_ID,
        name: "WePak Storage",
        brand_name: "WePak Storage",
        brand_tagline: "Self-storage acquisitions",
        contact_name: "Sheldrick Redwine",
        contact_phone: "(555) 010-0199",
        contact_email: "deals@wepakstorage.example",
        disclosure_entity: "WePak WeShip LLC",
        logo_url: null,
        inbound_token: "demo-wepak",
        defaults: DEFAULT_ASSUMPTIONS,
      },
    ],
    profiles: [{ user_id: DEMO_USER_ID, org_id: DEMO_ORG_ID, full_name: "Sheldrick Redwine", email: "demo@westor.app", role: "owner" }],
    subscriptions: [{ org_id: DEMO_ORG_ID, stripe_customer_id: null, stripe_subscription_id: null, plan: "free", status: "none", current_period_end: null }],
    deals: seedDeals(DEMO_ORG_ID),
    financials: seedFinancials(),
    unitMix: seedUnitMix(),
    flags: [],
    documents: [],
    buyers: seedBuyers(DEMO_ORG_ID),
    matches: [],
    tasks: [
      { id: randomUUID(), org_id: DEMO_ORG_ID, deal_id: "5a000000-0000-4000-8000-000000000001", title: "Request 2024 tax bill from seller", due_date: "2026-11-10", done: false, assignee: "Sheldrick", created_at: iso },
      { id: randomUUID(), org_id: DEMO_ORG_ID, deal_id: "5a000000-0000-4000-8000-000000000001", title: "Counter at $715K with 30-day close", due_date: "2026-11-07", done: false, assignee: "Sheldrick", created_at: iso },
    ],
    activity: [
      { id: randomUUID(), org_id: DEMO_ORG_ID, deal_id: "5a000000-0000-4000-8000-000000000001", actor: "Sheldrick Redwine", action: "stage_changed", payload: { from: "underwriting", to: "negotiating" }, created_at: iso },
    ],
    usage: [],
    narratives: {},
    candidates: [],
    files: {},
  };
}

const g = globalThis as unknown as { __westorDemoDb?: DB };
const db = (): DB => (g.__westorDemoDb ??= fresh());

const stamp = () => new Date().toISOString();
const clone = <T>(v: T): T => structuredClone(v);

function mustOwn<T extends { org_id: string }>(row: T | undefined, orgId: string): T {
  if (!row || row.org_id !== orgId) throw new Error("Not found");
  return row;
}

export const memoryStore: Store = {
  async getOrg(orgId) {
    return clone(db().orgs.find((o) => o.id === orgId) ?? null);
  },
  async updateOrg(orgId, patch) {
    const o = db().orgs.find((x) => x.id === orgId);
    if (!o) throw new Error("Not found");
    Object.assign(o, patch);
    return clone(o);
  },
  async findOrgByInboundToken(token) {
    return clone(db().orgs.find((o) => o.inbound_token === token) ?? null);
  },

  async listMembers(orgId) {
    return clone(db().profiles.filter((p) => p.org_id === orgId));
  },
  async addMember(orgId, email, fullName) {
    const p: Profile = { user_id: randomUUID(), org_id: orgId, full_name: fullName, email, role: "member" };
    db().profiles.push(p);
    return clone(p);
  },

  async getSubscription(orgId) {
    const s = db().subscriptions.find((x) => x.org_id === orgId);
    return clone(s ?? { org_id: orgId, stripe_customer_id: null, stripe_subscription_id: null, plan: "free", status: "none", current_period_end: null });
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

  async listDeals(orgId) {
    const d = db();
    return clone(
      d.deals
        .filter((x) => x.org_id === orgId)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map((deal) => {
          const noi: Partial<Record<DealFinancial["period"], number>> = {};
          for (const f of d.financials.filter((f) => f.deal_id === deal.id)) {
            if (f.noi !== null) noi[f.period] = f.noi;
          }
          return { ...deal, noi };
        }),
    );
  },
  async countUserDeals(orgId) {
    return db().deals.filter((x) => x.org_id === orgId && !x.is_sample).length;
  },
  async getDealBundle(orgId, dealId) {
    const d = db();
    const deal = d.deals.find((x) => x.id === dealId && x.org_id === orgId);
    if (!deal) return null;
    return clone({
      deal,
      financials: d.financials.filter((f) => f.deal_id === dealId),
      unitMix: d.unitMix.filter((u) => u.deal_id === dealId),
      flags: d.flags.filter((f) => f.deal_id === dealId),
      documents: d.documents.filter((f) => f.deal_id === dealId).sort((a, b) => b.created_at.localeCompare(a.created_at)),
      tasks: d.tasks.filter((t) => t.deal_id === dealId),
      activity: d.activity.filter((a) => a.deal_id === dealId).sort((a, b) => b.created_at.localeCompare(a.created_at)),
      narrative: d.narratives[dealId] ?? null,
    });
  },
  async createDeal(orgId, input) {
    const deal: Deal = { ...input, id: randomUUID(), org_id: orgId, created_at: stamp(), updated_at: stamp() };
    db().deals.push(deal);
    return clone(deal);
  },
  async updateDeal(orgId, dealId, patch) {
    const deal = mustOwn(db().deals.find((x) => x.id === dealId), orgId);
    Object.assign(deal, patch, { updated_at: stamp() });
    return clone(deal);
  },
  async setNarrative(orgId, dealId, narrative) {
    mustOwn(db().deals.find((x) => x.id === dealId), orgId);
    db().narratives[dealId] = narrative;
  },

  async replaceFinancials(orgId, dealId, rows) {
    mustOwn(db().deals.find((x) => x.id === dealId), orgId);
    const d = db();
    d.financials = d.financials.filter((f) => f.deal_id !== dealId).concat(rows.map((r) => ({ ...r, id: randomUUID(), deal_id: dealId })));
  },
  async replaceUnitMix(orgId, dealId, rows) {
    mustOwn(db().deals.find((x) => x.id === dealId), orgId);
    const d = db();
    d.unitMix = d.unitMix.filter((f) => f.deal_id !== dealId).concat(rows.map((r) => ({ ...r, id: randomUUID(), deal_id: dealId })));
  },
  async replaceFlags(orgId, dealId, rows) {
    mustOwn(db().deals.find((x) => x.id === dealId), orgId);
    const d = db();
    d.flags = d.flags.filter((f) => f.deal_id !== dealId).concat(rows.map((r) => ({ ...r, id: randomUUID(), deal_id: dealId })));
  },

  async addDocument(orgId, doc) {
    mustOwn(db().deals.find((x) => x.id === doc.deal_id), orgId);
    const row: DealDocument = { ...doc, id: randomUUID(), created_at: stamp() };
    db().documents.push(row);
    return clone(row);
  },
  async updateDocument(orgId, docId, patch) {
    const doc = db().documents.find((x) => x.id === docId);
    if (!doc) throw new Error("Not found");
    mustOwn(db().deals.find((x) => x.id === doc.deal_id), orgId);
    Object.assign(doc, patch);
  },
  async getDocument(orgId, docId) {
    const doc = db().documents.find((x) => x.id === docId);
    if (!doc) return null;
    const deal = db().deals.find((x) => x.id === doc.deal_id);
    return deal?.org_id === orgId ? clone(doc) : null;
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
    const row: Buyer = { ...buyer, id: randomUUID(), org_id: orgId, created_at: stamp() };
    list.push(row);
    return clone(row);
  },
  async deleteBuyer(orgId, buyerId) {
    mustOwn(db().buyers.find((b) => b.id === buyerId), orgId);
    db().buyers = db().buyers.filter((b) => b.id !== buyerId);
  },

  async listMatchStatuses(orgId, dealId) {
    return clone(db().matches.filter((m) => m.org_id === orgId && m.deal_id === dealId).map(({ deal_id, buyer_id, status }) => ({ deal_id, buyer_id, status })));
  },
  async setMatchStatus(orgId, dealId, buyerId, status, score, reasons) {
    const list = db().matches;
    const m = list.find((x) => x.org_id === orgId && x.deal_id === dealId && x.buyer_id === buyerId);
    if (m) Object.assign(m, { status, score, reasons });
    else list.push({ org_id: orgId, deal_id: dealId, buyer_id: buyerId, status, score, reasons });
  },

  async addTask(orgId, task) {
    mustOwn(db().deals.find((x) => x.id === task.deal_id), orgId);
    const row = { ...task, id: randomUUID(), done: false, created_at: stamp(), org_id: orgId };
    db().tasks.push(row);
    return clone(row);
  },
  async updateTask(orgId, taskId, patch) {
    Object.assign(mustOwn(db().tasks.find((t) => t.id === taskId), orgId), patch);
  },
  async deleteTask(orgId, taskId) {
    mustOwn(db().tasks.find((t) => t.id === taskId), orgId);
    db().tasks = db().tasks.filter((t) => t.id !== taskId);
  },

  async logActivity(entry) {
    db().activity.push({ ...entry, id: randomUUID(), created_at: stamp() });
  },
  async logUsage(orgId, kind, tokensIn, tokensOut) {
    db().usage.push({ org_id: orgId, kind, tokens_in: tokensIn, tokens_out: tokensOut, created_at: stamp() });
  },
  async countUsageSince(orgId, sinceIso) {
    return db().usage.filter((u) => u.org_id === orgId && u.created_at >= sinceIso).length;
  },

  async listCandidates(orgId) {
    return clone(db().candidates.filter((c) => c.org_id === orgId).sort((a, b) => b.score - a.score));
  },
  async replaceCandidates(orgId, county, rows) {
    const d = db();
    d.candidates = d.candidates
      .filter((c) => !(c.org_id === orgId && c.county === county))
      .concat(rows.map((r) => ({ ...r, id: randomUUID(), org_id: orgId, created_at: stamp() })));
  },
  async markCandidateAdded(orgId, candidateId, dealId) {
    mustOwn(db().candidates.find((c) => c.id === candidateId), orgId).added_deal_id = dealId;
  },

  async putFile(path, bytes, contentType) {
    db().files[path] = { bytes, contentType };
  },
  async getFile(path) {
    return db().files[path]?.bytes ?? null;
  },
};

/** Test helper: reset demo data. */
export function resetDemoStore() {
  g.__westorDemoDb = fresh();
}
