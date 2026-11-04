import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  if (!isDemoMode()) await (await supabaseServer()).auth.signOut();
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
