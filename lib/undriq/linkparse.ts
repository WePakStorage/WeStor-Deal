/**
 * Read what a listing URL itself says (site, street, city, state, zip, a guess at the asset class).
 * UndrIq never fetches or scrapes listing sites. The user pastes the listing text or uploads the OM;
 * this only pre-fills the address fields from the link.
 */
import type { AssetClass } from "./assets";

export const STATE_NAMES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY",
  louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new-hampshire": "NH", "new-jersey": "NJ", "new-mexico": "NM", "new-york": "NY",
  "north-carolina": "NC", "north-dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode-island": "RI",
  "south-carolina": "SC", "south-dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA",
  washington: "WA", "west-virginia": "WV", wisconsin: "WI", wyoming: "WY", "district-of-columbia": "DC",
};
const STATE_CODES = new Set(Object.values(STATE_NAMES));
const STREET_SUFFIX =
  /^(st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|boulevard|ct|court|way|pl|place|cir|circle|pkwy|parkway|hwy|highway|ter|terrace|trl|trail|loop|run|pike|row|sq|square|cv|cove|xing|crossing|path|aly|alley|bnd|bend|plz|plaza|tpke|turnpike)$/i;
const DIRS = /^(n|s|e|w|ne|nw|se|sw)$/i;
const SITE_NAMES: Record<string, string> = {
  zillow: "Zillow", redfin: "Redfin", realtor: "Realtor.com", trulia: "Trulia", loopnet: "LoopNet", crexi: "Crexi", homes: "Homes.com", showcase: "Showcase", auction: "Auction.com",
};

const titleCase = (s: string) =>
  s.split(/\s+/).filter(Boolean).map((w) => (/^\d/.test(w) || DIRS.test(w) ? w.toUpperCase() : w[0]!.toUpperCase() + w.slice(1).toLowerCase())).join(" ");

export function guessAsset(text: string): AssetClass | null {
  const t = text.toLowerCase();
  if (/storage|mini-?warehouse|self-?store/.test(t)) return "storage";
  if (/warehouse|industrial|flex|distribution|logistics|manufactur/.test(t)) return "industrial";
  if (/apartment|multifamily|multi-family|\b\d{2,}-units?\b|units?-apartment/.test(t)) return "multifamily";
  if (/retail|plaza|shopping|strip|office|restaurant|medical|mixed-use|center/.test(t)) return "commercial";
  return null;
}

interface Addr { street: string; city: string; state: string; zip: string | null }

export function splitAddress(tokens: string[]): Addr | null {
  const tk = tokens.filter(Boolean);
  let zip: string | null = null;
  let state: string | null = null;
  if (tk.length && /^\d{5}$/.test(tk[tk.length - 1]!)) zip = tk.pop()!;
  if (tk.length && STATE_CODES.has(tk[tk.length - 1]!.toUpperCase())) state = tk.pop()!.toUpperCase();
  if (!state) return null;
  let cut = -1;
  for (let i = 0; i < tk.length; i++) {
    if (STREET_SUFFIX.test(tk[i]!)) {
      cut = i;
      if (tk[i + 1] && DIRS.test(tk[i + 1]!)) cut = i + 1;
      if (/^(apt|unit|ste|suite|#)$/i.test(tk[cut + 1] ?? "")) cut += 2;
    }
  }
  if (cut < 0) cut = Math.max(0, tk.length - 2);
  const street = tk.slice(0, cut + 1).join(" ");
  const city = tk.slice(cut + 1).join(" ");
  return { street: street ? titleCase(street) : "", city: city ? titleCase(city) : "", state, zip };
}

export interface ParsedLink extends Addr {
  url: string;
  site: string;
  name: string;
  asset: AssetClass | null;
}

export function parseListingUrl(raw: string): ParsedLink | null {
  let u: URL;
  try {
    u = new URL(String(raw).trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const key = Object.keys(SITE_NAMES).find((k) => host.includes(`${k}.`)) ?? null;
  const segs = u.pathname.split("/").filter(Boolean).map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
  const out: ParsedLink = { url: u.href, site: key ? SITE_NAMES[key]! : host, street: "", city: "", state: "", zip: null, name: "", asset: null };
  let a: Addr | null = null;

  if (key === "zillow") {
    const i = segs.findIndex((s) => /homedetails|^b$/i.test(s));
    const slug = (i >= 0 ? segs[i + 1] : undefined) ?? segs.find((s) => /-\w{2}-\d{5}$/i.test(s)) ?? "";
    a = splitAddress(slug.split("-"));
    out.asset = "residential";
  } else if (key === "trulia") {
    const slug = segs.find((s) => /-\w{2}-\d{5}/i.test(s)) ?? "";
    a = splitAddress(slug.replace(/(-\d{5})-\d+$/, "$1").split("-"));
    out.asset = "residential";
  } else if (key === "redfin") {
    const [st, city, slug] = segs;
    const t = (slug ?? "").split("-");
    const zip = /^\d{5}$/.test(t[t.length - 1] ?? "") ? t.pop()! : null;
    if (st && STATE_CODES.has(st.toUpperCase())) a = { street: titleCase(t.join(" ")), city: titleCase((city ?? "").replace(/-/g, " ")), state: st.toUpperCase(), zip };
    out.asset = "residential";
  } else if (key === "realtor") {
    const slug = segs.find((s) => s.includes("_")) ?? "";
    const p = slug.split("_");
    if (p.length >= 4) a = { street: titleCase(p[0]!.replace(/-/g, " ")), city: titleCase(p[1]!.replace(/-/g, " ")), state: p[2]!.toUpperCase(), zip: /^\d{5}$/.test(p[3]!) ? p[3]! : null };
    out.asset = "residential";
  } else if (key === "loopnet") {
    const i = segs.findIndex((s) => /^listing$/i.test(s));
    a = splitAddress((segs[i + 1] ?? "").split("-"));
    out.asset = guessAsset(u.pathname);
  } else if (key === "crexi") {
    const words = (segs.find((s) => /[a-z]-[a-z]/i.test(s) && !/^\d+$/.test(s)) ?? "").toLowerCase();
    const stKey = Object.keys(STATE_NAMES).sort((x, y) => y.length - x.length).find((n) => words.startsWith(`${n}-`) || words === n);
    out.state = stKey ? STATE_NAMES[stKey]! : "";
    const rest = stKey ? words.slice(stKey.length + 1) : words;
    out.name = rest ? titleCase(rest.replace(/-/g, " ")) : "";
    out.asset = guessAsset(words);
  } else {
    const slug = [...segs].sort((x, y) => y.length - x.length)[0] ?? "";
    a = splitAddress(slug.split("-"));
    out.asset = guessAsset(u.pathname);
  }
  if (a) Object.assign(out, a);
  if (!out.name) out.name = out.street ? `${out.street}${out.city ? `, ${out.city}` : ""}` : "";
  return out;
}
