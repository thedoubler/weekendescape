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
  // lastModified is the one field here Google actually reads (its docs say
  // changefreq/priority are largely ignored). The boards genuinely rebuild
  // daily, so "the sitemap's own render date" is an honest lastmod for them;
  // it re-bakes on every deploy, which happens at least that often. /about
  // deliberately carries none — claiming daily changes on static prose is
  // the kind of lie that gets the whole sitemap's lastmod distrusted.
  const rebuilt = new Date();
  return [
    {
      url: siteUrl,
      lastModified: rebuilt,
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
      lastModified: rebuilt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...DESTINATION_PAGES.map((d) => ({
      url: `${siteUrl}/weekends-in/${d.slug}`,
      lastModified: rebuilt,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
