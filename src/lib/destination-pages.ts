// The destination pages — /weekends-in/rome — the second query family
// ("cheap weekend in Rome") after the origin boards' "weekend flights from".
// Curated like origin-pages.ts and for the same reasons: slugs a person
// would type, city codes Kiwi can search, no auto-generated junk surface.
//
// Every page runs ONE upstream search a day (all FROM cities in a single
// fly_from list), so ~30 destinations cost at most ~30 searches/day total.
export const DESTINATION_PAGES: { slug: string; code: string; city: string }[] = [
  { slug: "rome", code: "ROM", city: "Rome" },
  { slug: "milan", code: "MIL", city: "Milan" },
  { slug: "venice", code: "VCE", city: "Venice" },
  { slug: "florence", code: "FLR", city: "Florence" },
  { slug: "naples", code: "NAP", city: "Naples" },
  { slug: "barcelona", code: "BCN", city: "Barcelona" },
  { slug: "madrid", code: "MAD", city: "Madrid" },
  { slug: "seville", code: "SVQ", city: "Seville" },
  { slug: "valencia", code: "VLC", city: "Valencia" },
  { slug: "palma", code: "PMI", city: "Palma de Mallorca" },
  { slug: "lisbon", code: "LIS", city: "Lisbon" },
  { slug: "porto", code: "OPO", city: "Porto" },
  { slug: "paris", code: "PAR", city: "Paris" },
  { slug: "nice", code: "NCE", city: "Nice" },
  { slug: "amsterdam", code: "AMS", city: "Amsterdam" },
  { slug: "brussels", code: "BRU", city: "Brussels" },
  { slug: "berlin", code: "BER", city: "Berlin" },
  { slug: "munich", code: "MUC", city: "Munich" },
  { slug: "vienna", code: "VIE", city: "Vienna" },
  { slug: "prague", code: "PRG", city: "Prague" },
  { slug: "budapest", code: "BUD", city: "Budapest" },
  { slug: "krakow", code: "KRK", city: "Kraków" },
  { slug: "warsaw", code: "WAW", city: "Warsaw" },
  { slug: "copenhagen", code: "CPH", city: "Copenhagen" },
  { slug: "stockholm", code: "ARN", city: "Stockholm" },
  { slug: "dublin", code: "DUB", city: "Dublin" },
  { slug: "edinburgh", code: "EDI", city: "Edinburgh" },
  { slug: "london", code: "LON", city: "London" },
  { slug: "athens", code: "ATH", city: "Athens" },
  { slug: "santorini", code: "JTR", city: "Santorini" },
  { slug: "istanbul", code: "IST", city: "Istanbul" },
  { slug: "dubrovnik", code: "DBV", city: "Dubrovnik" },
  { slug: "split", code: "SPU", city: "Split" },
  { slug: "malta", code: "MLA", city: "Malta" },
  { slug: "marrakesh", code: "RAK", city: "Marrakesh" },
];

const BY_SLUG = new Map(DESTINATION_PAGES.map((d) => [d.slug, d]));

export function destinationBySlug(slug: string) {
  return BY_SLUG.get(slug.toLowerCase()) ?? null;
}

// The FROM set every destination page searches: the major European metros.
// The audience is European; a "weekend in Rome" page answering from Tokyo
// would be neither honest nor useful. The destination's own city is filtered
// out at search time.
export const DESTINATION_FROM = [
  "LON", "PAR", "AMS", "FRA", "MAD", "BCN", "ROM", "MIL", "BER", "MUC",
  "VIE", "ZRH", "BRU", "CPH", "ARN", "DUB", "LIS", "PRG", "BUD", "WAW", "OTP",
];
