"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { Button, Field, Input } from "@/components/ui/primitives";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { authMessage, passwordProblem, safeNext } from "@/lib/auth-messages";
import { cn } from "@/lib/cn";

type Mode = "signin" | "signup" | "forgot" | "link";

export function LoginForm({ demo, next, initialMode = "signin" }: { demo: boolean; next: string; initialMode?: Mode }) {
  const [mode, setMode] = React.useState<Mode>(initialMode);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");

  if (demo) {
    return (
      <div className="mt-6 space-y-3">
        <Button asChild className="w-full" size="lg"><Link href="/app">Enter the demo workspace</Link></Button>
        <p className="text-xs text-muted">Demo mode is on because Supabase keys aren&apos;t set. Email and password sign-in turns on automatically once they are.</p>
      </div>
    );
  }

  const dest = safeNext(next);
  const callback = (to: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(to)}`;
  const go = (m: Mode) => {
    setMode(m);
    setError("");
    setNotice("");
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    const sb = supabaseBrowser();
    const em = email.trim().toLowerCase();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error: err } = await sb.auth.signInWithPassword({ email: em, password });
        if (err) return setError(authMessage(err.message));
        // Full navigation so the server sees the new session cookie.
        window.location.assign(dest);
        return;
      }
      if (mode === "signup") {
        if (name.trim().length < 2) return setError("Enter your name.");
        const p = passwordProblem(password);
        if (p) return setError(p);
        const { data, error: err } = await sb.auth.signUp({ email: em, password, options: { data: { full_name: name.trim() }, emailRedirectTo: callback(dest) } });
        if (err) return setError(authMessage(err.message));
        // Supabase hides "already registered" behind an empty identities list when confirmations are on.
        if (data.user && data.user.identities && data.user.identities.length === 0) return setError(authMessage("User already registered"));
        if (data.session) {
          window.location.assign(dest);
          return;
        }
        setNotice(`Almost done. We sent a confirmation link to ${em}. Open it to finish creating your account.`);
        return;
      }
      if (mode === "forgot") {
        const { error: err } = await sb.auth.resetPasswordForEmail(em, { redirectTo: callback("/reset-password") });
        if (err) return setError(authMessage(err.message));
        setNotice(`If ${em} has an account, a reset link is on its way.`);
        return;
      }
      const { error: err } = await sb.auth.signInWithOtp({ email: em, options: { emailRedirectTo: callback(dest), shouldCreateUser: false } });
      if (err) return setError(authMessage(err.message));
      setNotice(`Check ${em} for your sign-in link.`);
    } catch (e2) {
      setError(authMessage((e2 as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    setBusy(true);
    const { error: err } = await supabaseBrowser().auth.resend({ type: "signup", email: email.trim().toLowerCase(), options: { emailRedirectTo: callback(dest) } });
    setBusy(false);
    if (err) setError(authMessage(err.message));
    else {
      setError("");
      setNotice("Confirmation email sent again.");
    }
  }

  const label = { signin: "Sign in", signup: "Create account", forgot: "Send reset link", link: "Email me a sign-in link" }[mode];

  return (
    <div className="mt-6 space-y-4">
      {mode === "signin" || mode === "signup" ? (
        <div className="grid grid-cols-2 rounded-lg border border-line p-1 text-sm" role="tablist" aria-label="Account">
          {(["signin", "signup"] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => go(m)}
              className={cn("rounded-md py-1.5 font-medium transition", mode === m ? "bg-text text-ink" : "text-muted hover:text-text")}>
              {m === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
      ) : (
        <button type="button" className="text-sm text-muted hover:text-text" onClick={() => go("signin")}>← Back to sign in</button>
      )}

      <form className="space-y-3" onSubmit={submit} noValidate>
        {mode === "signup" ? (
          <Field label="Full name" htmlFor="name">
            <Input id="name" autoComplete="name" required placeholder="Jordan Smith" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        ) : null}
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" required autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {mode === "signin" || mode === "signup" ? (
          <Field label="Password" htmlFor="password" hint={mode === "signup" ? "At least 8 characters, with letters and a number." : undefined}>
            <div className="relative">
              <Input id="password" type={show ? "text" : "password"} required autoComplete={mode === "signup" ? "new-password" : "current-password"} className="pr-10" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-text">
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
        ) : null}
        {mode === "signin" ? (
          <div className="flex justify-end">
            <button type="button" className="text-xs text-muted hover:text-text" onClick={() => go("forgot")}>Forgot password?</button>
          </div>
        ) : null}
        <Button type="submit" className="w-full" size="lg" disabled={busy || !email}>
          {busy ? <Loader2 className="animate-spin" /> : mode === "link" ? <Mail /> : null}
          {busy ? "One moment…" : label}
        </Button>
        {error ? (
          <p role="alert" className="text-sm text-stop">
            {error}
            {error.startsWith("Confirm your email") ? <> <button type="button" className="underline" onClick={resendConfirmation}>Send it again</button></> : null}
          </p>
        ) : null}
        {notice ? <p role="status" className="rounded-xl border border-go/30 bg-go/10 p-3 text-sm">{notice}</p> : null}
      </form>

      {mode === "signin" || mode === "signup" ? (
        <>
          <div className="flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
          <Button variant="secondary" className="w-full" onClick={() => supabaseBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback(dest) } })}>
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12s4.3 9.7 9.7 9.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z"/></svg>
            Continue with Google
          </Button>
          {mode === "signin" ? <button type="button" className="w-full text-center text-xs text-muted hover:text-text" onClick={() => go("link")}>Email me a sign-in link instead</button> : null}
        </>
      ) : null}
    </div>
  );
}
