"use client";

import * as React from "react";
import Link from "next/link";
import { Button, Field, Input } from "@/components/ui/primitives";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { authMessage, passwordProblem } from "@/lib/auth-messages";

export function ResetForm() {
  const [pw, setPw] = React.useState("");
  const [pw2, setPw2] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [hasSession, setHasSession] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    supabaseBrowser().auth.getUser().then(({ data }) => setHasSession(!!data.user)).catch(() => setHasSession(false));
  }, []);

  if (hasSession === false) {
    return (
      <div className="mt-6 space-y-3 text-sm">
        <p>This reset link has expired or was already used.</p>
        <Button asChild className="w-full"><Link href="/login">Request a new link</Link></Button>
      </div>
    );
  }

  return (
    <form
      className="mt-6 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        const p = passwordProblem(pw);
        if (p) return setError(p);
        if (pw !== pw2) return setError("The two passwords don't match.");
        setBusy(true);
        const { error: err } = await supabaseBrowser().auth.updateUser({ password: pw });
        setBusy(false);
        if (err) return setError(authMessage(err.message));
        window.location.assign("/app");
      }}
    >
      <Field label="New password" htmlFor="pw" hint="At least 8 characters, with letters and a number.">
        <Input id="pw" type="password" autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
      </Field>
      <Field label="Confirm new password" htmlFor="pw2">
        <Input id="pw2" type="password" autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} />
      </Field>
      <Button type="submit" className="w-full" size="lg" disabled={busy || hasSession === null}>{busy ? "Saving…" : "Save password and continue"}</Button>
      {error ? <p role="alert" className="text-sm text-stop">{error}</p> : null}
    </form>
  );
}
