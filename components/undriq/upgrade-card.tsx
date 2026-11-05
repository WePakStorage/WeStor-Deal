"use client";

import { Lock } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { useApp } from "@/components/shell/app-provider";
import { PLANS, type PaidPlan } from "@/lib/billing/plans";

/** Shown in place of a page the active space's plan doesn't include. The server sends no data with it. */
export function UpgradeCard({ title, body, min }: { title: string; body: string; min: PaidPlan }) {
  const { openUpgrade, spaceKind } = useApp();
  return (
    <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-line bg-surface p-8 text-center shadow-panel">
      <div className="mx-auto grid size-11 place-items-center rounded-full bg-raised"><Lock className="size-5" /></div>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted">{body}</p>
      {spaceKind === "team" ? <p className="mt-2 text-xs text-muted">This team space runs on its owner&apos;s plan.</p> : null}
      <Button className="mt-5" onClick={() => openUpgrade(`${title} comes with ${PLANS[min].name} and up.`, min)}>See {PLANS[min].name} and up</Button>
    </div>
  );
}
