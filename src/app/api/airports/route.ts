import { NextRequest, NextResponse } from "next/server";
import { logSafe } from "@/lib/log-safe";
import axios from "axios";
import { cached } from "@/lib/api-cache";

const TEQUILA_BASE_URL = "https://tequila-api.kiwi.com";
// Airport reference data barely changes; cache lookups aggressively so
// keystroke-driven autocomplete doesn't hammer Tequila.
const AIRPORTS_TTL_MS = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const term = searchParams.get("term");
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");

    if (!term && (!lat || !lon)) {
      return NextResponse.json(
        { error: "Provide either a search term or lat/lon" },
        { status: 400 }
      );
    }

    // Both inputs land in a cache key, so both are bounded before they get
    // there. Unbounded, this route was the cheapest way to attack the whole
    // app: random terms never hit the cache, every miss cost an upstream call,
    // and because the cache is a single shared store with a fixed cap, a few
    // hundred junk lookups evicted every cached flight search — so ordinary
    // visitors then missed too. A term long enough to be an airport name is
    // 60 characters; anything longer is not a search.
    if (term && (term.length > 60 || !/^[\p{L}\p{N}\s'’.,()/-]+$/u.test(term))) {
      return NextResponse.json(
        { error: "Invalid search term." },
        { status: 400 }
      );
    }
    // Coordinates are numbers in a real range, and quantized to ~1 km: a
    // nearest-airport lookup does not change within a city block, and full
    // float precision would have made every GPS reading its own cache key.
    let geo: { lat: number; lon: number } | null = null;
    if (!term) {
      const latN = Number(lat);
      const lonN = Number(lon);
      if (
        !Number.isFinite(latN) ||
        !Number.isFinite(lonN) ||
        Math.abs(latN) > 90 ||
        Math.abs(lonN) > 180
      ) {
        return NextResponse.json(
          { error: "Invalid coordinates." },
          { status: 400 }
        );
      }
      geo = { lat: Math.round(latN * 100) / 100, lon: Math.round(lonN * 100) / 100 };
    }

    const apiKey = process.env.TEQUILA_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Tequila API key not configured" },
        { status: 500 }
      );
    }

    // term = name/city autocomplete; lat/lon = nearest-airport geolocation.
    const cacheKey = term
      ? `airports:term:${term.toLowerCase()}`
      : `airports:geo:${geo!.lat}:${geo!.lon}`;
    const data = await cached(cacheKey, AIRPORTS_TTL_MS, async () => {
      const response = term
        ? await axios.get(`${TEQUILA_BASE_URL}/locations/query`, {
            headers: { apikey: apiKey },
            params: {
              term,
              locale: "en-US",
              location_types: "airport",
              limit: 8,
              active_only: true,
            },
            timeout: 8000,
          })
        : await axios.get(`${TEQUILA_BASE_URL}/locations/radius`, {
            headers: { apikey: apiKey },
            params: {
              lat: geo!.lat,
              lon: geo!.lon,
              radius: 250,
              locale: "en-US",
              location_types: "airport",
              limit: 5,
              active_only: true,
            },
            timeout: 8000,
          });
      return response.data;
    });

    interface TequilaLocation {
      code?: string;
      name?: string;
      city?: { name?: string };
      city_name?: string;
      country?: { name?: string };
      country_name?: string;
    }
    const locations: TequilaLocation[] = Array.isArray(data?.locations)
      ? data.locations
      : [];
    const airports = locations.map((a) => ({
      code: a.code,
      name: a.name,
      city: a.city?.name ?? a.city_name ?? "",
      country: a.country?.name ?? a.country_name ?? "",
    }));

    return NextResponse.json(
      { airports },
      { headers: { "Cache-Control": "private, max-age=3600" } }
    );
  } catch (error) {
    console.error("Airport search error:", logSafe(error));
    return NextResponse.json(
      { error: "Failed to search airports" },
      { status: 500 }
    );
  }
}
