import airports from "@/lib/airports.json";
import { AIRPORT_ALIASES, AIRPORT_EXTRA } from "@/lib/airport-overrides";

// IATA airport code -> [lat, lon]. Bundled (OpenFlights-derived) so we can hit
// Open-Meteo without a separate geocoding round-trip.
//
// SERVER-ONLY. This module exists purely to keep the ~134 KB / 6k-entry table
// out of the browser. It used to live in `weather.ts`, but `weather.ts` also
// exports `packingCue`, which a client component imports — so the whole table
// was being shipped to every visitor. Bundlers do not tree-shake it away: the
// data was verified present in a client chunk.
//
// Never import this from a file that a "use client" module can reach. Resolve
// coordinates on the server and put the result on the API response instead
// (see `toCoords` in the /api/weekends route). `client-bundle.test.ts` enforces
// this and will fail with the offending import chain if it is broken.
const AIRPORTS = airports as unknown as Record<string, [number, number]>;

export function airportCoords(iata: string): [number, number] | null {
  if (!iata) return null;
  const code = iata.toUpperCase();
  // Table first, then the alias for a renamed airport, then anything that
  // opened after the dump. See airport-overrides.ts for why these exist.
  return (
    AIRPORTS[code] ??
    (AIRPORT_ALIASES[code] ? AIRPORTS[AIRPORT_ALIASES[code]] : undefined) ??
    AIRPORT_EXTRA[code] ??
    null
  );
}
