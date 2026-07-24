import airports from "@/lib/airports.json";

// IATA airport code -> [lat, lon]. Bundled (OpenFlights-derived) so we can hit
// Open-Meteo without a separate geocoding round-trip. Server-only import.
const AIRPORTS = airports as unknown as Record<string, [number, number]>;

export type WeatherMode = "forecast" | "typical";

export interface WeatherResult {
  mode: WeatherMode;
  highC: number;
  lowC: number;
  emoji: string;
  // Short human label, e.g. "Clear", "Rain", "Usually dry".
  condition: string;
  // Forecast only: mean chance of precipitation across the trip days (%).
  precipChance?: number;
  // Typical only: how many past years were averaged.
  years?: number;
}

export function airportCoords(iata: string): [number, number] | null {
  if (!iata) return null;
  return AIRPORTS[iata.toUpperCase()] ?? null;
}

// Open-Meteo's forecast horizon is ~16 days; stay under it with a margin so a
// weekend that starts near the edge still resolves an actual forecast.
const FORECAST_HORIZON_DAYS = 14;
// Number of past years averaged for the climatological ("typical") estimate.
const CLIMATOLOGY_YEARS = 5;
const DAY_MS = 86400000;

function dateUTC(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
}

// Close trips get a real forecast; anything beyond the horizon falls back to a
// climatological average for the same calendar window.
export function pickMode(tripStartISO: string, today: Date): WeatherMode {
  const start = dateUTC(tripStartISO);
  if (start == null) return "typical";
  const t0 = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  const days = (start - t0) / DAY_MS;
  return days >= 0 && days <= FORECAST_HORIZON_DAYS ? "forecast" : "typical";
}

// WMO weather interpretation code -> icon + short label.
export function codeInfo(code: number): { emoji: string; label: string } {
  if (code <= 1) return { emoji: "☀️", label: "Clear" };
  if (code === 2) return { emoji: "⛅", label: "Partly cloudy" };
  if (code === 3) return { emoji: "☁️", label: "Cloudy" };
  if (code === 45 || code === 48) return { emoji: "🌫️", label: "Fog" };
  if (code >= 51 && code <= 57) return { emoji: "🌦️", label: "Drizzle" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))
    return { emoji: "🌧️", label: "Rain" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return { emoji: "❄️", label: "Snow" };
  if (code >= 95) return { emoji: "⛈️", label: "Storms" };
  return { emoji: "☁️", label: "Cloudy" };
}

// Turn the temp/condition into a one-line packing suggestion. Phrased as advice
// ("bring a jacket") not a promise, so it reads fine under the "Typical … avg"
// label when the estimate is climatological rather than a real forecast.
export function packingCue(w: WeatherResult): string | null {
  const rainy =
    (w.precipChance != null && w.precipChance >= 40) ||
    /rain|drizzle|storm|wet/i.test(w.condition);
  if (w.highC <= 12) return "bring a warm layer";
  if (rainy) return "pack an umbrella";
  if (w.highC >= 27) return "pack light";
  if (w.lowC <= 10) return "layer for the evenings";
  return null;
}

function mean(nums: number[]): number {
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

// Keep only finite numbers at the given indices; the two daily arrays from
// Open-Meteo can carry nulls for missing days.
function cleanPairs(a: unknown[], b: unknown[]): { a: number[]; b: number[] } {
  const outA: number[] = [];
  const outB: number[] = [];
  const n = Math.min(a?.length ?? 0, b?.length ?? 0);
  for (let i = 0; i < n; i++) {
    const x = a[i];
    const y = b[i];
    if (typeof x === "number" && typeof y === "number") {
      outA.push(x);
      outB.push(y);
    }
  }
  return { a: outA, b: outB };
}

// --- Forecast (trip is within the horizon) -------------------------------

export function forecastUrl(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string
): string {
  const p = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily:
      "temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_mean",
    timezone: "auto",
    start_date: startDate,
    end_date: endDate,
  });
  return `https://api.open-meteo.com/v1/forecast?${p.toString()}`;
}

