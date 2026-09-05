import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — cheapest weekend flights`,
    short_name: SITE_NAME,
    // Kept in step with the layout's meta description — the features are the
    // pitch: bridge days, long weekends, meet-up mode.
    description:
      "Cheapest weekend round trips from your home airport — one per weekend, six months ahead. Hunt bridge-day long weekends, or meet a friend flying from another city.",
    start_url: "/",
    display: "standalone",
    // Matches --background / the header accent, so the installed splash and
    // address bar don't flash a colour the app never uses.
    background_color: "#14161c",
    theme_color: "#f97316",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
