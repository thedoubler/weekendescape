import cities from "@/lib/cities.json";
import { airportCoords } from "@/lib/weather";

// "<country code>:<normalized city name>" -> [lat, lon] of the city centre.
// Bundled (GeoNames-derived, pop >= 50k) so we can measure how far an airport
// sits from the city it's marketed as — e.g. CRL is sold as "Brussels" but is
// ~44 km away. Server-only import (~1.8 MB); never shipped to the browser.
const CITIES = cities as unknown as Record<string, [number, number]>;

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function cityCoords(
  name: string,
  countryCode: string
): [number, number] | null {
  if (!name || !countryCode) return null;
  const key = `${countryCode.toUpperCase()}:${norm(name)}`;
  return CITIES[key] ?? null;
}

const EARTH_RADIUS_KM = 6371;

export function haversineKm(
  a: [number, number],
  b: [number, number]
): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// Straight-line km from the airport to its marketed city centre, or null when
// either coordinate is unknown. Rounded — it's a rough "how far out is this?"
// signal, not a routing estimate.
export function airportCityKm(
  iata: string,
  cityName: string,
  countryCode: string
): number | null {
  const airport = airportCoords(iata);
  const city = cityCoords(cityName, countryCode);
  if (!airport || !city) return null;
  return Math.round(haversineKm(airport, city));
}