export function summarizeForecast(daily: {
  temperature_2m_max?: unknown[];
  temperature_2m_min?: unknown[];
  weathercode?: unknown[];
  precipitation_probability_mean?: unknown[];
}): WeatherResult | null {
  const { a: highs, b: lows } = cleanPairs(
    daily?.temperature_2m_max ?? [],
    daily?.temperature_2m_min ?? []
  );
  if (highs.length === 0) return null;

  const codes = (daily?.weathercode ?? []).filter(
    (c): c is number => typeof c === "number"
  );
  // Pick the most severe code across the trip days (WMO codes grow roughly with
  // severity) so the icon reflects the worst weather you'd pack for.
  const worst = codes.length ? Math.max(...codes) : 0;
  const { emoji, label } = codeInfo(worst);

  const probs = (daily?.precipitation_probability_mean ?? []).filter(
    (p): p is number => typeof p === "number"
  );

  return {
    mode: "forecast",
    highC: Math.round(mean(highs)),
    lowC: Math.round(mean(lows)),
    emoji,
    condition: label,
    ...(probs.length ? { precipChance: Math.round(mean(probs)) } : {}),
  };
}

// --- Climatology (trip is far out) ---------------------------------------

// The trip's calendar days as "MM-DD" keys, so we can match the same window
// across past years regardless of year.
export function targetDayKeys(fromISO: string, toISO: string): string[] {
  const start = dateUTC(fromISO);
  const end = dateUTC(toISO);
  if (start == null || end == null || end < start) return [];
  if ((end - start) / DAY_MS > 30) return [];
  const keys: string[] = [];
  for (let t = start; t <= end; t += DAY_MS) {
    keys.push(new Date(t).toISOString().slice(5, 10));
  }
  return keys;
}

export function climatologyRange(
  fromISO: string,
  toISO: string
): { startDate: string; endDate: string; targetKeys: string[]; years: number } | null {
  const targetKeys = targetDayKeys(fromISO, toISO);
  if (targetKeys.length === 0) return null;
  const year = Number(fromISO.slice(0, 4));
  if (!Number.isFinite(year)) return null;
  const fromMMDD = fromISO.slice(5, 10);
  const toMMDD = toISO.slice(5, 10);
  return {
    startDate: `${year - CLIMATOLOGY_YEARS}-${fromMMDD}`,
    endDate: `${year - 1}-${toMMDD}`,
    targetKeys,
    years: CLIMATOLOGY_YEARS,
  };
}

export function archiveUrl(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string
): string {
  const p = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    start_date: startDate,
    end_date: endDate,
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum",
    timezone: "auto",
  });
  return `https://archive-api.open-meteo.com/v1/archive?${p.toString()}`;
}

// Average the archive rows whose MM-DD falls inside the trip window into a
// single "typical" estimate. Wetness drives the icon since the archive gives us
// precipitation totals rather than a per-day weathercode.
export function summarizeTypical(
  daily: {
    time?: unknown[];
    temperature_2m_max?: unknown[];
    temperature_2m_min?: unknown[];
    precipitation_sum?: unknown[];
  },
  targetKeys: string[],
  years: number
): WeatherResult | null {
  const times = daily?.time ?? [];
  const tmax = daily?.temperature_2m_max ?? [];
  const tmin = daily?.temperature_2m_min ?? [];
  const precip = daily?.precipitation_sum ?? [];
  const targets = new Set(targetKeys);

  const highs: number[] = [];
  const lows: number[] = [];
  let wetDays = 0;
  let counted = 0;

  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    if (typeof t !== "string" || !targets.has(t.slice(5, 10))) continue;
    const hi = tmax[i];
    const lo = tmin[i];
    if (typeof hi !== "number" || typeof lo !== "number") continue;
    highs.push(hi);
    lows.push(lo);
    counted++;
    const pr = precip[i];
    if (typeof pr === "number" && pr >= 1) wetDays++;
  }

  if (highs.length === 0) return null;

  const wetFraction = counted ? wetDays / counted : 0;
  let emoji = "☀️";
  let condition = "Usually dry";
  if (wetFraction >= 0.45) {
    emoji = "🌧️";
    condition = "Often wet";
  } else if (wetFraction >= 0.25) {
    emoji = "🌦️";
    condition = "Some rain";
  }

  return {
    mode: "typical",
    highC: Math.round(mean(highs)),
    lowC: Math.round(mean(lows)),
    emoji,
    condition,
    years,
  };
}
