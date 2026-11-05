import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Plan } from "../types";
import type { AnalysisRow, Space, SpaceMember } from "../undriq/types";
import { SpaceError, type InviteResult, type UqStore } from "./uq-store";

interface PgError {
  message: string;
  code?: string;
}

/** Turn a Postgres error from our RPCs into a status the UI can show. */
function fail(e: PgError): never {
  const status = e.code === "42501" ? 403 : e.code === "42704" ? 404 : e.code === "P0001" || e.code === "22023" ? 400 : 500;
  throw new SpaceError(status, status === 500 ? "Something went wrong. Try again." : e.message);
}

function ok<T>(res: { data: T | null; error: PgError | null }): T {
  if (res.error) fail(res.error);
  return res.data as T;
}

const PLANS = new Set<Plan>(["free", "investor", "firm", "fund"]);
const asPlan = (p: unknown): Plan => (typeof p === "string" && PLANS.has(p as Plan) ? (p as Plan) : "free");

/**
 * Supabase UqStore. `sb` is the signed-in user's client, so auth.uid() inside every RPC is
 * the caller and RLS applies to every table read. The service role is never used here.
 */
export function supabaseUqStore(sb: SupabaseClient): UqStore {
  return {
    async listSpaces() {
      const rows = ok(await sb.rpc("my_spaces")) as { org_id: string; name: string; kind: Space["kind"]; role: Space["role"]; owner_user_id: string | null; plan: string }[];
      return rows.map((r) => ({ orgId: r.org_id, name: r.name, kind: r.kind, role: r.role, ownerUserId: r.owner_user_id, plan: asPlan(r.plan) }));
    },
    async activeOrgId() {
      return (ok(await sb.rpc("auth_org_id")) as string | null) ?? null;
    },
    async switchSpace(_userId, orgId) {
      ok(await sb.rpc("switch_space", { target: orgId }));
    },
    async createTeam(_userId, name) {
      return ok(await sb.rpc("create_team", { team_name: name })) as string;
    },
    async inviteToTeam(_userId, orgId, email) {
      return ok(await sb.rpc("invite_to_team", { target: orgId, invite_email: email })) as InviteResult;
    },
    async removeFromTeam(_userId, orgId, targetUserId) {
      ok(await sb.rpc("remove_from_team", { target: orgId, uid: targetUserId }));
    },
    async revokeInvite(_userId, orgId, email) {
      ok(await sb.rpc("revoke_invite", { target: orgId, invite_email: email }));
    },
    async deleteTeam(_userId, orgId) {
      ok(await sb.rpc("delete_team", { target: orgId }));
    },
    async renameTeam(_userId, orgId, name) {
      ok(await sb.rpc("rename_team", { target: orgId, team_name: name }));
    },
    async listSpaceMembers(orgId) {
      const members = ok(await sb.rpc("space_members", { target: orgId })) as { user_id: string; full_name: string; email: string; role: SpaceMember["role"] }[];
      const invites = ok(await sb.from("org_invites").select("email").eq("org_id", orgId)) as { email: string }[];
      return [
        ...members.map((m) => ({ userId: m.user_id, name: m.full_name || m.email, email: m.email, role: m.role, pending: false })),
        ...invites.map((i) => ({ userId: null, name: i.email, email: i.email, role: "member" as const, pending: true })),
      ];
    },

    async getBuyBox(orgId) {
      const row = ok(await sb.from("orgs").select("buy_box").eq("id", orgId).maybeSingle()) as { buy_box: unknown } | null;
      return row?.buy_box ?? {};
    },
    async setBuyBox(_orgId, rules) {
      // set_buy_box writes to the caller's active space after its own Fund check.
      ok(await sb.rpc("set_buy_box", { rules }));
    },

    async listAnalyses(orgId) {
      return ok(await sb.from("analyses").select("*").eq("org_id", orgId).order("updated_at", { ascending: false }).limit(500)) as AnalysisRow[];
    },
    async getAnalysis(orgId, id) {
      return (ok(await sb.from("analyses").select("*").eq("org_id", orgId).eq("id", id).maybeSingle()) as AnalysisRow | null) ?? null;
    },
    async createAnalysis(orgId, userId, row) {
      return ok(await sb.from("analyses").insert({ ...row, org_id: orgId, created_by: userId }).select("*").single()) as AnalysisRow;
    },
    async updateAnalysis(orgId, id, patch) {
      const row = ok(await sb.from("analyses").update(patch).eq("org_id", orgId).eq("id", id).select("*").maybeSingle()) as AnalysisRow | null;
      if (!row) throw new SpaceError(404, "Deal not found.");
      return row;
    },
    async deleteAnalysis(orgId, id) {
      ok(await sb.from("analyses").delete().eq("org_id", orgId).eq("id", id));
    },

    async recordUsage(_orgId, _userId, kind, tokensIn, tokensOut) {
      ok(await sb.rpc("record_usage", { usage_kind: kind, t_in: Math.round(tokensIn), t_out: Math.round(tokensOut) }));
    },
    async countUsage(orgId, kind, sinceIso) {
      const res = await sb.from("usage_events").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("kind", kind).gte("created_at", sinceIso);
      if (res.error) fail(res.error);
      return res.count ?? 0;
    },
  };
}
