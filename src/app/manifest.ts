import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — cheapest weekend flights`,
    short_name: SITE_NAME,
    description:
      "Find the cheapest weekend round-trips from your home airport.",
    start_url: "/",
    display: "standalone",
    // Matches --background / the header accent, so the installed splash and
    // address bar don't flash a colour the app never uses.
    background_color: "#14161c",
    theme_color: "#f97316",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
