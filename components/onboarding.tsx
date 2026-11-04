"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Circle, X } from "lucide-react";

export function Onboarding({ steps }: { steps: { id: string; label: string; href: string; done: boolean }[] }) {
  const [hidden, setHidden] = React.useState(true);
  React.useEffect(() => {
    try {
      setHidden(localStorage.getItem("westor-onboarding-hidden") === "1");
    } catch {
      setHidden(false);
    }
  }, []);
  const doneCount = steps.filter((s) => s.done).length;
  if (hidden || doneCount === steps.length) return null;
  return (
    <div className="mb-6 rounded-2xl border border-line bg-gradient-to-r from-door/[0.06] via-transparent to-gold/[0.05] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-medium">Get set up</div>
          <p className="text-sm text-muted">{doneCount} of {steps.length} done. Three steps to your first underwritten, matched deal.</p>
        </div>
        <button
          aria-label="Hide setup checklist"
          className="rounded-md p-1 text-muted hover:bg-raised hover:text-text"
          onClick={() => {
            setHidden(true);
            try { localStorage.setItem("westor-onboarding-hidden", "1"); } catch { /* ignore */ }
          }}
        >
          <X className="size-4" />
        </button>
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-3">
        {steps.map((s) => (
          <li key={s.id}>
            <Link href={s.href} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface/70 px-3.5 py-3 text-sm transition hover:border-muted/50">
              {s.done ? <CheckCircle2 className="size-4 shrink-0 text-go" /> : <Circle className="size-4 shrink-0 text-muted" />}
              <span className={s.done ? "text-muted line-through" : ""}>{s.label}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
