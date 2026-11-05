import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION } from "@/lib/site";

/** "Add to Home Screen" opens UndrIq full-screen like an app, straight into the analyzer. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "UndrIq",
    short_name: "UndrIq",
    description: SITE_DESCRIPTION,
    start_url: "/app",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
