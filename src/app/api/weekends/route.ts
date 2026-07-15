import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { weekendStyleToParams, WeekendStyle } from "@/lib/weekend";
import { timelineRange } from "@/lib/timeline";
import { normalizeDeals } from "@/lib/deals";

const TEQUILA_BASE_URL = "https://tequila-api.kiwi.com";
const VALID_STYLES: WeekendStyle[] = ["strict", "frimon", "loose"];
const VALID_MONTHS = [1, 2, 3, 6];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const flyFrom = searchParams.get("flyFrom");
    const style = (searchParams.get("style") || "frimon") as WeekendStyle;
    const months = parseInt(searchParams.get("months") || "3", 10);
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
    const maxPrice = maxPriceRaw ? parseInt(maxPriceRaw, 10) : undefined;

    const response = await axios.get(`${TEQUILA_BASE_URL}/v2/search`, {
      headers: { apikey: apiKey },
      params: {
        fly_from: flyFrom,
        date_from: dateFrom,
        date_to: dateTo,
        flight_type: "round",
        fly_days: wp.flyDays.join(","),
        fly_days_type: "departure",
        ret_fly_days: wp.retFlyDays.join(","),
        ret_fly_days_type: "arrival",
        nights_in_dst_from: wp.nightsFrom,
        nights_in_dst_to: wp.nightsTo,
        one_for_city: 1,
        sort: "price",
        curr: currency,
        limit: 200,
        ...(maxPrice ? { price_to: maxPrice } : {}),
      },
    });

    const deals = normalizeDeals(response.data, currency);
    return NextResponse.json({ deals });
  } catch (error) {
    console.error("Weekend search error:", error);
    return NextResponse.json(
      { error: "Failed to search weekend flights" },
      { status: 500 }
    );
  }
}
