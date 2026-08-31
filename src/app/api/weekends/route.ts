import { NextRequest, NextResponse } from "next/server";
import { rateLimited } from "@/lib/rate-limit";
import { logSafe } from "@/lib/log-safe";
import axios from "axios";
import type { WeekendStyle } from "@/lib/weekend";
import {
  MissingApiKeyError,
  searchWeekends,
} from "@/lib/weekend-search";
import { MAX_ORIGINS, parseOrigins } from "@/lib/origins";

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

    const { deals: responseDeals, fetchedAt, origins: originList } =
      await searchWeekends({
        origins,
        flyTo,
        direct,
        bridgeMode,
        style,
        months,
        adults,
        maxPrice,
      });

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
    if (error instanceof MissingApiKeyError) {
      return NextResponse.json(
        { error: "Tequila API key not configured" },
        { status: 500 }
      );
    }
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
