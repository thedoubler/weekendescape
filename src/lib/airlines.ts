import airlines from "@/lib/airlines.json";

// IATA airline code -> display name. Sourced from Wikidata (preferring carriers
// with no dissolution date, so reused codes resolve to the airline flying today)
// with curated overrides for the low-cost groups and a few flag carriers. Used
// to show carrier names on hover rather than bare two-letter codes.
const AIRLINES = airlines as Record<string, string>;

// Full airline name for a code, or the code itself when unknown so the UI always
// has something to show.
export function airlineName(code: string): string {
  if (!code) return "";
  return AIRLINES[code.toUpperCase()] ?? code;
}
