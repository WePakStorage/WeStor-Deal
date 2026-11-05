import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refresh the Supabase session cookie, guard /app, and make sign-in land on the dashboard:
 * - A sign-in code that arrives on any page (Supabase falls back to the Site URL when a redirect URL
 *   isn't allow-listed) is forwarded to /auth/callback instead of being ignored.
 * - Signed-in visitors on "/" or "/login" go straight to /app.
 * No-op in demo mode.
 */
export async function middleware(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.next();
  const path = req.nextUrl.pathname;
  const params = req.nextUrl.searchParams;

  // 1. Stray sign-in codes and link errors → the callback / login page.
  if (path !== "/auth/callback") {
    if (params.get("code")) {
      const to = req.nextUrl.clone();
      to.pathname = "/auth/callback";
      if (!to.searchParams.get("next")) to.searchParams.set("next", "/app");
      return NextResponse.redirect(to);
    }
    const linkError = params.get("error_description");
    if (linkError && path !== "/login") {
      const to = req.nextUrl.clone();
      to.pathname = "/login";
      to.search = `?error=${encodeURIComponent(linkError)}`;
      return NextResponse.redirect(to);
    }
  }

  // The landing page is public: skip the auth round-trip for visitors without a session cookie.
  const hasSessionCookie = req.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (path === "/" && !hasSessionCookie) return NextResponse.next();

  let res = NextResponse.next({ request: req });
  const sb = createServerClient(url, anon, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        for (const c of list) req.cookies.set(c.name, c.value);
        res = NextResponse.next({ request: req });
        for (const c of list) res.cookies.set(c.name, c.value, c.options);
      },
    },
  });
  const { data } = await sb.auth.getUser();

  if (!data.user && path.startsWith("/app")) {
    const to = req.nextUrl.clone();
    to.pathname = "/login";
    to.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(to);
  }
  // 2. Already signed in: skip the landing and login pages. (Not when /login is showing an error,
  // e.g. "account isn't set up yet", or that message could never be seen.)
  if (data.user && (path === "/" || (path === "/login" && !params.get("error")))) {
    const next = params.get("next");
    const to = req.nextUrl.clone();
    to.pathname = next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
    to.search = "";
    return NextResponse.redirect(to);
  }
  return res;
}

export const config = { matcher: ["/", "/app/:path*", "/auth/:path*", "/login", "/reset-password"] };
