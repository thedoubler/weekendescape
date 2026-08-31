import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// One entry, because there is exactly one indexable page. This stays honest
// rather than padded: query-string variants (`?from=BCN`) are the SAME page
// with client-fetched results, so listing them would claim content that isn't
// served. If per-city routes are ever added, they belong here.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      // Static prose, and the only page here a crawler can read in full.
      url: `${siteUrl}/about`,
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];
}
