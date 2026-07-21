import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { weekendStyleToParams, WeekendStyle } from "@/lib/weekend";
import { timelineRange } from "@/lib/timeline";
import { normalizeDeals } from "@/lib/deals";
import { fetchHolidays, annotate } from "@/lib/holidays";
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

    const params = {
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
    // window is relative to "today").
    const cacheKey = `weekends:${flyFrom}:${flyTo ?? ""}:${style}:${months}:${
      direct ? 1 : 0
    }:${adults}:${maxPrice ?? ""}:${currency}:${dateFrom}`;
    const raw = await cached(cacheKey, SEARCH_TTL_MS, async () => {
      const response = await axios.get(`${TEQUILA_BASE_URL}/v2/search`, {
        headers: { apikey: apiKey },
        params,
        timeout: 15000,
      });
      return response.data;
    });

    // normalizeDeals returns price-ascending; for a single-city lookup keep only
    // the cheapest weekend.
    const deals = flyTo
      ? normalizeDeals(raw, currency).slice(0, 1)
      : normalizeDeals(raw, currency);

    if (deals.length > 0) {
      const years = new Set<number>();
      for (const d of deals) {
        years.add(Number(d.outArrive.slice(0, 4)));
        years.add(Number(d.backDepart.slice(0, 4)));
      }
      const yearList = [...years];
      const homeCC = deals[0].countryFromCode;

      const homeCal = (
        await Promise.all(yearList.map((y) => fetchHolidays(homeCC, y)))
      ).flat();

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
        d.ptoDays = info.ptoDays;
        d.homeHoliday = info.homeHoliday;
        d.destHoliday = info.destHoliday;
        d.airportKmFromCity = airportCityKm(d.flyTo, d.cityTo, d.countryToCode);
        d.co2Kg = estimateFlightCo2Kg(d.flyFrom, d.flyTo);
      }
    }

    return NextResponse.json(
      { deals },
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
