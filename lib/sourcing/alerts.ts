import { z } from "zod";

const money = z.preprocess((v) => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "string") {
    const n = Number(v.replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return v;
}, z.number().finite().nullable());

export const alertSchema = z.object({
  listings: z.array(
    z.object({
      name: z.string().min(1),
      city: z.string().nullable(),
      state: z.string().nullable(),
      price: money,
      units: money,
      nrsf: money,
      noi: money,
      cap_rate_pct: money,
      url: z.string().nullable(),
    }),
  ),
});
export type ParsedAlert = z.infer<typeof alertSchema>;

export const ALERT_SYSTEM = `You read listing-alert emails (Crexi, LoopNet and similar) forwarded by a self-storage acquisitions team.
Return only JSON: {"listings":[{"name","city","state" (2-letter),"price","units","nrsf","noi","cap_rate_pct","url"}]}.
Include only self-storage, mini-storage, or RV/boat storage listings. Use numbers without $ or commas, and null when a value isn't in the email. Never invent values.`;

/**
 * Deterministic fallback parser for when no AI key is set. Handles the common
 * "Name / City, ST / $Price / N units / X% cap / link" alert layout.
 */
export function parseAlertHeuristic(text: string): ParsedAlert {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const listings: ParsedAlert["listings"] = [];
  for (const b of blocks) {
    // A listing block mentions storage and carries a price; skips headers and footers.
    if (!/stor/i.test(b) || !/\$\s?\d/.test(b)) continue;
    const lines = b.split("\n").map((l) => l.trim()).filter(Boolean);
    const name = lines.find((l) => /stor/i.test(l) && !/^https?:/i.test(l))?.replace(/^[-*•\s]+/, "");
    if (!name) continue;
    const loc = b.match(/([A-Z][A-Za-z .'-]+),\s*([A-Z]{2})\b/);
    const price = b.match(/\$\s?([\d,.]+)\s*(M|K|million)?/i);
    const toNum = (m: RegExpMatchArray | null) => {
      if (!m?.[1]) return null;
      const n = Number(m[1].replace(/,/g, ""));
      const mult = /^m/i.test(m[2] ?? "") ? 1_000_000 : /^k/i.test(m[2] ?? "") ? 1_000 : 1;
      return Number.isFinite(n) ? n * mult : null;
    };
    const units = b.match(/([\d,]+)\s*units/i);
    const nrsf = b.match(/([\d,]+)\s*(?:nrsf|rsf|sf|sq\.?\s?ft)/i);
    const noi = b.match(/NOI[:\s]*\$\s?([\d,.]+)\s*(M|K)?/i);
    const cap = b.match(/([\d.]+)\s*%\s*cap/i);
    const url = b.match(/https?:\/\/\S+/);
    listings.push({
      name,
      city: loc?.[1]?.trim() ?? null,
      state: loc?.[2] ?? null,
      price: toNum(price),
      units: units?.[1] ? Number(units[1].replace(/,/g, "")) : null,
      nrsf: nrsf?.[1] ? Number(nrsf[1].replace(/,/g, "")) : null,
      noi: toNum(noi),
      cap_rate_pct: cap?.[1] ? Number(cap[1]) : null,
      url: url?.[0] ?? null,
    });
  }
  return { listings };
}

/** Pull the org token out of alerts+TOKEN@domain. */
export function inboundToken(addresses: string[]): string | null {
  for (const a of addresses) {
    const m = a.match(/alerts\+([a-z0-9-]+)@/i);
    if (m?.[1]) return m[1];
  }
  return null;
}
