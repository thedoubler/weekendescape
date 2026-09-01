// Generates src/lib/airport-regions.json (IATA → ISO-3166-2 region) and
// src/lib/region-names.json (region code → human name) from OurAirports.
//
// Run manually when the airport table changes:  node scripts/gen-airport-regions.mjs
// The outputs are committed, so builds never depend on ourairports.com being up.
//
// Source: https://ourairports.com/data/ — "All data is released to the Public
// Domain, and comes with no guarantee of accuracy or fitness for use."
// Fetched from the nightly-updated mirror the site itself links.
//
// Both outputs are SERVER-ONLY (guarded by client-bundle.test.ts): the region
// lookup happens inside the weekend search, and the client only ever sees the
// one region name the API response prints.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const AIRPORTS_CSV =
  "https://davidmegginson.github.io/ourairports-data/airports.csv";
const REGIONS_CSV =
  "https://davidmegginson.github.io/ourairports-data/regions.csv";

// OurAirports disagrees with ISO (and therefore with Nager.Date's `counties`)
// on a handful of codes. Verified against Nager responses when this landed:
// Brandenburg is DE-BB in ISO, DE-BR in OurAirports (79 airports incl. BER).
const REGION_REMAP = { "DE-BR": "DE-BB" };

// A real CSV row parser — airport names contain commas ("Berlin, Brandenburg").
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function columnIndex(header, name) {
  const i = header.indexOf(name);
  if (i === -1) throw new Error(`column ${name} not found`);
  return i;
}

// ISO-3166-2 shape; OurAirports' "unassigned" pseudo-regions (XX-U-A etc.)
// deliberately fail this test and are dropped.
const REGION_RE = /^[A-Z]{2}-[A-Z0-9]{1,3}$/;

const knownIata = new Set(
  Object.keys(
    JSON.parse(readFileSync(join(root, "src/lib/airports.json"), "utf8"))
  )
);

const airportsText = await (await fetch(AIRPORTS_CSV)).text();
const [aHeader, ...aRows] = parseCsv(airportsText);
const iataCol = columnIndex(aHeader, "iata_code");
const regionCol = columnIndex(aHeader, "iso_region");
const serviceCol = columnIndex(aHeader, "scheduled_service");

const airportRegions = {};
let skippedShape = 0;
for (const r of aRows) {
  const iata = r[iataCol];
  if (!iata || !knownIata.has(iata)) continue;
  let region = REGION_REMAP[r[regionCol]] ?? r[regionCol];
  if (!REGION_RE.test(region)) { skippedShape++; continue; }
  // Prefer the scheduled-service row when two share an IATA code (closed
  // fields keep stale codes).
  if (!(iata in airportRegions) || r[serviceCol] === "yes")
    airportRegions[iata] = region;
}

const regionsText = await (await fetch(REGIONS_CSV)).text();
const [rHeader, ...rRows] = parseCsv(regionsText);
const codeCol = columnIndex(rHeader, "code");
const nameCol = columnIndex(rHeader, "name");
const localCol = columnIndex(rHeader, "local_code");
void localCol;

// Names for every region in a country we have at least one airport in — the
// picker lists a country's regions, and a user can live in a region with no
// airport of its own (fly MAD, live in Extremadura).
const countries = new Set(
  Object.values(airportRegions).map((c) => c.slice(0, 2))
);
const regionNames = {};
for (const r of rRows) {
  let code = REGION_REMAP[r[codeCol]] ?? r[codeCol];
  if (!REGION_RE.test(code) || !countries.has(code.slice(0, 2))) continue;
  if (r[nameCol]) regionNames[code] = r[nameCol];
}

const sortObj = (o) =>
  Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));

writeFileSync(
  join(root, "src/lib/airport-regions.json"),
  JSON.stringify(sortObj(airportRegions))
);
writeFileSync(
  join(root, "src/lib/region-names.json"),
  JSON.stringify(sortObj(regionNames))
);

console.log(
  `airport-regions: ${Object.keys(airportRegions).length} airports ` +
    `(${skippedShape} rows dropped for non-ISO region); ` +
    `region-names: ${Object.keys(regionNames).length} regions in ${countries.size} countries`
);
// BER is deliberately absent: the bundled airports.json predates it (it still
// carries TXL). When that table is regenerated, add ["BER", "DE-BB"] here —
// it exercises the REGION_REMAP.
for (const [iata, want] of [
  ["BCN", "ES-CT"],
  ["MUC", "DE-BY"],
  ["VIE", "AT-9"],
  ["CLJ", "RO-CJ"],
]) {
  const got = airportRegions[iata];
  console.log(`  spot-check ${iata}: ${got} ${got === want ? "✓" : `✗ expected ${want}`}`);
}
