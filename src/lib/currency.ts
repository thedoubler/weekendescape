import countries from "@/lib/airport-countries.json";

// Which currency to price a board in, chosen from the HOME airport — not the
// destination. The traveller pays in their own money, and every price on the
// board has to be comparable, so one currency per search.
//
// SERVER-ONLY (~106 KB lookup). Resolve in the route and let the currency ride
// on the response; `client-bundle.test.ts` keeps it out of the browser.
const AIRPORT_COUNTRIES = countries as Record<string, string>;

// Country names as OpenFlights spells them. Deliberately geographic Europe
// rather than the eurozone: a Pole flying from Kraków wants to compare EUR
// fares with everyone else's, and Kiwi prices in whatever we ask for.
const EUROPE = new Set([
  "Albania", "Andorra", "Austria", "Belarus", "Belgium", "Bosnia and Herzegovina",
  "Bulgaria", "Croatia", "Cyprus", "Czech Republic", "Denmark", "Estonia",
  "Faroe Islands", "Finland", "France", "Germany", "Gibraltar", "Greece",
  "Guernsey", "Hungary", "Iceland", "Ireland", "Isle of Man", "Italy", "Jersey",
  "Kosovo", "Latvia", "Liechtenstein", "Lithuania", "Luxembourg", "Macedonia",
  "Malta", "Moldova", "Monaco", "Montenegro", "Netherlands", "Norway", "Poland",
  "Portugal", "Romania", "Russia", "San Marino", "Serbia", "Slovakia",
  "Slovenia", "Spain", "Sweden", "Switzerland", "Turkey", "Ukraine",
  "United Kingdom",
]);

export const DEFAULT_CURRENCY = "EUR";

// EUR for a European origin, USD otherwise. An unknown airport falls back to
// EUR, which is right for this product's inventory — it is overwhelmingly
// European short-haul.
export function currencyForOrigin(iata: string): string {
  const country = AIRPORT_COUNTRIES[(iata || "").toUpperCase()];
  if (!country) return DEFAULT_CURRENCY;
  return EUROPE.has(country) ? "EUR" : "USD";
}
