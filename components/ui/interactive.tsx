"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as SliderPrimitive from "@radix-ui/react-slider";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { CheckCircle2, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";

/* ───────────── Dialog */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({ title, description, children, className, wide }: { title: string; description?: string; children: React.ReactNode; className?: string; wide?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#060b14]/70 backdrop-blur-sm data-[state=open]:animate-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-panel focus:outline-none data-[state=open]:animate-in",
          wide ? "max-w-2xl" : "max-w-md",
          className,
        )}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <DialogPrimitive.Title className="text-lg font-semibold tracking-tight">{title}</DialogPrimitive.Title>
            {description ? <DialogPrimitive.Description className="mt-1 text-sm text-muted">{description}</DialogPrimitive.Description> : <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>}
          </div>
          <DialogPrimitive.Close className="rounded-md p-1 text-muted hover:bg-raised hover:text-text" aria-label="Close">
            <X className="size-4" />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/* ───────────── Slider */
export function Slider({ label, value, onChange, min, max, step, className, size = "md", format }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  className?: string;
  size?: "md" | "lg";
  format?: (v: number) => string;
}) {
  return (
    <SliderPrimitive.Root
      className={cn("relative flex w-full touch-none select-none items-center", size === "lg" ? "h-8" : "h-6", className)}
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(v) => onChange(v[0] ?? value)}
      aria-label={label}
    >
      <SliderPrimitive.Track className={cn("relative grow overflow-hidden rounded-full bg-raised ring-1 ring-line", size === "lg" ? "h-2.5" : "h-1.5")}>
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-gradient-to-r from-door/70 to-door" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={label}
        aria-valuetext={format ? format(value) : undefined}
        className={cn(
          "block rounded-full border-2 border-door bg-white shadow-[0_0_0_6px_var(--glow)] transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-door/40",
          size === "lg" ? "size-6" : "size-4",
        )}
      />
    </SliderPrimitive.Root>
  );
}

/* ───────────── Segmented control */
export function Segmented<T extends string | number>({ label, value, options, onChange, className }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-lg border border-line bg-raised p-0.5", className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
            o.value === value ? "bg-surface text-text shadow-sm ring-1 ring-line" : "text-muted hover:text-text",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ───────────── Tabs */
export const Tabs = TabsPrimitive.Root;
export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TabsPrimitive.List className={cn("flex gap-1 overflow-x-auto border-b border-line", className)}>
      {children}
    </TabsPrimitive.List>
  );
}
export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className="relative -mb-px flex items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 pb-3 pt-1 text-sm font-medium text-muted transition-colors hover:text-text data-[state=active]:border-door data-[state=active]:text-text [&_svg]:size-4"
    >
      {children}
    </TabsPrimitive.Trigger>
  );
}
export const TabsContent = ({ className, ...p }: React.ComponentProps<typeof TabsPrimitive.Content>) => (
  <TabsPrimitive.Content className={cn("pt-6 focus-visible:outline-none", className)} {...p} />
);

/* ───────────── Toasts */
type Toast = { id: number; title: string; tone: "ok" | "error" };
const ToastCtx = React.createContext<(title: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => React.useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const push = React.useCallback((title: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, title, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex animate-in items-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 text-sm shadow-panel">
            {t.tone === "ok" ? <CheckCircle2 className="size-4 text-go" /> : <AlertTriangle className="size-4 text-stop" />}
            {t.title}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
