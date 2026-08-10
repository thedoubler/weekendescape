// Airline codes the bundled table gets wrong.
//
// `airlines.json` is Wikidata-derived and frozen. IATA two-letter codes are
// recycled: when a carrier folds, its code is reassigned years later. The table
// keeps the dead carrier, so we confidently print the wrong airline — e.g. a
// Bucharest flight labelled "African Safari Airways", a carrier that stopped
// flying around 2010.
//
// This is worse than showing nothing: a wrong airline is a fact the user might
// act on. Hence two lists — corrections we have checked, and codes we know are
// wrong but cannot confidently name.
//
// To find more: list the distinct `airlines` codes across live boards, map them
// through `airlineName`, and look for carriers whose home region has no business
// on the route (Indian cargo, Kenyan charter, US carriers long since dissolved).

// Verified corrections.
export const AIRLINE_OVERRIDES: Record<string, string> = {
  // Romanian leisure carrier; the table still has African Safari Airways.
  A2: "Animawings",
  // Romanian/Moldovan carrier; the table has 748 Air Services, a Kenyan operator.
  H4: "HiSky",
  // Greek carrier out of Heraklion; the table has Blue Dart Aviation, an Indian
  // cargo airline that would never appear on a weekend leisure board.
  BZ: "Blue Bird Airways",
};

// Known-stale, deliberately NOT guessed. `airlineName` falls back to the bare
// code for these — unhelpful, but honest. Move one into the map above only once
// its current operator has actually been confirmed.
export const AIRLINE_UNVERIFIED = new Set<string>([
  // Miami Air International ceased operations in 2020; current holder unknown.
  "LL",
  // Deccan Charters is an Indian operator; current holder unknown.
  "DN",
]);
