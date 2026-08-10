import cities from "@/lib/airport-cities.json";
import { AIRPORT_ALIASES } from "@/lib/airport-overrides";

// IATA -> the town the airport is actually IN, as opposed to the city it is
// marketed under. OpenFlights-derived (the same dump `airports.json` came from —
// this column was dropped when that file was reduced to coordinates).
//
// This exists because low-cost inventory is full of airports sold under a bigger
// city's name: BGY is "Milan" but sits in Bergamo, CRL is "Brussels" but sits in
// Charleroi. The card could say how FAR the airport was but never WHERE it was,
// which is the actionable half.
//
// SERVER-ONLY (~103 KB). Resolve on the server and put the answer on the API
// response; `client-bundle.test.ts` enforces that it never reaches the browser.
const AIRPORT_CITIES = cities as Record<string, string>;

// The source is itself marketed for a handful of airports — OpenFlights lists
// LTN's city as "London", not Luton — so those fall back to the bare distance.
// Only listed here where the airport is genuinely in a DIFFERENT town and the
// name is the one people actually use.
const TRUE_CITY: Record<string, string> = {
  LTN: "Luton",
  STN: "Stansted",
  NYO: "Nyköping", // Skavsta
  WMI: "Modlin",
  NRT: "Narita",
};

// No suppression list is needed for the "technically a different village" case,
// because this dataset doesn't have it: MXP is listed as "Milano", ARN as
// "Stockholm", SAW as "Istanbul" — the source already gives the name people
// use for a city's own principal airport. The prefix match below then collapses
// "Milano" vs "Milan" and "Girona-Costa Brava" vs "Girona" to silence.
//
// LGW is the one worth naming as a decision: the source says "London", and the
// town is Crawley — but the airport IS "Gatwick", so neither name beats the
// plain distance line. Left alone on purpose.
//
// Neither map is exhaustive and neither needs to be. Gaps are found by sweeping
// live boards for deals with `airportKmFromCity >= 30` and no `airportCity`.
// An airport nobody has looked at falls back to the distance, which is correct
// — just less useful. The failure mode is silence, never a wrong claim.

// Kiwi itself cannot answer this: its `city.name` IS the marketing name
// (`BGY -> "Milan"`), so it would only restate the problem.
export function airportCity(iata: string): string | null {
  if (!iata) return null;
  const code = iata.toUpperCase();
  return (
    TRUE_CITY[code] ??
    AIRPORT_CITIES[code] ??
    AIRPORT_CITIES[AIRPORT_ALIASES[code] ?? ""] ??
    null
  );
}

// Loose comparison so "Girona" doesn't get announced as different from
// "Girona-Costa Brava", and accents/case never cause a false mismatch.
function sameplace(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return x === y || x.startsWith(y) || y.startsWith(x);
}

// The airport's town, but ONLY when it differs from the city the deal is sold
// as. Null the rest of the time, so the card can stay silent — saying "you land
// in Girona, 12 km from Girona" would be noise.
export function distinctAirportCity(
  iata: string,
  marketedCity: string
): string | null {
  const city = airportCity(iata);
  if (!city || !marketedCity) return null;
  return sameplace(city, marketedCity) ? null : city;
}
