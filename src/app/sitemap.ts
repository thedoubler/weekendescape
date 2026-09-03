import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Honest rather than padded. Query-string variants (`?from=BCN`) are the SAME
// page with client-fetched results, so they are still not listed — a crawler
// gets identical HTML from every one of them. The /from/[iata] routes ARE
// listed, because they are server-rendered and each carries different content.
// The origins that get a server-rendered page. Kept in step with
// generateStaticParams in from/[iata]/page.tsx — a sitemap that lists a URL
// nothing renders is worse than one that lists fewer.
import { ORIGIN_PAGES as ORIGIN_LIST } from "@/lib/origin-pages";
import { DESTINATION_PAGES } from "@/lib/destination-pages";

// The full curated origin list — one module feeds the sitemap, the link
// blocks and the /from titles, so they can never disagree.
const ORIGIN_PAGES = ORIGIN_LIST.map((o) => o.code);

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
    // One per origin airport. These carry the real content — city, dates,
    // fares — and are rebuilt daily, which is what changeFrequency claims.
    ...ORIGIN_PAGES.map((iata) => ({
      url: `${siteUrl}/from/${iata.toLowerCase()}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...DESTINATION_PAGES.map((d) => ({
      url: `${siteUrl}/weekends-in/${d.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
