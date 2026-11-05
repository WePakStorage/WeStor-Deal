"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Crown, KanbanSquare, Layers, Lock, LogOut, Plus, Settings, SlidersHorizontal, Sparkles, User, Users, Zap } from "lucide-react";
import { cn } from "@/lib/cn";
import { PLANS } from "@/lib/billing/plans";
import { switchSpace } from "@/lib/actions/undriq";
import type { Space } from "@/lib/undriq/types";
import type { Plan } from "@/lib/types";
import { useToast } from "@/components/ui/interactive";
import { useApp } from "./app-provider";
import { ThemeToggle } from "./theme-toggle";
import { CommandPalette, type PaletteItem } from "./command-palette";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Zap;
  exact?: boolean;
  min?: Plan;
  mobile?: boolean;
}

const NAV: NavItem[] = [
  { href: "/app", label: "Analyze", icon: Zap, exact: true, mobile: true },
  { href: "/app/pipeline", label: "Pipeline", icon: KanbanSquare, min: "investor", mobile: true },
  { href: "/app/buyers", label: "Buyers", icon: Users, min: "investor", mobile: true },
  { href: "/app/team", label: "Team", icon: Layers, mobile: true },
  { href: "/app/bulk", label: "Bulk analyzer", icon: Sparkles, min: "fund" },
  { href: "/app/rules", label: "Buy box rules", icon: SlidersHorizontal, min: "firm" },
  { href: "/app/settings", label: "Settings", icon: Settings, mobile: true },
];

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--text)" />
        <path d="M10 9v8.5a6 6 0 0 0 12 0V9" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="16" cy="24.5" r="1.6" fill="var(--ink)" />
      </svg>
      <span className="display text-[22px] leading-none">UndrIq</span>
    </span>
  );
}

function useActive() {
  const path = usePathname();
  return (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(`${href}/`));
}

export function SpaceSwitcher({ spaces, active, compact }: { spaces: Space[]; active: Space; compact?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const router = useRouter();
  const toast = useToast();
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const go = (s: Space) =>
    start(async () => {
      setOpen(false);
      if (s.orgId === active.orgId) return;
      const r = await switchSpace(s.orgId);
      if (!r.ok) return toast(r.error, "error");
      toast(s.kind === "personal" ? "Switched to your private space" : `Switched to ${s.name}`);
      router.refresh();
    });
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn("flex w-full items-center gap-2.5 rounded-xl border border-line bg-raised/60 text-left transition hover:border-muted/50", compact ? "px-2.5 py-1.5" : "px-3 py-2.5")}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-text text-ink">{active.kind === "personal" ? <User className="size-3.5" /> : <Users className="size-3.5" />}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{active.kind === "personal" ? "My private space" : active.name}</span>
          {!compact ? <span className="block truncate text-xs text-muted">{active.kind === "personal" ? "Only you can see this" : `Shared team · ${PLANS[active.plan].name}`}</span> : null}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted" />
      </button>
      {open ? (
        <div role="listbox" className="absolute left-0 right-0 top-full z-50 mt-1.5 min-w-60 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-panel animate-in">
          {spaces.map((s) => (
            <button
              key={s.orgId}
              role="option"
              aria-selected={s.orgId === active.orgId}
              type="button"
              disabled={pending}
              onClick={() => go(s)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-raised"
            >
              {s.kind === "personal" ? <User className="size-4 text-muted" /> : <Users className="size-4 text-muted" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{s.kind === "personal" ? "My private space" : s.name}</span>
                <span className="block truncate text-xs text-muted">
                  {s.kind === "personal" ? "Private pipeline and buyers" : `${s.role === "owner" ? "You own this team" : "Team member"} · ${PLANS[s.plan].name}`}
                </span>
              </span>
              {s.orgId === active.orgId ? <Check className="size-4" /> : null}
            </button>
          ))}
          <Link href="/app/team" onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2.5 rounded-lg border-t border-line-soft px-2.5 py-2 text-sm text-muted hover:bg-raised hover:text-text">
            <Plus className="size-4" /> Team spaces
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export function Sidebar({ spaces, space, userName, items, signOut, usage }: { spaces: Space[]; space: Space; userName: string; items: PaletteItem[]; signOut: boolean; usage: { used: number; total: number; period: string } }) {
  const isActive = useActive();
  const { plan, openUpgrade } = useApp();
  const cfg = PLANS[plan];
  const pct = Math.min(100, (usage.used / Math.max(1, usage.total)) * 100);
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface/60 px-3 py-5 lg:flex">
      <Link href="/app" className="px-2">
        <BrandMark />
      </Link>
      <div className="mt-5 px-1">
        <SpaceSwitcher spaces={spaces} active={space} />
      </div>
      <div className="mt-3 px-1">
        <CommandPalette items={items} />
      </div>
      <nav className="mt-3 flex flex-col gap-0.5" aria-label="Main">
        {NAV.map(({ href, label, icon: Icon, exact, min }) => {
          const locked = min && PLANS[plan].rank < PLANS[min].rank;
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href, exact) ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive(href, exact) ? "bg-raised text-text ring-1 ring-line" : "text-muted hover:bg-raised/60 hover:text-text",
              )}
            >
              <Icon className="size-[18px]" />
              <span className="flex-1">{label}</span>
              {locked ? <Lock className="size-3.5 opacity-60" aria-label={`${PLANS[min].name} plan`} /> : null}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-3">
        <div className="rounded-xl border border-line p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">{cfg.name}</span>
            <span className="tabular text-muted">
              {usage.used} / {usage.total.toLocaleString()} {usage.period === "lifetime" ? "free analyses" : "this month"}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-raised">
            <div className="h-full rounded-full bg-text transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          {plan !== "fund" ? (
            <button onClick={() => openUpgrade(undefined, plan === "free" ? "investor" : plan === "investor" ? "firm" : "fund")} className="mt-2.5 flex items-center gap-1.5 text-xs font-medium hover:underline">
              <Crown className="size-3.5" /> {plan === "free" ? "Unlock the full analysis" : "Upgrade"}
            </button>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5">
          <div className="min-w-0 truncate text-sm font-medium">{userName}</div>
          <div className="flex items-center">
            <ThemeToggle />
            {signOut ? (
              <form action="/auth/signout" method="post">
                <button className="rounded-md p-2 text-muted hover:bg-raised hover:text-text" aria-label="Sign out">
                  <LogOut className="size-4" />
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}

export function MobileBar({ items, spaces, space }: { items: PaletteItem[]; spaces: Space[]; space: Space }) {
  const isActive = useActive();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur lg:hidden">
      <div className="flex h-14 items-center justify-between gap-3 px-4">
        <Link href="/app" aria-label="UndrIq home">
          <BrandMark />
        </Link>
        <div className="flex items-center gap-1">
          <CommandPalette items={items} compact />
          <ThemeToggle />
        </div>
      </div>
      <div className="px-4 pb-2">
        <SpaceSwitcher spaces={spaces} active={space} compact />
      </div>
      <nav className="flex justify-between gap-1 px-2 pb-2" aria-label="Main">
        {NAV.filter((n) => n.mobile).map(({ href, label, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href, exact) ? "page" : undefined}
            className={cn("flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] font-medium", isActive(href, exact) ? "bg-raised text-text" : "text-muted")}
          >
            <Icon className="size-[18px]" />
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
