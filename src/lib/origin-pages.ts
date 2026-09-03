// The origin boards the site tells the world about: sitemap entries, the
// crawlable link blocks, and the /from/[iata] titles all read THIS list, so
// a new origin is one entry here and nothing else.
//
// Curated, not generated. Metro codes (LON, PAR…) don't exist in
// airport-cities.json, and several airport entries carry names no page
// should wear ("Tallinn-ulemiste International", "Mulhouse" for Basel) — so
// each entry names its city the way a person searching for it would.
//
// Every page here renders lazily on first request and revalidates daily
// (see from/[iata]/page.tsx), so listing ~60 costs no build time and at most
// one upstream search per origin per day.
export const ORIGIN_PAGES: { code: string; city: string }[] = [
  { code: "LON", city: "London" },
  { code: "PAR", city: "Paris" },
  { code: "AMS", city: "Amsterdam" },
  { code: "FRA", city: "Frankfurt" },
  { code: "MAD", city: "Madrid" },
  { code: "BCN", city: "Barcelona" },
  { code: "ROM", city: "Rome" },
  { code: "MIL", city: "Milan" },
  { code: "BER", city: "Berlin" },
  { code: "MUC", city: "Munich" },
  { code: "HAM", city: "Hamburg" },
  { code: "CGN", city: "Cologne" },
  { code: "DUS", city: "Düsseldorf" },
  { code: "STR", city: "Stuttgart" },
  { code: "VIE", city: "Vienna" },
  { code: "ZRH", city: "Zurich" },
  { code: "GVA", city: "Geneva" },
  { code: "BSL", city: "Basel" },
  { code: "BRU", city: "Brussels" },
  { code: "LUX", city: "Luxembourg" },
  { code: "CPH", city: "Copenhagen" },
  { code: "ARN", city: "Stockholm" },
  { code: "OSL", city: "Oslo" },
  { code: "HEL", city: "Helsinki" },
  { code: "DUB", city: "Dublin" },
  { code: "MAN", city: "Manchester" },
  { code: "EDI", city: "Edinburgh" },
  { code: "LIS", city: "Lisbon" },
  { code: "OPO", city: "Porto" },
  { code: "FAO", city: "Faro" },
  { code: "ATH", city: "Athens" },
  { code: "SKG", city: "Thessaloniki" },
  { code: "PRG", city: "Prague" },
  { code: "BUD", city: "Budapest" },
  { code: "WAW", city: "Warsaw" },
  { code: "KRK", city: "Kraków" },
  { code: "GDN", city: "Gdańsk" },
  { code: "OTP", city: "Bucharest" },
  { code: "CLJ", city: "Cluj-Napoca" },
  { code: "SOF", city: "Sofia" },
  { code: "BEG", city: "Belgrade" },
  { code: "ZAG", city: "Zagreb" },
  { code: "LJU", city: "Ljubljana" },
  { code: "VCE", city: "Venice" },
  { code: "BLQ", city: "Bologna" },
  { code: "NAP", city: "Naples" },
  { code: "CTA", city: "Catania" },
  { code: "TRN", city: "Turin" },
  { code: "NCE", city: "Nice" },
  { code: "TLS", city: "Toulouse" },
  { code: "LYS", city: "Lyon" },
  { code: "MRS", city: "Marseille" },
  { code: "BOD", city: "Bordeaux" },
  { code: "RIX", city: "Riga" },
  { code: "VNO", city: "Vilnius" },
  { code: "TLL", city: "Tallinn" },
  { code: "IST", city: "Istanbul" },
  { code: "AGP", city: "Málaga" },
  { code: "SVQ", city: "Seville" },
  { code: "VLC", city: "Valencia" },
  { code: "PMI", city: "Palma de Mallorca" },
  { code: "IBZ", city: "Ibiza" },
  // Beyond Europe (added by request): metro codes where one exists, so the
  // page covers every airport the city flies from. Weekend shape stays
  // Fri–Sun — honest everywhere here (Dubai moved to a Sat–Sun weekend in
  // 2022; origins whose weekend genuinely differs, like Tel Aviv, are
  // deliberately absent until per-country weekends ship).
  { code: "NYC", city: "New York" },
  { code: "MIA", city: "Miami" },
  { code: "LAX", city: "Los Angeles" },
  { code: "SFO", city: "San Francisco" },
  { code: "CHI", city: "Chicago" },
  { code: "BOS", city: "Boston" },
  { code: "YTO", city: "Toronto" },
  { code: "YVR", city: "Vancouver" },
  { code: "MEX", city: "Mexico City" },
  { code: "SAO", city: "São Paulo" },
  { code: "BUE", city: "Buenos Aires" },
  { code: "BOG", city: "Bogotá" },
  { code: "SCL", city: "Santiago" },
  { code: "LIM", city: "Lima" },
  { code: "TYO", city: "Tokyo" },
  { code: "SEL", city: "Seoul" },
  { code: "SIN", city: "Singapore" },
  { code: "BKK", city: "Bangkok" },
  { code: "HKG", city: "Hong Kong" },
  { code: "DXB", city: "Dubai" },
];

// The homepage footer's curated mix — Europe still leads (it is the
// audience), with the world represented rather than buried below the fold of
// a 24-link alphabet. Origin pages and /about keep the full list.
export const FEATURED_HOME = [
  "LON", "PAR", "AMS", "MAD", "BCN", "ROM", "MIL", "BER", "MUC", "VIE",
  "ZRH", "BRU", "CPH", "DUB", "LIS", "ATH", "PRG", "BUD", "WAW", "OTP",
  "NYC", "MIA", "YTO", "MEX", "SAO", "BUE", "TYO", "SIN", "BKK", "DXB",
];

const BY_CODE = new Map(ORIGIN_PAGES.map((o) => [o.code, o.city]));

/** The curated city name for an origin-page code, or null if not curated. */
export function originPageCity(iata: string): string | null {
  return BY_CODE.get(iata.toUpperCase()) ?? null;
}
