import { NextRequest, NextResponse } from "next/server";
import { rateLimited } from "@/lib/rate-limit";
import { logSafe } from "@/lib/log-safe";
import axios from "axios";
import { weekendStyleToParams, WeekendStyle } from "@/lib/weekend";
import { timelineRange } from "@/lib/timeline";
import { normalizeDeals, isBridge, type Deal } from "@/lib/deals";
import { fetchHolidays, annotate } from "@/lib/holidays";
import { computeBridges } from "@/lib/bridges";
import { airportCityKm } from "@/lib/cities";
import { distinctAirportCity } from "@/lib/airport-city";
import { currencyForOrigin } from "@/lib/currency";
import { estimateFlightCo2Kg } from "@/lib/co2";
// Server-only: this pulls in airports.json (~134 KB). Safe here, never in a
// client component.
import { airportCoords } from "@/lib/airport-coords";
import { cached, cacheFetchedAt } from "@/lib/api-cache";
import {
  MAX_ORIGINS,
  parseOrigins,
  serializeOrigins,
  originsCacheKey,
} from "@/lib/origins";

// Identical searches are cheap to repeat and prices don't move by the second;
// cache the (quota-costing) Tequila response for a while.
const SEARCH_TTL_MS = 30 * 60 * 1000;

const TEQUILA_BASE_URL = "https://tequila-api.kiwi.com";
const VALID_STYLES: WeekendStyle[] = ["strict", "frimon", "loose"];
const VALID_MONTHS = [1, 2, 3, 6];

