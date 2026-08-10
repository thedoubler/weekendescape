import { NextRequest, NextResponse } from "next/server";
import { cached } from "@/lib/api-cache";
import type { FlightSegment } from "@/lib/deals";

// Google's Travel Impact Model: per-flight CO2e for a real scheduled flight,
// not a distance formula. It keys on carrier + flight number + date + route and
// returns nothing at all if it cannot identify the aircraft — which is why the
// segment identity has to be carried all the way from Kiwi.
//
// SERVER-SIDE ONLY. The key is `GOOGLE_TIM_API_KEY`, deliberately without a
// NEXT_PUBLIC_ prefix: a browser-visible key on an unrestricted project is a
// standing invitation.
const TIM_URL =
  "https://travelimpactmodel.googleapis.com/v1/flights:computeFlightEmissions";

// Emissions for a given flight on a given date do not change. A day is
// conservative; the upstream model is versioned and updated in batches.
const TTL_MS = 24 * 60 * 60 * 1000;

// A round trip is 2-4 segments. Anything much larger is not a trip from this
// board, and batching strangers' requests is not this route's job.
const MAX_SEGMENTS = 8;

interface TimFlight {
  emissionsGramsPerPax?: { economy?: number };
}

function isSegment(v: unknown): v is FlightSegment {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.from === "string" &&
    typeof s.to === "string" &&
    typeof s.carrier === "string" &&
    typeof s.flightNo === "number" &&
    typeof s.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s.date)
  );
}

export async function POST(request: NextRequest) {
  const key = process.env.GOOGLE_TIM_API_KEY;
  // Not an error: the feature is optional, and the card falls back to its own
  // estimate. A 500 here would surface as a broken panel.
  if (!key) return NextResponse.json({ grams: null, reason: "disabled" });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = (body as { segments?: unknown })?.segments;
  const segments = Array.isArray(raw) ? raw.filter(isSegment) : [];
  if (segments.length === 0 || segments.length > MAX_SEGMENTS) {
    return NextResponse.json({ error: "Bad segments" }, { status: 400 });
  }

  // Order-independent so an out/back pair and its reverse share one entry.
  const cacheKey =
    "tim:" +
    segments
      .map((s) => `${s.carrier}${s.flightNo}:${s.from}${s.to}:${s.date}`)
      .sort()
      .join("|");

  try {
    const grams = await cached(cacheKey, TTL_MS, async () => {
      const res = await fetch(`${TIM_URL}?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flights: segments.map((s) => {
            const [year, month, day] = s.date.split("-").map(Number);
            return {
              origin: s.from,
              destination: s.to,
              operatingCarrierCode: s.carrier,
              flightNumber: s.flightNo,
              departureDate: { year, month, day },
            };
          }),
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`TIM ${res.status}`);
      const data = (await res.json()) as { flightEmissions?: TimFlight[] };
      const rows = data.flightEmissions ?? [];

      // ALL segments or nothing. TIM omits `emissionsGramsPerPax` for flights it
      // cannot identify, and summing the ones it knows would silently under-
      // report the trip — a number that is wrong in a predictable direction is
      // worse than no number.
      const values = rows.map((r) => r.emissionsGramsPerPax?.economy);
      if (values.length !== segments.length || values.some((v) => typeof v !== "number")) {
        return null;
      }
      return (values as number[]).reduce((a, b) => a + b, 0);
    });

    return NextResponse.json(
      { grams },
      { headers: { "Cache-Control": "public, max-age=86400" } }
    );
  } catch {
    // Upstream trouble is not this page's problem: the card keeps its estimate.
    return NextResponse.json({ grams: null, reason: "unavailable" });
  }
}
