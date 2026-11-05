import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { PLANS, type PlanConfig } from "../billing/plans";
import { isDemoMode } from "../env";
import { DEMO_USER_ID, memoryStore } from "../data/memory";
import { supabaseStore } from "../data/supabase-store";
import type { Store } from "../data/store";
import { memoryUqStore } from "../data/uq-memory";
import { supabaseUqStore } from "../data/uq-supabase";
import type { UqStore } from "../data/uq-store";
import { supabaseAdmin, supabaseServer } from "../supabase/server";
import type { Profile } from "../types";
import type { Space } from "../undriq/types";

export interface Ctx {
  store: Store;
  uq: UqStore;
  /** The ACTIVE space. Every read and write in a request is scoped to it. */
  orgId: string;
  space: Space;
  spaces: Space[];
  personalOrgId: string;
  /** Plan of the active space. Gate features with plan.features, never by name. */
  plan: PlanConfig;
  user: { id: string; email: string; name: string; role: Profile["role"] };
  demo: boolean;
}

async function resolveSpaces(uq: UqStore, userId: string) {
  const spaces = await uq.listSpaces(userId);
  const personal = spaces.find((s) => s.kind === "personal");
  if (!personal) return null;
  const activeId = await uq.activeOrgId(userId);
  const space = spaces.find((s) => s.orgId === activeId) ?? personal;
  return { spaces, space, personalOrgId: personal.orgId, plan: PLANS[space.plan] };
}

/** Resolve the signed-in user, their spaces and stores. Null when signed out. */
export const getContext = cache(async (): Promise<Ctx | null> => {
  if (isDemoMode()) {
    const r = await resolveSpaces(memoryUqStore, DEMO_USER_ID);
    if (!r) return null;
    return {
      store: memoryStore,
      uq: memoryUqStore,
      orgId: r.space.orgId,
      ...r,
      user: { id: DEMO_USER_ID, email: "demo@undriq.app", name: "Demo User", role: r.space.role },
      demo: true,
    };
  }
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const uq = supabaseUqStore(sb);
  let { data: profile } = await sb.from("profiles").select("full_name").eq("user_id", data.user.id).maybeSingle();
  let r = profile ? await resolveSpaces(uq, data.user.id).catch(() => null) : null;
  if (!profile || !r) {
    // Signed in but no account yet (signed up before the database setup ran, or the sign-up trigger
    // failed): create the profile, private space and Scout plan now, then carry on.
    const healed = await sb.rpc("ensure_account");
    if (healed.error) {
      console.error("ensure_account failed (have all supabase/migrations been run?)", healed.error.message);
      return null;
    }
    ({ data: profile } = await sb.from("profiles").select("full_name").eq("user_id", data.user.id).maybeSingle());
    r = profile ? await resolveSpaces(uq, data.user.id).catch(() => null) : null;
    if (!profile || !r) return null;
  }
  const admin = process.env.SUPABASE_SERVICE_ROLE_KEY ? supabaseAdmin() : undefined;
  return {
    store: supabaseStore(sb, admin),
    uq,
    orgId: r.space.orgId,
    ...r,
    user: { id: data.user.id, email: data.user.email ?? "", name: (profile.full_name as string) || data.user.email || "", role: r.space.role },
    demo: false,
  };
});

/** For pages: redirect to /login when signed out, with a clear message if the account exists but isn't set up. */
export async function requireContext(): Promise<Ctx> {
  const ctx = await getContext();
  if (ctx) return ctx;
  if (!isDemoMode()) {
    const sb = await supabaseServer();
    const { data } = await sb.auth.getUser();
    // Signed in but no profile/space: the database migrations haven't run, or the sign-up trigger failed.
    if (data.user) redirect("/login?error=account_setup");
  }
  redirect("/login");
}

/** Store for unauthenticated server paths (the Stripe webhook). */
export function getAdminStore(): Store {
  if (isDemoMode()) return memoryStore;
  const admin = supabaseAdmin();
  return supabaseStore(admin, admin);
}
