import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Let search engines index the marketing pages only; the app, API and auth stay out. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/api", "/auth", "/status", "/reset-password"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
