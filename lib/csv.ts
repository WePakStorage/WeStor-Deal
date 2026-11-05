/** Minimal RFC 4180 CSV writer. */
export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  const cols = columns ?? Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return "";
    let s = Array.isArray(v) ? v.join("; ") : String(v);
    // Spreadsheet formula injection: text starting with = + - @ (or a tab/CR) would run as a formula
    // in Excel/Sheets. Numbers are left alone so negatives stay numeric.
    if (typeof v !== "number" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.split('"').join('""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
}
