import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { weekendStyleToParams, WeekendStyle } from "@/lib/weekend";
import { timelineRange } from "@/lib/timeline";
import { normalizeDeals, isBridge, type Deal } from "@/lib/deals";
import { fetchHolidays, annotate } from "@/lib/holidays";
import { computeBridges } from "@/lib/bridges";
import { airportCityKm } from "@/lib/cities";
import { estimateFlightCo2Kg } from "@/lib/co2";
import { cached } from "@/lib/api-cache";

// Identical searches are cheap to repeat and prices don't move by the second;
// cache the (quota-costing) Tequila response for a while.
const SEARCH_TTL_MS = 30 * 60 * 1000;

const TEQUILA_BASE_URL = "https://tequila-api.kiwi.com";
const VALID_STYLES: WeekendStyle[] = ["strict", "frimon", "loose"];
const VALID_MONTHS = [1, 2, 3, 6];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const flyFrom = searchParams.get("flyFrom");
    const flyTo = searchParams.get("flyTo");
    const direct = searchParams.get("direct") === "1";
    // Opt-in "bridge days" mode: run the holiday-anchored searches and return
    // only the long-weekend / puente escapes. Off by default (a plain search).
    const bridgeMode = searchParams.get("bridges") === "1" && !flyTo;
    const style = (searchParams.get("style") || "frimon") as WeekendStyle;
    const months = parseInt(searchParams.get("months") || "3", 10);
    // Passengers — Tequila prices scale with headcount. Default 1, clamp 1–9.
    const adults = Math.min(
      9,
      Math.max(1, parseInt(searchParams.get("adults") || "1", 10) || 1)
    );
    const maxPriceRaw = searchParams.get("maxPrice");

    if (!flyFrom) {
      return NextResponse.json(
        { error: "Missing required parameter: flyFrom" },
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
    const maxPrice = maxPriceRaw ? parseInt(maxPriceRaw, 10) : undefined;
    if (maxPriceRaw && (!Number.isFinite(maxPrice) || (maxPrice as number) <= 0)) {
      return NextResponse.json({ error: "Invalid maxPrice" }, { status: 400 });
    }

    const apiKey = process.env.TEQUILA_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Tequila API key not configured" },
        { status: 500 }
      );
    }

    const currency = process.env.WEEKEND_CURRENCY || "EUR";
    const wp = weekendStyleToParams(style);
    const { dateFrom, dateTo } = timelineRange(months, new Date());

    const baseParams = {
      fly_from: flyFrom,
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
    const cacheKeyBase = `weekends:${flyFrom}:${flyTo ?? ""}:${style}:${months}:${
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
        d.co2Kg = estimateFlightCo2Kg(d.flyFrom, d.flyTo);
      }
    }

    // Bridge mode returns only the holiday-anchored escapes (Mon/Fri from the
    // normal windows, Tue/Wed/Thu from the bridge searches), cheapest first.
    const responseDeals = bridgeMode
      ? deals.filter(isBridge).sort((a, b) => a.price - b.price)
      : deals;

    return NextResponse.json(
      { deals: responseDeals },
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
      const from =
        new URL(request.url).searchParams.get("flyFrom") ?? "that airport";
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
    console.error("Weekend search error:", error);
    return NextResponse.json(
      { error: "Failed to search weekend flights" },
      { status: 500 }
    );
  }
}
