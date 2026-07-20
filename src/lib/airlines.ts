import airlines from "@/lib/airlines.json";

// IATA airline code -> display name (OpenFlights-derived, with corrections for
// stale duplicate codes). Used to show carrier names on hover rather than bare
// two-letter codes. Small enough (~28 KB) to import anywhere.
const AIRLINES = airlines as Record<string, string>;

// Full airline name for a code, or the code itself when unknown so the UI always
// has something to show.
export function airlineName(code: string): string {
  if (!code) return "";
  return AIRLINES[code.toUpperCase()] ?? code;
}
