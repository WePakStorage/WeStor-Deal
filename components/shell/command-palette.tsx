"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Building2, Plus, Search, Users } from "lucide-react";

export interface PaletteItem {
  id: string;
  kind: "deal" | "buyer";
  label: string;
  sub: string;
  href: string;
}

export function CommandPalette({ items, compact }: { items: PaletteItem[]; compact?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      {compact ? (
        <button onClick={() => setOpen(true)} className="rounded-md p-2 text-muted hover:bg-raised hover:text-text" aria-label="Search deals and buyers">
          <Search className="size-4" />
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-raised/70 px-3 text-sm text-muted transition hover:border-muted/50 hover:text-text"
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">Jump to…</span>
          <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[11px] font-medium">⌘K</kbd>
        </button>
      )}
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#060b14]/70 backdrop-blur-sm" />
          <DialogPrimitive.Content className="fixed left-1/2 top-[14vh] z-50 w-[calc(100vw-32px)] max-w-xl -translate-x-1/2 animate-in overflow-hidden rounded-2xl border border-line bg-surface shadow-panel">
            <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">Jump to any deal or buyer</DialogPrimitive.Description>
            <Command loop className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted">
              <div className="flex items-center gap-3 border-b border-line px-4">
                <Search className="size-4 text-muted" />
                <Command.Input autoFocus placeholder="Search deals, markets and buyers" className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted" />
              </div>
              <Command.List className="max-h-[50vh] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-8 text-center text-sm text-muted">No matches. Try a city or firm name.</Command.Empty>
                <Command.Group heading="Actions">
                  <Row onSelect={() => go("/app/deals/new")} icon={<Plus />} label="Add a deal" sub="Manual entry or OM upload" />
                  <Row onSelect={() => go("/app/buyers")} icon={<Users />} label="Open buyer CRM" sub="Buy boxes and matching" />
                </Command.Group>
                <Command.Group heading="Deals">
                  {items.filter((i) => i.kind === "deal").map((i) => (
                    <Row key={i.id} value={`${i.label} ${i.sub}`} onSelect={() => go(i.href)} icon={<Building2 />} label={i.label} sub={i.sub} />
                  ))}
                </Command.Group>
                <Command.Group heading="Buyers">
                  {items.filter((i) => i.kind === "buyer").map((i) => (
                    <Row key={i.id} value={`${i.label} ${i.sub}`} onSelect={() => go(i.href)} icon={<Users />} label={i.label} sub={i.sub} />
                  ))}
                </Command.Group>
              </Command.List>
            </Command>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}

function Row({ icon, label, sub, onSelect, value }: { icon: React.ReactNode; label: string; sub: string; onSelect: () => void; value?: string }) {
  return (
    <Command.Item
      value={value ?? label}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm data-[selected=true]:bg-raised [&_svg]:size-4 [&_svg]:text-muted"
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      <span className="truncate text-xs text-muted">{sub}</span>
    </Command.Item>
  );
}
