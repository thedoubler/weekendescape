import axios from "axios";
import { weekendStyleToParams, WeekendStyle } from "@/lib/weekend";
import { timelineRange } from "@/lib/timeline";
import { normalizeDeals, isBridge, type Deal } from "@/lib/deals";
import { fetchHolidays, forRegion, regionsIn, annotate } from "@/lib/holidays";
import { inferHomeRegion, regionName } from "@/lib/airport-region";
import { computeBridges } from "@/lib/bridges";
import { airportCityKm } from "@/lib/cities";
import { distinctAirportCity } from "@/lib/airport-city";
import { currencyForOrigin } from "@/lib/currency";
import { estimateFlightCo2Kg } from "@/lib/co2";
// Server-only: this pulls in airports.json (~134 KB). Safe here, never in a
// client component.
import { airportCoords } from "@/lib/airport-coords";
import { cached, cacheFetchedAt } from "@/lib/api-cache";
import { serializeOrigins, originsCacheKey } from "@/lib/origins";

// The weekend search itself, lifted out of the route handler.
//
// It moved because a React Server Component cannot call a route handler, and
// the /from/[iata] pages have to run this same search at build/revalidate time.
// Both callers now import one function, so the board and the static pages can
// never drift into answering the same question differently — which is the whole
// promise those pages make to a search engine.
//
// It is also just better placed: 320 lines inside a GET handler is where
// testability goes to die. Everything here is pure of HTTP — no NextRequest, no
// NextResponse, no status codes. The route maps failures onto responses; the
// page renders them.

const SEARCH_TTL_MS = 30 * 60 * 1000;
const TEQUILA_BASE_URL = "https://tequila-api.kiwi.com";

/** Thrown when TEQUILA_API_KEY is absent, so callers can answer in their own idiom. */
export class MissingApiKeyError extends Error {
  constructor() {
    super("Tequila API key not configured");
    this.name = "MissingApiKeyError";
  }
}

export interface WeekendSearchOptions {
  /** One to three IATA codes, already validated and deduped. */
  origins: string[];
  /** A single destination, for the cheapest-weekend lookup. */
  flyTo?: string | null;
  direct?: boolean;
  /** Holiday-anchored long weekends only. */
  bridgeMode?: boolean;
  /** Which regional holidays count as the traveller's own, bridge mode only.
   *  undefined → infer from the home airports (see inferHomeRegion);
   *  "national" → national holidays only, explicitly;
   *  an ISO-3166-2 code → that region's, when it belongs to the home country
   *  (a stale code from another country falls back to inference). */
  homeRegion?: string | null;
  style: WeekendStyle;
  months: number;
  adults: number;
  /** Already quantized by the caller — it lands in the cache key. */
  maxPrice?: number;
}

export interface WeekendSearchResult {
  deals: Deal[];
  /** When the prices were actually fetched, for an honest "checked X ago". */
  fetchedAt: number;
  origins: { code: string; coords: [number, number] | null }[];
  currency: string;
  /** Bridge mode only: which region's holidays were counted as the
   *  traveller's own, and which regions the home country offers. The receipt
   *  prints `used` and the picker lists `options`; an empty options list
   *  means the country has no regional holidays and no control is shown. */
  homeRegion?: {
    used: string | null;
    usedName: string | null;
    options: { code: string; name: string }[];
  };
}

export async function searchWeekends({
  origins,
  flyTo = null,
  direct = false,
  bridgeMode = false,
  homeRegion = null,
  style,
  months,
  adults,
  maxPrice,
}: WeekendSearchOptions): Promise<WeekendSearchResult> {
  const flyFrom = origins[0];
  const apiKey = process.env.TEQUILA_API_KEY;
  if (!apiKey) throw new MissingApiKeyError();

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

  let homeRegionInfo: WeekendSearchResult["homeRegion"];

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

    // Home-country holidays drive the bridge logic — fetched only when the
    // user opted into bridge mode, and fetched UNFILTERED: the same response
    // yields both the traveller's calendar (national + their region, via
    // forRegion) and the region option list the receipt's picker offers.
    const homeAll = bridgeMode
      ? (
          await Promise.all(yearList.map((y) => fetchHolidays(homeCC, y)))
        ).flat()
      : [];
    // Which region is "the traveller's own": an explicit choice wins when it
    // belongs to the home country; "national" declines regions outright; a
    // stale code from a previous home country falls back to inference, which
    // itself answers only when every home airport agrees (see
    // inferHomeRegion). null everywhere else — the app must never claim a
    // day off the traveller doesn't actually have.
    const usedRegion =
      homeRegion === "national"
        ? null
        : homeRegion && homeRegion.startsWith(`${homeCC}-`)
          ? homeRegion
          : inferHomeRegion(origins, homeCC);
    const homeCal = forRegion(homeAll, usedRegion);
    if (bridgeMode) {
      homeRegionInfo = {
        used: usedRegion,
        usedName: usedRegion ? regionName(usedRegion) : null,
        options: regionsIn(homeAll).map((code) => ({
          code,
          name: regionName(code),
        })),
      };
    }

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

  return {
    deals: responseDeals,
    fetchedAt,
    origins: originList,
    currency,
    ...(homeRegionInfo ? { homeRegion: homeRegionInfo } : {}),
  };
}
