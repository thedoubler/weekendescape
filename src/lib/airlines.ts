import airlines from "@/lib/airlines.json";
import { AIRLINE_OVERRIDES, AIRLINE_UNVERIFIED } from "@/lib/airline-overrides";

// IATA airline code -> display name. Sourced from Wikidata (preferring carriers
// with no dissolution date, so reused codes resolve to the airline flying today)
// with curated overrides for the low-cost groups and a few flag carriers. Used
// to show carrier names on hover rather than bare two-letter codes.
const AIRLINES = airlines as Record<string, string>;

// Full airline name for a code, or the code itself when unknown so the UI always
// has something to show.
export function airlineName(code: string): string {
  if (!code) return "";
  const c = code.toUpperCase();
  // Checked correction first; then codes we know the table gets wrong but can't
  // name, which fall through to the bare code rather than a wrong airline; then
  // the table. See airline-overrides.ts.
  if (AIRLINE_OVERRIDES[c]) return AIRLINE_OVERRIDES[c];
  if (AIRLINE_UNVERIFIED.has(c)) return c;
  return AIRLINES[c] ?? c;
}
