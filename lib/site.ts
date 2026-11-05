/** Public site URL for metadata, robots and sitemap. Production URL from Vercel first, never localhost in production. */
function resolveSiteUrl(): string {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured && !configured.includes("localhost")) return configured.replace(/\/$/, "");
  return "https://undriq.vercel.app";
}

export const SITE_URL = resolveSiteUrl();
export const SITE_NAME = "UndrIq";
export const SITE_TAGLINE = "Underwrite any deal in minutes.";
export const SITE_DESCRIPTION =
  "Paste a listing and get a deal score, five exit strategies with a max price for each, your offer ladder and a ready-to-send LOI. First deal free.";
