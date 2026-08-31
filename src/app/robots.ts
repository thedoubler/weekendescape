import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Preview deployments must not be indexed. Vercel gives every branch a public
// URL, and without this they compete with production for the same queries and
// leak half-finished copy into search results.
const isProduction =
  process.env.VERCEL_ENV === "production" || !process.env.VERCEL;

export default function robots(): MetadataRoute.Robots {
  if (!isProduction) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The API returns live per-request flight data. It is not a page, it
        // costs an upstream call to serve, and it would be stale the moment it
        // was indexed.
        disallow: ["/api/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
