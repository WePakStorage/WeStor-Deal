"use client";

import * as React from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { Button, Field, Input } from "@/components/ui/primitives";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function LoginForm({ demo, next }: { demo: boolean; next: string }) {
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = React.useState("");

  if (demo) {
    return (
      <div className="mt-6 space-y-3">
        <Button asChild className="w-full" size="lg"><Link href="/app">Enter the demo workspace</Link></Button>
        <p className="text-xs text-muted">Demo mode is on because Supabase keys aren&apos;t set. Magic link and Google sign-in turn on automatically once they are.</p>
      </div>
    );
  }

  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  return (
    <div className="mt-6 space-y-4">
      <Button
        variant="secondary"
        className="w-full"
        size="lg"
        onClick={() => supabaseBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo } })}
      >
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12s4.3 9.7 9.7 9.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z"/></svg>
        Continue with Google
      </Button>
      <div className="flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      {state === "sent" ? (
        <div className="rounded-xl border border-go/30 bg-go/10 p-4 text-sm">Check <b>{email}</b> for your sign-in link.</div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setState("sending");
            const { error } = await supabaseBrowser().auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
            if (error) {
              setError(error.message);
              setState("error");
            } else setState("sent");
          }}
        >
          <Field label="Work email" htmlFor="email">
            <Input id="email" type="email" required autoComplete="email" placeholder="you@firm.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full" size="lg" disabled={state === "sending"}>
            <Mail /> {state === "sending" ? "Sending…" : "Email me a sign-in link"}
          </Button>
          {state === "error" ? <p className="text-sm text-stop">{error}</p> : null}
        </form>
      )}
    </div>
  );
}
