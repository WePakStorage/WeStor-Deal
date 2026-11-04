import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isDemoMode } from "../env";
import { DEMO_ORG_ID, DEMO_USER_ID, memoryStore } from "../data/memory";
import { supabaseStore } from "../data/supabase-store";
import type { Store } from "../data/store";
import { supabaseAdmin, supabaseServer } from "../supabase/server";
import type { Profile } from "../types";

export interface Ctx {
  store: Store;
  orgId: string;
  user: { id: string; email: string; name: string; role: Profile["role"] };
  demo: boolean;
}

/** Resolve the signed-in user, their org and a store. Null when signed out. */
export const getContext = cache(async (): Promise<Ctx | null> => {
  if (isDemoMode()) {
    return {
      store: memoryStore,
      orgId: DEMO_ORG_ID,
      user: { id: DEMO_USER_ID, email: "demo@westor.app", name: "Sheldrick Redwine", role: "owner" },
      demo: true,
    };
  }
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await sb.from("profiles").select("org_id, full_name, role").eq("user_id", data.user.id).maybeSingle();
  if (!profile) return null;
  const admin = process.env.SUPABASE_SERVICE_ROLE_KEY ? supabaseAdmin() : undefined;
  return {
    store: supabaseStore(sb, admin),
    orgId: profile.org_id as string,
    user: { id: data.user.id, email: data.user.email ?? "", name: (profile.full_name as string) || data.user.email || "", role: profile.role as Profile["role"] },
    demo: false,
  };
});

/** For pages: redirect to /login when signed out. */
export async function requireContext(): Promise<Ctx> {
  const ctx = await getContext();
  if (!ctx) redirect("/login");
  return ctx;
}

/** Store for unauthenticated server paths (webhooks, inbound email). */
export function getAdminStore(): Store {
  if (isDemoMode()) return memoryStore;
  const admin = supabaseAdmin();
  return supabaseStore(admin, admin);
}
