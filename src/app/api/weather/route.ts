import { NextRequest, NextResponse } from "next/server";
import {
  airportCoords,
  pickMode,
  forecastUrl,
  summarizeForecast,
  climatologyRange,
  archiveUrl,
  summarizeTypical,
} from "@/lib/weather";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

// Weather for a single destination, fetched on demand when a deal card is
// expanded. Close trips get a real forecast; far-out ones get a climatological
// average for the same calendar window (see src/lib/weather.ts).
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const iata = searchParams.get("iata");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!iata || !from || !to || !ISO_DATE.test(from) || !ISO_DATE.test(to)) {
      return NextResponse.json(
        { error: "Missing or invalid iata/from/to" },
        { status: 400 }
      );
    }

    const coords = airportCoords(iata);
    if (!coords) return NextResponse.json({ weather: null });
    const [lat, lon] = coords;

    if (pickMode(from, new Date()) === "forecast") {
      const url = forecastUrl(lat, lon, from.slice(0, 10), to.slice(0, 10));
      const res = await fetch(url, { next: { revalidate: 3600 } } as RequestInit);
      if (!res.ok) return NextResponse.json({ weather: null });
      const data = await res.json();
      return NextResponse.json({ weather: summarizeForecast(data?.daily ?? {}) });
    }

    const range = climatologyRange(from, to);
    if (!range) return NextResponse.json({ weather: null });
    const url = archiveUrl(lat, lon, range.startDate, range.endDate);
    // Historical normals barely move; cache hard.
    const res = await fetch(url, { next: { revalidate: 2592000 } } as RequestInit);
    if (!res.ok) return NextResponse.json({ weather: null });
    const data = await res.json();
    return NextResponse.json({
      weather: summarizeTypical(data?.daily ?? {}, range.targetKeys, range.years),
    });
  } catch (error) {
    console.error("Weather lookup error:", error);
    return NextResponse.json({ weather: null });
  }
}
