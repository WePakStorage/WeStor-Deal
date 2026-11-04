import type { SourcingCandidate } from "../data/store";

/** National brands and REITs: unlikely to sell off-market to a small buyer. */
const INSTITUTIONAL = [
  "public storage", "extra space", "cubesmart", "life storage", "u-haul", "uhaul", "amerco", "national storage", "storagemart",
  "storage king", "simply self storage", "prime storage", "sroa", "storage rentals of america", "morningstar", "west coast self",
  "devon self", "stor-all", "safeguard", "storquest", "william warren", "global self storage", "smartstop", "strategic storage",
  "reit", "real estate investment trust", "ps business", "shurgard",
];

export type OwnerType = SourcingCandidate["owner_type"];

export function classifyOwner(name: string): OwnerType {
  const n = ` ${name.toLowerCase().replace(/[.,]/g, " ")} `;
  if (INSTITUTIONAL.some((k) => n.includes(k))) return "institutional";
  if (/\b(llc|l l c|lp|llp|ltd|inc|corp|co|company|partners|properties|holdings|investments|trust)\b/.test(n)) return "small_llc";
  return "individual";
}

export interface CountyRow {
  parcel_id: string;
  owner_name: string;
  situs_city: string;
  situs_state: string;
  building_sf: number | null;
  year_built: number | null;
  years_owned: number | null;
  tax_delinquent: boolean;
  lat: number | null;
  lng: number | null;
}

/**
 * Owner-motivation score, 0–100:
 * owner type (individual 30, small LLC 20, institutional 0),
 * years owned (≥15: 25, 10–14: 18, 5–9: 10), year built (<1990: 15, <2005: 10, else 3),
 * building SF in 15K–80K (20), tax delinquent (10).
 */
export function scoreFacility(r: CountyRow): { score: number; reasons: string[]; owner_type: OwnerType } {
  const reasons: string[] = [];
  let score = 0;
  const owner_type = classifyOwner(r.owner_name);
  if (owner_type === "individual") { score += 30; reasons.push("Individual owner"); }
  else if (owner_type === "small_llc") { score += 20; reasons.push("Small LLC or partnership"); }
  else reasons.push("Institutional or national brand");

  if (r.years_owned !== null) {
    if (r.years_owned >= 15) { score += 25; reasons.push(`Owned ${Math.floor(r.years_owned)} years`); }
    else if (r.years_owned >= 10) { score += 18; reasons.push(`Owned ${Math.floor(r.years_owned)} years`); }
    else if (r.years_owned >= 5) score += 10;
  }
  if (r.year_built !== null) {
    if (r.year_built < 1990) { score += 15; reasons.push(`Built ${r.year_built}`); }
    else if (r.year_built < 2005) score += 10;
    else score += 3;
  }
  if (r.building_sf !== null && r.building_sf >= 15_000 && r.building_sf <= 80_000) { score += 20; reasons.push(`${r.building_sf.toLocaleString("en-US")} SF, in the sweet spot`); }
  if (r.tax_delinquent) { score += 10; reasons.push("Tax delinquent"); }
  return { score: Math.min(100, score), reasons, owner_type };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const pick = (row: Record<string, string>, keys: string[]): string => {
  for (const [k, v] of Object.entries(row)) if (keys.includes(norm(k))) return (v ?? "").trim();
  return "";
};
const numOrNull = (s: string) => {
  const n = Number(s.replace(/[$,\s]/g, ""));
  return s && Number.isFinite(n) ? n : null;
};

/** Normalise an appraisal-district CSV row. Column names vary by county; common aliases are covered. */
export function parseCountyRow(row: Record<string, string>, state: string, now = new Date()): (CountyRow & { use: string }) | null {
  const owner = pick(row, ["ownername", "owner", "owner1", "name"]);
  if (!owner) return null;
  const deed = pick(row, ["deeddate", "saledate", "lastsaledate", "acquireddate", "recordingdate"]);
  const deedYear = deed ? new Date(deed).getFullYear() : NaN;
  const yearsOwnedCol = numOrNull(pick(row, ["yearsowned"]));
  return {
    parcel_id: pick(row, ["parcelid", "propid", "accountnumber", "account", "pin", "apn", "parcel"]),
    owner_name: owner,
    situs_city: pick(row, ["situscity", "city", "propertycity"]),
    situs_state: (pick(row, ["situsstate", "state"]) || state).toUpperCase().slice(0, 2),
    building_sf: numOrNull(pick(row, ["buildingsf", "bldgsf", "improvementsf", "livingarea", "sqft", "buildingarea", "grossarea"])),
    year_built: numOrNull(pick(row, ["yearbuilt", "yrbuilt", "effectiveyearbuilt"])),
    years_owned: yearsOwnedCol ?? (Number.isFinite(deedYear) ? now.getFullYear() - deedYear : null),
    tax_delinquent: /^(y|yes|true|1|x)$/i.test(pick(row, ["taxdelinquent", "delinquent", "delinquency"])),
    lat: numOrNull(pick(row, ["lat", "latitude", "y"])),
    lng: numOrNull(pick(row, ["lng", "lon", "long", "longitude", "x"])),
    use: pick(row, ["usecode", "propertyuse", "landuse", "usedescription", "statecode", "propertyclass"]),
  };
}

/** Mini-warehouse / self-storage use codes and descriptions. */
export const isStorageUse = (use: string, codes: string[]) =>
  !use || codes.some((c) => c && use.toLowerCase() === c.toLowerCase()) || /stor|mini.?ware/i.test(use);

/** Hook for a future paid skip-tracing add-on. Not implemented in v1. */
export interface SkipTraceProvider {
  lookup(input: { owner_name: string; mailing_address?: string }): Promise<{ phones: string[]; emails: string[] }>;
}
