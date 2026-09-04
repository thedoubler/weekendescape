import { NextRequest, NextResponse } from "next/server";
import { rateLimited } from "@/lib/rate-limit";

// A city's lead photo, resolved through Wikipedia and proxied so the CSP can
// stay img-src 'self' (the same reason airline logos proxy through us). Two
// upstream calls per city, each on the worker's data cache:
//
//   resolve: MediaWiki search for "{city} {country}" → the best page's lead
//            thumbnail. Search, not a direct title lookup, because bare city
//            names are ambiguous ("Nice", "Split") and the country term is
//            what disambiguates them.
//   image:   the thumbnail bytes from upload.wikimedia.org.
//
// Both revalidate monthly — a city's lead photo changes about never — and the
// browser caches the bytes for a year. No thumbnail (or any upstream failure)
// is a 404/502 with no body: the panel's <img onError> hides itself, so a
// missing photo costs nothing, same honesty rule as ThingsToDo.
const REVALIDATE = 30 * 24 * 60 * 60;

// Wikimedia asks API clients to identify themselves; anonymous UAs get
// throttled first when they shed load.
const UA = "weekend.flights (https://weekend.flights; city lead photos)";

export async function GET(request: NextRequest) {
  const limited = await rateLimited(request, "API_RATE_LIMIT");
  if (limited) return limited;
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city") ?? "";
  const country = searchParams.get("country") ?? "";
  // Both land in an upstream query (and its cache key); bound them the way
  // the airports route bounds its term, for the same cache-eviction reason.
  const ok = (s: string, max: number) =>
    s.length <= max && /^[\p{L}\p{N}\s'’.,()/-]*$/u.test(s);
  if (!city || !ok(city, 60) || !ok(country, 60)) {
    return NextResponse.json({ error: "Invalid city" }, { status: 400 });
  }
  try {
    const q = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: country ? `${city} ${country}` : city,
      gsrlimit: "1",
      prop: "pageimages",
      piprop: "thumbnail",
      pithumbsize: "960",
      format: "json",
    });
    const resolve = await fetch(`https://en.wikipedia.org/w/api.php?${q}`, {
      headers: { "User-Agent": UA },
      next: { revalidate: REVALIDATE },
    } as RequestInit);
    if (!resolve.ok) return new NextResponse(null, { status: 502 });
    const data = (await resolve.json()) as {
      query?: {
        pages?: Record<string, { thumbnail?: { source?: string } }>;
      };
    };
    const pages = Object.values(data.query?.pages ?? {});
    const src = pages[0]?.thumbnail?.source;
    // Only Wikimedia's own image host may become a passthrough.
    if (!src || !src.startsWith("https://upload.wikimedia.org/")) {
      return new NextResponse(null, { status: 404 });
    }
    const img = await fetch(src, {
      headers: { "User-Agent": UA },
      next: { revalidate: REVALIDATE },
    } as RequestInit);
    if (!img.ok) return new NextResponse(null, { status: 404 });
    const body = await img.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        "Content-Type": img.headers.get("Content-Type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
