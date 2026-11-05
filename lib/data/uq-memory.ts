import "server-only";
import { randomUUID } from "node:crypto";
import { effectivePlan, maxPlan, PLANS } from "../billing/plans";
import type { Plan } from "../types";
import type { AnalysisRow, Space, SpaceMember } from "../undriq/types";
import { DEMO_ORG_ID, DEMO_USER_ID, demoTables } from "./memory";
import { SpaceError, type UqStore, type UsageKind } from "./uq-store";

/**
 * Demo-mode UqStore. Mirrors the rules in the 0003 migration (create_team, invite_to_team,
 * enforce_seats, remove_from_team, switch_space, set_buy_box) so demo and production behave alike.
 */
interface Meta {
  kind: "personal" | "team";
  owner: string;
  buyBox: unknown;
  created: number;
}
interface Mem {
  meta: Map<string, Meta>;
  members: { org_id: string; user_id: string; role: "owner" | "member"; at: number }[];
  invites: { org_id: string; email: string }[];
  active: Map<string, string>;
  personal: Map<string, string>;
  analyses: AnalysisRow[];
  usage: { org_id: string; user_id: string; kind: UsageKind; at: string }[];
}

const g = globalThis as unknown as { __undriqDemo?: Mem };
const mem = (): Mem =>
  (g.__undriqDemo ??= {
    meta: new Map([[DEMO_ORG_ID, { kind: "personal", owner: DEMO_USER_ID, buyBox: {}, created: 0 }]]),
    members: [{ org_id: DEMO_ORG_ID, user_id: DEMO_USER_ID, role: "owner", at: 0 }],
    invites: [],
    active: new Map(),
    personal: new Map([[DEMO_USER_ID, DEMO_ORG_ID]]),
    analyses: [],
    usage: [],
  });

const clone = <T>(v: T): T => structuredClone(v);
const isMember = (orgId: string, userId: string) => mem().members.some((m) => m.org_id === orgId && m.user_id === userId);

function subPlan(orgId: string): Plan {
  const s = demoTables.subscriptions().find((x) => x.org_id === orgId);
  return s ? effectivePlan(s) : "free";
}
function userPlan(userId: string): Plan {
  const p = mem().personal.get(userId);
  return p ? subPlan(p) : "free";
}
export function demoSpacePlan(orgId: string): Plan {
  const m = mem().meta.get(orgId);
  const own = subPlan(orgId);
  return m?.kind === "team" ? maxPlan(own, userPlan(m.owner)) : own;
}
const seatLimit = (orgId: string) => PLANS[demoSpacePlan(orgId)].seats;

function enforceSeats(orgId: string) {
  if (mem().meta.get(orgId)?.kind !== "team") return;
  const used = mem().members.filter((m) => m.org_id === orgId).length + mem().invites.filter((i) => i.org_id === orgId).length;
  if (used >= seatLimit(orgId)) throw new SpaceError(400, `This team is full (${seatLimit(orgId)} seats). Fund teams get up to 15.`);
}

function ownedTeam(userId: string, orgId: string, what: string) {
  const m = mem().meta.get(orgId);
  if (!m || m.kind !== "team" || m.owner !== userId) throw new SpaceError(403, `Only the team owner can ${what}.`);
  return m;
}

const orgName = (orgId: string) => demoTables.orgs().find((o) => o.id === orgId)?.name ?? "Space";

