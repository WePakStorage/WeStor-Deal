import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-door text-on-door hover:bg-door-strong",
        secondary: "bg-raised text-text border border-line hover:border-muted/60",
        ghost: "text-muted hover:text-text hover:bg-raised",
        danger: "bg-stop/10 text-stop border border-stop/30 hover:bg-stop/15",
        gold: "bg-door text-on-door hover:bg-door-strong",
      },
      size: { sm: "h-8 px-3", md: "h-10 px-4", lg: "h-12 px-6 text-base", icon: "h-9 w-9" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = "Button";

export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("rounded-2xl border border-line bg-surface shadow-panel", className)} {...p} />
);

export const CardHeader = ({ title, description, action, className }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string }) => (
  <div className={cn("flex items-start justify-between gap-4 border-b border-line-soft px-5 py-4", className)}>
    <div className="min-w-0">
      <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
      {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
    </div>
    {action}
  </div>
);

export const Label = ({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn("text-[13px] font-medium text-muted", className)} {...p} />
);

const field =
  "h-10 w-full rounded-lg border border-line bg-raised px-3 text-sm text-text placeholder:text-muted/70 transition-colors hover:border-muted/50 focus-visible:border-door focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-door/30";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(field, className)} {...p} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn(field, "h-auto min-h-24 py-2.5 leading-relaxed", className)} {...p} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => (
  <select ref={ref} className={cn(field, "appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-9", className)}
    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238A9AB5' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
    {...p} />
));
Select.displayName = "Select";

export function Field({ label, htmlFor, hint, children, className }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

const badgeTone = {
  neutral: "bg-raised text-muted border-line",
  door: "bg-door/10 text-door border-door/25",
  go: "bg-go/10 text-go border-go/25",
  amber: "bg-amber/10 text-amber border-amber/30",
  stop: "bg-stop/10 text-stop border-stop/30",
  gold: "bg-gold/10 text-gold border-gold/30",
} as const;

export const Badge = ({ tone = "neutral", className, ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof badgeTone }) => (
  <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", badgeTone[tone], className)} {...p} />
);

export function Stat({ label, value, sub, tone, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "go" | "amber" | "stop"; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-[13px] text-muted">{label}</div>
      <div className={cn("mt-1 truncate text-xl font-semibold tracking-tight tabular", tone === "go" && "text-go", tone === "amber" && "text-amber", tone === "stop" && "text-stop")}>
        {value}
      </div>
      {sub ? <div className="mt-0.5 text-xs text-muted">{sub}</div> : null}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      {icon ? <div className="grid size-11 place-items-center rounded-xl bg-raised text-muted [&_svg]:size-5">{icon}</div> : null}
      <div>
        <div className="font-medium">{title}</div>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{body}</p>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
