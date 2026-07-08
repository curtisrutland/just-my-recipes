import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/site";

// Web app manifest → served at /manifest.webmanifest, with the <link rel="manifest">
// injected automatically. This is what lets iOS "Add to Home Screen" open the site
// as a standalone app (no offline/service-worker support — see docs/architecture.md).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "Recipes",
    description: "A personal recipe collection. No stories.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf8f2",
    theme_color: "#faf8f2",
    icons: [
      {
        src: "/favicons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/favicons/favicon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
