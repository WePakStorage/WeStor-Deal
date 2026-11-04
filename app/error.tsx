"use client";

import { Button } from "@/components/ui/primitives";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-[60dvh] place-items-center px-4 text-center">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 max-w-md text-muted">Your data is safe. Try again, and if it keeps happening, send us the reference below.</p>
        {error.digest ? <code className="mt-3 inline-block rounded bg-raised px-2 py-1 text-xs text-muted">{error.digest}</code> : null}
        <div className="mt-6"><Button onClick={reset}>Try again</Button></div>
      </div>
    </div>
  );
}