export async function GET(request: NextRequest) {
  try {
    const limited = await rateLimited(request, "SEARCH_RATE_LIMIT");
    if (limited) return limited;
    const { searchParams } = new URL(request.url);
    // One to three home airports, comma-separated. Kiwi's fly_from takes the
    // same shape, so the multi-origin search costs us nothing upstream.
    const flyFromRaw = searchParams.get("flyFrom");
    const origins = parseOrigins(flyFromRaw);
    const flyFrom = origins[0] ?? null;
    const flyTo = searchParams.get("flyTo");
    const direct = searchParams.get("direct") === "1";
    // Opt-in "bridge days" mode: run the holiday-anchored searches and return
    // only the long-weekend / puente escapes. Off by default (a plain search).
    const bridgeMode = searchParams.get("bridges") === "1" && !flyTo;
    const style = (searchParams.get("style") || "strict") as WeekendStyle;
    const months = parseInt(searchParams.get("months") || "3", 10);
    // Passengers — Tequila prices scale with headcount. Default 1, clamp 1–9.
    const adults = Math.min(
      9,
      Math.max(1, parseInt(searchParams.get("adults") || "1", 10) || 1)
    );
    const maxPriceRaw = searchParams.get("maxPrice");

    if (!flyFrom) {
      return NextResponse.json(
        {
          error: flyFromRaw
            ? `Invalid flyFrom. Use up to ${MAX_ORIGINS} comma-separated IATA codes, e.g. BCN,GRO`
            : "Missing required parameter: flyFrom",
        },
        { status: 400 }
      );
    }
    if (!VALID_STYLES.includes(style)) {
      return NextResponse.json(
        { error: `Invalid style. Use one of: ${VALID_STYLES.join(", ")}` },
        { status: 400 }
      );
    }
    if (!VALID_MONTHS.includes(months)) {
      return NextResponse.json(
        { error: `Invalid months. Use one of: ${VALID_MONTHS.join(", ")}` },
        { status: 400 }
      );
    }
    // QUANTIZED, and that is a security control rather than tidiness. maxPrice
    // goes into the cache key, so an unbounded value gave an attacker an
    // unbounded key space: `maxPrice=1`, `=2`, `=3` … each missed the cache and
    // each spent one upstream search. Measured before this landed — three
    // consecutive values cost 2.6s, 2.6s and 2.3s upstream, while repeating one
    // came back in 0.04s from cache. A short loop drained the day's quota.
    // Rounding to a 25-unit step and capping at 5000 leaves 200 possible keys,
    // and the filter is a coarse price band where 25 units never mattered.
    const maxPriceParsed = maxPriceRaw ? parseInt(maxPriceRaw, 10) : undefined;
    if (
      maxPriceRaw &&
      (!Number.isFinite(maxPriceParsed) || (maxPriceParsed as number) <= 0)
    ) {
      return NextResponse.json({ error: "Invalid maxPrice" }, { status: 400 });
    }
    const maxPrice =
      maxPriceParsed === undefined
        ? undefined
        : Math.min(5000, Math.ceil(maxPriceParsed / 25) * 25);

    // Same reasoning for flyTo, which was passed to Tequila verbatim and never
    // checked. It accepts more than an airport code (`country:GB`, radius
    // syntax), so it was both an unvalidated upstream passthrough and a second
    // unbounded dimension in the cache key.
    if (flyTo && !/^[A-Z]{3}$/.test(flyTo)) {
      return NextResponse.json(
        { error: "Invalid flyTo. Use a single 3-letter IATA code." },
        { status: 400 }
      );
    }

    const apiKey = process.env.TEQUILA_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Tequila API key not configured" },
        { status: 500 }
      );
    }

    // Priced from the HOME airport so every fare on a board is comparable:
    // EUR for a European origin, USD otherwise. The env var still wins when set,
    // so a deployment can pin one currency.
    const currency = process.env.WEEKEND_CURRENCY || currencyForOrigin(flyFrom);
    const wp = weekendStyleToParams(style);
    const { dateFrom, dateTo } = timelineRange(months, new Date());

    const baseParams = {
      fly_from: serializeOrigins(origins),
      date_from: dateFrom,
      date_to: dateTo,
      flight_type: "round",
      fly_days: wp.flyDays.join(","),
      fly_days_type: "departure",
      ret_fly_days: wp.retFlyDays.join(","),
      ret_fly_days_type: "arrival",
      ret_from_diff_airport: false,
      ret_to_diff_airport: false,
      nights_in_dst_from: wp.nightsFrom,
      nights_in_dst_to: wp.nightsTo,
      // Board search: one (cheapish) flight per city for broad coverage.
      // Single-city lookup (flyTo set): all options, so we can pick the
      // true cheapest weekend for that destination.
      ...(flyTo ? { fly_to: flyTo, one_for_city: 0 } : { one_for_city: 1 }),
      ...(direct ? { max_stopovers: 0 } : {}),
      adults,
      sort: "price",
      curr: currency,
      limit: 200,
      ...(maxPrice ? { price_to: maxPrice } : {}),
    };

    // dateFrom is in the key so the cache turns over at day boundaries (the
    // window is relative to "today"). Each search variant (main + each bridge
    // window) gets its own suffix so they cache independently.
    const cacheKeyBase = `weekends:${originsCacheKey(origins)}:${flyTo ?? ""}:${style}:${months}:${
      direct ? 1 : 0
    }:${adults}:${maxPrice ?? ""}:${currency}:${dateFrom}`;

    async function searchDeals(
      overrides: Record<string, unknown>,
      keyExtra: string
    ): Promise<Deal[]> {
      const raw = await cached(
        `${cacheKeyBase}:${keyExtra}`,
        SEARCH_TTL_MS,
        async () => {
          const response = await axios.get(`${TEQUILA_BASE_URL}/v2/search`, {
            headers: { apikey: apiKey },
            params: { ...baseParams, ...overrides },
            timeout: 15000,
          });
          return response.data;
        }
      );
      return normalizeDeals(raw, currency);
    }

    // normalizeDeals returns price-ascending; for a single-city lookup keep only
    // the cheapest weekend.
    const mainDeals = await searchDeals({}, "main");
    const deals = flyTo ? mainDeals.slice(0, 1) : mainDeals;

    if (deals.length > 0) {
      const homeCC = deals[0].countryFromCode;

      // Holiday years span the search window (relative to today), not the deals.
      const now = new Date();
      const startMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
      const windowEnd = new Date(startMs);
      windowEnd.setUTCMonth(windowEnd.getUTCMonth() + months);
      const endMs = windowEnd.getTime();
      const yearList = [
        ...new Set([
          new Date(startMs).getUTCFullYear(),
          new Date(endMs).getUTCFullYear(),
        ]),
      ];

      // Home-country holidays (national only, for honest PTO math) drive the
      // bridge logic — fetched only when the user opted into bridge mode.
      const homeCal = bridgeMode
        ? (
            await Promise.all(
              yearList.map((y) =>
                fetchHolidays(homeCC, y, { nationalOnly: true })
              )
            )
          ).flat()
        : [];

      // Bridge mode: run the holiday-anchored windows the fixed weekend windows
      // miss (Tue/Wed/Thu). Each is its own cached Kiwi search; they run in
      // parallel, so latency is the slowest one rather than the sum.
      if (bridgeMode) {
        const bridges = computeBridges(homeCal, startMs, endMs);
        if (bridges.length > 0) {
          const bridgeResults = await Promise.all(
            bridges.map((b) =>
              searchDeals(
                {
                  date_from: b.dateFrom,
                  date_to: b.dateTo,
                  fly_days: b.flyDays.join(","),
                  ret_fly_days: b.retFlyDays.join(","),
                  nights_in_dst_from: b.nightsFrom,
                  nights_in_dst_to: b.nightsTo,
                },
                `bridge:${b.kind}:${b.dateFrom}`
              ).catch(() => [] as Deal[])
            )
          );

          // Merge in the bridged trips the main search missed: dedupe to the
          // cheapest per city, and drop any trip (same city + dates) already present.
          const tripKey = (d: Deal) =>
            `${d.cityTo}|${d.outDepart.slice(0, 10)}|${d.backDepart.slice(0, 10)}`;
          const existing = new Set(deals.map(tripKey));
          const byCity = new Map<string, Deal>();
          for (const d of bridgeResults.flat()) {
            if (existing.has(tripKey(d))) continue;
            const cur = byCity.get(d.cityTo);
            if (!cur || d.price < cur.price) byCity.set(d.cityTo, d);
          }
          const extra = [...byCity.values()]
            .sort((a, b) => a.price - b.price)
            .slice(0, 40);
          deals.push(...extra);
        }
      }

      // Destination public holidays stay on for every search (so "there's a
      // holiday there" is always accurate) — regional ones included.
      const destCCs = [...new Set(deals.map((d) => d.countryToCode).filter(Boolean))];
      const destPairs = await Promise.all(
        destCCs.map(async (cc) => {
          const cal = (
            await Promise.all(yearList.map((y) => fetchHolidays(cc, y)))
          ).flat();
          return [cc, cal] as const;
        })
      );
      const destCalByCC = new Map(destPairs);

      for (const d of deals) {
        const info = annotate(
          d.outArrive,
          d.backDepart,
          homeCal,
          destCalByCC.get(d.countryToCode) ?? []
        );
        // Home-holiday / PTO fields only in bridge mode; destination holiday always.
        if (bridgeMode) {
          d.ptoDays = info.ptoDays;
          d.ptoDates = info.ptoDates;
          d.homeHoliday = info.homeHoliday;
          d.homeHolidays = info.homeHolidays;
        }
        d.destHoliday = info.destHoliday;
        d.airportKmFromCity = airportCityKm(d.flyTo, d.cityTo, d.countryToCode);
        d.airportCity = distinctAirportCity(d.flyTo, d.cityTo);
        d.co2Kg = estimateFlightCo2Kg(d.flyFrom, d.flyTo);
      }
    }

    // Bridge mode returns only the holiday-anchored escapes (Mon/Fri from the
    // normal windows, Tue/Wed/Thu from the bridge searches), cheapest first.
    const responseDeals = bridgeMode
      ? deals.filter(isBridge).sort((a, b) => a.price - b.price)
      : deals;

    // Attach arrival coordinates so the client can plot deals without importing
    // the 6k-entry airport table. Done here rather than in `normalizeDeals`
    // because `deals.ts` is imported by client components and must stay free of
    // that dependency. Unconditional — every response carries them.
    for (const d of responseDeals) {
      d.toCoords = airportCoords(d.flyTo);
    }
    // Origins ship once alongside the deals rather than repeated on each. Each
    // deal already names its own departure airport in `flyFrom`.
    const originList = origins.map((code) => ({
      code,
      coords: airportCoords(code),
    }));

    // When the underlying prices were actually fetched from Kiwi (for an honest
    // "checked X ago" stamp) — falls back to now for a fresh miss.
    const fetchedAt = cacheFetchedAt(`${cacheKeyBase}:main`) ?? Date.now();

    return NextResponse.json(
      {
        deals: responseDeals,
        fetchedAt,
        // `origin` stays for the single-origin case; `origins` is the full list.
        origin: originList[0],
        origins: originList,
      },
      // Let the CDN/browser reuse a result briefly; matches the server cache.
      { headers: { "Cache-Control": "private, max-age=300" } }
    );
  } catch (error) {
    // Tequila 422 = it rejected our parameters (usually an airport it can't
    // route from). Surface that as an actionable message rather than a 500.
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    if (axios.isAxiosError(error) && error.code === "ECONNABORTED") {
      return NextResponse.json(
        { error: "Search is taking too long — please try again." },
        { status: 504 }
      );
    }
    if (status === 422) {
      // The PARSED codes, not the raw query string. Echoing the raw value back
      // reflected however many kilobytes an attacker sent; it renders as a
      // React text child so it was never an injection, just a mirror.
      const from =
        parseOrigins(new URL(request.url).searchParams.get("flyFrom")).join(
          ", "
        ) || "that airport";
      return NextResponse.json(
        {
          error: `We couldn't search weekends from ${from}. Try a different airport or a longer window.`,
        },
        { status: 422 }
      );
    }
    if (status === 429) {
      return NextResponse.json(
        { error: "Search is busy right now — give it a moment and try again." },
        { status: 429 }
      );
    }
    console.error("Weekend search error:", logSafe(error));
    return NextResponse.json(
      { error: "Failed to search weekend flights" },
      { status: 500 }
    );
  }
}
