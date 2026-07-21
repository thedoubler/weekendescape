import { airportCoords } from "@/lib/weather";

// Rough per-person CO₂ estimate for a round-trip flight, from the great-circle
// distance between the two airports. This is an ESTIMATE for orientation, not a
// certified figure — real emissions depend on aircraft, load factor, routing and
// non-CO₂ effects (contrails etc.) we don't model. Labelled "est." in the UI.

// Actual routes are longer than the great-circle path; a standard uplift.
const DETOUR_FACTOR = 1.09;
// kg CO₂ per passenger-km, economy class (DEFRA/ICAO-style short-haul average,
// CO₂ only — no radiative-forcing multiplier, to avoid over-stating).
const KG_PER_PASSENGER_KM = 0.15;
const EARTH_RADIUS_KM = 6371;

function haversineKm(a: [number, number], b: [number, number]): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// Round-trip, per-person CO₂ in kg, or null when either airport is unknown.
// Rounded to the nearest 5 kg so the number reads as the estimate it is.
export function estimateFlightCo2Kg(
  fromIata: string,
  toIata: string
): number | null {
  const from = airportCoords(fromIata);
  const to = airportCoords(toIata);
  if (!from || !to) return null;
  const oneWayKm = haversineKm(from, to) * DETOUR_FACTOR;
  const kg = oneWayKm * 2 * KG_PER_PASSENGER_KM;
  return Math.round(kg / 5) * 5;
}

// A weekend within short-haul range is a genuinely low-footprint trip; flag it
// so the UI can give it a subtle "greener" treatment.
export function isLowCo2(kg: number): boolean {
  return kg <= 200;
}
