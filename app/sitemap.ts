import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: [string, number][] = [["", 1], ["/pricing", 0.9], ["/login", 0.5], ["/terms", 0.2], ["/privacy", 0.2]];
  return pages.map(([path, priority]) => ({ url: `${SITE_URL}${path}`, changeFrequency: "weekly", priority }));
}
