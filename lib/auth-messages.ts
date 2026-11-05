/** Turn Supabase Auth errors into plain sentences. Unknown errors pass through unchanged. */
export function authMessage(raw: string | undefined | null): string {
  const m = (raw ?? "").toLowerCase();
  if (!m) return "Something went wrong. Try again.";
  if (m === "account_setup") return "You're signed in, but your account isn't set up yet. The site owner needs to run the database setup (supabase/migrations). Then sign in again.";
  if (m.includes("invalid login credentials")) return "Wrong email or password.";
  if (m.includes("email not confirmed")) return "Confirm your email first. Check your inbox for the link, or send it again below.";
  if (m.includes("user already registered") || m.includes("already been registered")) return "That email already has an account. Sign in instead.";
  if (m.includes("password should be") || m.includes("weak password") || m.includes("password is too")) return "Use a stronger password: at least 8 characters with letters and numbers.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes")) return "Too many tries. Wait a minute and try again.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) return "New sign-ups are turned off right now.";
  if (m.includes("same password") || m.includes("different from the old")) return "Choose a password you haven't used before.";
  if (m.includes("expired") || m.includes("invalid") && m.includes("link")) return "That link has expired. Request a new one.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Couldn't reach the sign-in service. Check your connection.";
  return raw!;
}

/** Client-side password rule, matched to the Supabase setting we recommend (min 8). */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return "Use at least 8 characters.";
  if (!/[a-z]/i.test(pw) || !/\d/.test(pw)) return "Use letters and at least one number.";
  return null;
}

/** Only allow same-site relative redirects after sign-in. */
export function safeNext(next: string | null | undefined, fallback = "/app"): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}
