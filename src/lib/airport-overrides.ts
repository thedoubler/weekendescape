// Airports the bundled table misses or names differently.
//
// `airports.json` is OpenFlights-derived and frozen, so it lags real-world
// changes: airports that opened after the dump, and IATA codes that were
// reassigned. A missing code is not cosmetic — `airportCoords` returns null and
// the destination silently loses its weather, its map pin, its CO₂ estimate and
// its airport-distance caveat, with no error anywhere.
//
// Found by sweeping live boards from several origins and listing every deal
// whose `toCoords` came back null. Re-run that sweep when new blanks appear —
// `toCoords === null` on a deal is the symptom.

// Renames: the same physical airport under a code the table doesn't know.
// Resolved through the table itself rather than by writing coordinates here, so
// there is no second copy of the data to drift or mistype.
export const AIRPORT_ALIASES: Record<string, string> = {
  // Kiwi returns RMO for Chișinău; the table has the older KIV.
  RMO: "KIV",
};

// Genuinely absent: airports that opened after the dump, so there is no code to
// alias to. Only add an entry here when the coordinates have been checked —
// a wrong one is worse than a blank, because it silently produces confident,
// incorrect weather and a pin in the wrong country.
// [lat, lon].
export const AIRPORT_EXTRA: Record<string, [number, number]> = {
  // Berlin Brandenburg, opened 2020. The table has only the now-closed TXL/SXF.
  BER: [52.3622, 13.5013],
};

// Known-missing but deliberately NOT guessed:
//   NBJ — Luanda's new airport (opened 2023). Long-haul outlier, and I could
//   not verify its coordinates; left blank rather than invented. The card
//   degrades gracefully (no weather, no pin) instead of lying.