export const memoryUqStore: UqStore = {
  async listSpaces(userId) {
    const { members, meta } = mem();
    const rows: Space[] = members
      .filter((m) => m.user_id === userId)
      .map((m) => {
        const md = meta.get(m.org_id);
        return { orgId: m.org_id, name: orgName(m.org_id), kind: md?.kind ?? "personal", role: m.role, ownerUserId: md?.owner ?? null, plan: demoSpacePlan(m.org_id), _c: md?.created ?? 0 };
      })
      .sort((a, b) => (a.kind === "personal" ? -1 : b.kind === "personal" ? 1 : a._c - b._c))
      .map(({ _c, ...s }) => s);
    return rows;
  },
  async activeOrgId(userId) {
    const a = mem().active.get(userId);
    return a && isMember(a, userId) ? a : mem().personal.get(userId) ?? null;
  },
  async switchSpace(userId, orgId) {
    if (!isMember(orgId, userId)) throw new SpaceError(403, "You are not a member of that space.");
    mem().active.set(userId, orgId);
  },
  async createTeam(userId, name) {
    if (PLANS[userPlan(userId)].rank < 2) throw new SpaceError(403, "Team spaces come with Firm and Fund.");
    const owned = [...mem().meta.values()].filter((m) => m.kind === "team" && m.owner === userId).length;
    const cfg = PLANS[userPlan(userId)];
    if (owned >= cfg.teams) throw new SpaceError(400, `${cfg.name} includes ${cfg.teams} team space${cfg.teams === 1 ? "" : "s"}.${cfg.id === "fund" ? " Delete one to create another." : " Fund includes 3."}`);
    const id = randomUUID();
    demoTables.orgs().push({ id, name: name.trim() || "Team" });
    demoTables.subscriptions().push({ org_id: id, stripe_customer_id: null, stripe_subscription_id: null, plan: "free", status: "none", current_period_end: null });
    mem().meta.set(id, { kind: "team", owner: userId, buyBox: {}, created: Date.now() });
    mem().members.push({ org_id: id, user_id: userId, role: "owner", at: Date.now() });
    return id;
  },
  async inviteToTeam(userId, orgId, email) {
    ownedTeam(userId, orgId, "add people");
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(e)) throw new SpaceError(400, "Enter a valid email address.");
    const existing = demoTables.profiles().find((p) => p.email.toLowerCase() === e);
    if (existing) {
      if (isMember(orgId, existing.user_id)) return "already";
      enforceSeats(orgId);
      mem().members.push({ org_id: orgId, user_id: existing.user_id, role: "member", at: Date.now() });
      return "added";
    }
    if (mem().invites.some((i) => i.org_id === orgId && i.email === e)) return "already";
    enforceSeats(orgId);
    mem().invites.push({ org_id: orgId, email: e });
    return "invited";
  },
  async removeFromTeam(userId, orgId, targetUserId) {
    const m = mem().meta.get(orgId);
    if (!m || m.kind !== "team") throw new SpaceError(404, "Team not found.");
    if (targetUserId === m.owner) throw new SpaceError(403, "The owner can't leave. Delete the team instead.");
    if (userId !== m.owner && userId !== targetUserId) throw new SpaceError(403, "Only the team owner can remove people.");
    mem().members = mem().members.filter((x) => !(x.org_id === orgId && x.user_id === targetUserId));
    if (mem().active.get(targetUserId) === orgId) mem().active.delete(targetUserId);
  },
  async revokeInvite(userId, orgId, email) {
    ownedTeam(userId, orgId, "revoke invites");
    mem().invites = mem().invites.filter((i) => !(i.org_id === orgId && i.email === email.toLowerCase()));
  },
  async deleteTeam(userId, orgId) {
    ownedTeam(userId, orgId, "delete it");
    const s = mem();
    s.members = s.members.filter((m) => m.org_id !== orgId);
    s.invites = s.invites.filter((i) => i.org_id !== orgId);
    s.analyses = s.analyses.filter((a) => a.org_id !== orgId);
    s.meta.delete(orgId);
    for (const [u, a] of s.active) if (a === orgId) s.active.delete(u);
    const orgs = demoTables.orgs();
    const i = orgs.findIndex((o) => o.id === orgId);
    if (i >= 0) orgs.splice(i, 1);
  },
  async renameTeam(userId, orgId, name) {
    ownedTeam(userId, orgId, "rename it");
    const o = demoTables.orgs().find((x) => x.id === orgId);
    if (o) o.name = name.trim().slice(0, 80) || "Team";
  },
  async listSpaceMembers(orgId) {
    const people = demoTables.profiles();
    const out: SpaceMember[] = mem()
      .members.filter((m) => m.org_id === orgId)
      .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : a.at - b.at))
      .map((m) => {
        const p = people.find((x) => x.user_id === m.user_id);
        return { userId: m.user_id, name: p?.full_name || p?.email || "Member", email: p?.email ?? "", role: m.role, pending: false };
      });
    return [...out, ...mem().invites.filter((i) => i.org_id === orgId).map((i) => ({ userId: null, name: i.email, email: i.email, role: "member" as const, pending: true }))];
  },

  async getBuyBox(orgId) {
    return clone(mem().meta.get(orgId)?.buyBox ?? {});
  },
  async setBuyBox(orgId, rules) {
    if (!PLANS[demoSpacePlan(orgId)].features.buyBoxRules) throw new SpaceError(403, "Buy box rules come with Firm and Fund.");
    const m = mem().meta.get(orgId);
    if (m) m.buyBox = clone(rules ?? {});
  },

  async listAnalyses(orgId) {
    return clone(mem().analyses.filter((a) => a.org_id === orgId).sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
  },
  async getAnalysis(orgId, id) {
    return clone(mem().analyses.find((a) => a.org_id === orgId && a.id === id) ?? null);
  },
  async createAnalysis(orgId, userId, row) {
    const iso = new Date().toISOString();
    const a: AnalysisRow = { ...clone(row), id: randomUUID(), org_id: orgId, created_by: userId, created_at: iso, updated_at: iso };
    mem().analyses.push(a);
    return clone(a);
  },
  async updateAnalysis(orgId, id, patch) {
    const a = mem().analyses.find((x) => x.org_id === orgId && x.id === id);
    if (!a) throw new SpaceError(404, "Deal not found.");
    Object.assign(a, clone(patch), { updated_at: new Date().toISOString() });
    return clone(a);
  },
  async deleteAnalysis(orgId, id) {
    mem().analyses = mem().analyses.filter((a) => !(a.org_id === orgId && a.id === id));
  },

  async recordUsage(orgId, userId, kind) {
    mem().usage.push({ org_id: orgId, user_id: userId, kind, at: new Date().toISOString() });
  },
  async countUsage(orgId, kind, sinceIso) {
    return mem().usage.filter((u) => u.org_id === orgId && u.kind === kind && u.at >= sinceIso).length;
  },
};
