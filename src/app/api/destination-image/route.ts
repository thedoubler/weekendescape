import { NextRequest, NextResponse } from "next/server";
import { cached } from "@/lib/api-cache";

// City photos barely change; cache hard (per city+country).
const IMAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Required on Unsplash attribution links per their API guidelines.
const UTM = "utm_source=weekend_escape&utm_medium=referral";

// Destination hero image for a deal card, fetched on demand when the card is
// expanded. Returns { image: null } (never an error) when no key is configured
// or nothing matches, so the card degrades gracefully.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const city = (searchParams.get("city") || "").trim();
  const country = (searchParams.get("country") || "").trim();
  const key = process.env.UNSPLASH_ACCESS_KEY;
  // OPT-IN, not opt-out. This route makes two Unsplash calls per cache miss
  // (search, then the download ping their guidelines require) on a free tier
  // capped at 50 requests an hour, and `city` is free text that lands in the
  // cache key — so ~50 crafted requests removed hero images for every visitor
  // for the rest of the hour. Defaulting to off means a deployment that never
  // sets the flag cannot be used that way at all. Turn it on deliberately, and
  // only behind a bounded `city` and a rate limit.
  const enabled = /^(on|true|1|yes)$/i.test(process.env.DESTINATION_IMAGES || "");
  // Bounded even when enabled: free text in a cache key is the whole problem.
  const sane =
    city.length <= 60 &&
    country.length <= 60 &&
    /^[\p{L}\p{N}\s'’.,()-]*$/u.test(city + country);
  if (!city || !key || !enabled || !sane)
    return NextResponse.json({ image: null });

  try {
    const q = [city, country].filter(Boolean).join(" ");
    const image = await cached(`image:${q.toLowerCase()}`, IMAGE_TTL_MS, async () => {
      const url =
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}` +
        `&per_page=1&orientation=landscape&content_filter=high`;
      const res = await fetch(url, {
        headers: { Authorization: `Client-ID ${key}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const p = data?.results?.[0];
      if (!p) return null;

      // Unsplash guideline: ping the download endpoint when a photo is used.
      if (p.links?.download_location) {
        try {
          await fetch(p.links.download_location, {
            headers: { Authorization: `Client-ID ${key}` },
            signal: AbortSignal.timeout(5000),
          });
        } catch {
          /* best-effort tracking */
        }
      }

      const raw: string | undefined = p.urls?.raw;
      return {
        url: raw
          ? `${raw}&w=1000&h=340&fit=crop&q=70`
          : (p.urls?.regular ?? null),
        alt: p.alt_description || `${city}${country ? `, ${country}` : ""}`,
        credit: {
          name: p.user?.name ?? "Unsplash",
          profile: p.user?.links?.html ? `${p.user.links.html}?${UTM}` : null,
          photo: p.links?.html ? `${p.links.html}?${UTM}` : null,
        },
      };
    });

    // Don't let the browser cache this long — the server already caches results
    // in-memory (so Unsplash isn't hammered), and a short client cache keeps the
    // DESTINATION_IMAGES kill switch (and cache invalidation) effective.
    return NextResponse.json(
      { image },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ image: null });
  }
}
