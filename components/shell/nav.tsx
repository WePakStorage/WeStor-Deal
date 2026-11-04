"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, KanbanSquare, Radar, Settings, Users, Sparkles, LogOut } from "lucide-react";
import { cn } from "@/lib/cn";
import { useApp } from "./app-provider";
import { ThemeToggle } from "./theme-toggle";
import { CommandPalette, type PaletteItem } from "./command-palette";

const NAV = [
  { href: "/app", label: "Pipeline", icon: KanbanSquare, exact: true },
  { href: "/app/deals", label: "Deals", icon: Building2 },
  { href: "/app/buyers", label: "Buyers", icon: Users },
  { href: "/app/sourcing", label: "Sourcing", icon: Radar },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--raised)" stroke="var(--gold)" strokeOpacity=".55" />
        <path d="M8 13.5 16 8l8 5.5V24H8z" fill="none" stroke="var(--gold)" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M11.5 24v-7h9v7M11.5 19.5h9M11.5 22h9" stroke="var(--gold)" strokeWidth="1.3" />
      </svg>
      <span className="leading-none">
        <span className="block text-[15px] font-semibold tracking-tight">WeStor</span>
        <span className="block text-[11px] text-muted">DealFlow</span>
      </span>
    </span>
  );
}

function useActive() {
  const path = usePathname();
  return (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(`${href}/`));
}

export function Sidebar({ orgName, userName, items, signOut }: { orgName: string; userName: string; items: PaletteItem[]; signOut: boolean }) {
  const isActive = useActive();
  const { isPro, openUpgrade } = useApp();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface/60 px-3 py-5 lg:flex">
      <Link href="/app" className="px-2">
        <BrandMark />
      </Link>
      <div className="mt-6 px-1">
        <CommandPalette items={items} />
      </div>
      <nav className="mt-4 flex flex-col gap-0.5" aria-label="Main">
        {NAV.map(({ href, label, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href, exact) ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive(href, exact) ? "bg-raised text-text ring-1 ring-line" : "text-muted hover:bg-raised/60 hover:text-text",
            )}
          >
            <Icon className={cn("size-[18px]", isActive(href, exact) && "text-door")} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto space-y-3">
        {!isPro ? (
          <button onClick={() => openUpgrade()} className="w-full rounded-xl border border-gold/30 bg-gradient-to-b from-gold/10 to-transparent p-3.5 text-left transition hover:border-gold/50">
            <div className="flex items-center gap-2 text-sm font-medium text-gold">
              <Sparkles className="size-4" /> WeStor Pro
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">Live underwriting, OM reader, buyer matching and OMs.</p>
          </button>
        ) : null}
        <div className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{userName}</div>
            <div className="truncate text-xs text-muted">
              {orgName} · {isPro ? <span className="text-gold">Pro</span> : "Free"}
            </div>
          </div>
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

export function MobileBar({ items }: { items: PaletteItem[] }) {
  const isActive = useActive();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur lg:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/app">
          <BrandMark />
        </Link>
        <div className="flex items-center gap-1">
          <CommandPalette items={items} compact />
          <ThemeToggle />
        </div>
      </div>
      <nav className="flex justify-between gap-1 px-2 pb-2" aria-label="Main">
        {NAV.map(({ href, label, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={isActive(href, exact) ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] font-medium",
              isActive(href, exact) ? "bg-raised text-text" : "text-muted",
            )}
          >
            <Icon className={cn("size-[18px]", isActive(href, exact) && "text-door")} />
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
