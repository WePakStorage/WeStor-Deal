import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth-messages";

const OTP_TYPES = new Set<EmailOtpType>(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);

/**
 * Lands every emailed link (confirm sign-up, magic link, password reset) and Google sign-in.
 * Supports both the PKCE `code` link and the `token_hash` + `type` link used by custom email templates.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  let next = safeNext(url.searchParams.get("next"));
  const fail = (msg: string) => NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, url.origin));

  const linkError = url.searchParams.get("error_description");
  if (linkError) return fail(linkError);

  const sb = await supabaseServer();
  if (code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) return fail(error.message);
  } else if (tokenHash && type && OTP_TYPES.has(type)) {
    const { error } = await sb.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return fail(error.message);
    if (type === "recovery") next = "/reset-password";
  } else {
    return fail("That link is missing its code. Request a new one.");
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
