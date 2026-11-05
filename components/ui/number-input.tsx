"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { Input } from "./primitives";

/** Number field that shows thousands separators and returns number | null. */
export function NumberInput({ value, onChange, prefix, suffix, className, decimals = 0, grouping = true, ...rest }: {
  value: number | null;
  onChange: (v: number | null) => void;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  /** false for years and IDs: no thousands separator */
  grouping?: boolean;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "prefix">) {
  const fmt = React.useCallback((n: number | null) => (n === null ? "" : n.toLocaleString("en-US", { maximumFractionDigits: decimals, useGrouping: grouping })), [decimals, grouping]);
  const [text, setText] = React.useState(fmt(value));
  const [focused, setFocused] = React.useState(false);
  React.useEffect(() => {
    if (!focused) setText(fmt(value));
  }, [value, focused, fmt]);

  return (
    <div className={cn("relative", className)}>
      {prefix ? <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">{prefix}</span> : null}
      <Input
        {...rest}
        inputMode="decimal"
        value={text}
        className={cn("tabular", prefix && "pl-7", suffix && "pr-8")}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setText(fmt(value));
        }}
        onChange={(e) => {
          setText(e.target.value);
          const raw = e.target.value.replace(/[^0-9.-]/g, "");
          if (raw === "" || raw === "-") return onChange(null);
          const n = Number(raw);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
      {suffix ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{suffix}</span> : null}
    </div>
  );
}
