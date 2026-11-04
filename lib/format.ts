const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const bad = (n: number | null | undefined): n is null | undefined => n === null || n === undefined || !Number.isFinite(n);

export const money = (n: number | null | undefined) => (bad(n) ? "—" : usd0.format(n));
export const money2 = (n: number | null | undefined) => (bad(n) ? "—" : usd2.format(n));
export const num = (n: number | null | undefined) => (bad(n) ? "—" : int.format(n));
export const pct = (n: number | null | undefined, digits = 2) => (bad(n) ? "—" : `${(n * 100).toFixed(digits)}%`);
export const ratio = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : Number.isFinite(n) ? `${n.toFixed(2)}x` : "No debt";

/** $715K, $1.15M */
export function compactMoney(n: number | null | undefined): string {
  if (bad(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1_000_000) return `$${trimZeros((n / 1_000_000).toFixed(2))}M`;
  if (a >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return usd0.format(n);
}

function trimZeros(s: string): string {
  if (!s.includes(".")) return s;
  let out = s;
  while (out.endsWith("0")) out = out.slice(0, -1);
  if (out.endsWith(".")) out = out.slice(0, -1);
  return out;
}

export const date = (iso: string | null | undefined) =>
  iso
    ? new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return date(iso);
}
