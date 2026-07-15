# Weekend Escape — Stay Gauge, Arrival Clarity & Holiday Marking

**Date:** 2026-07-15
**Status:** Approved for planning (design approved via mockup + research)
**Builds on:** the redesigned Weekend Escape card (day-blocks, times, stay pill, sort/filter).

## Summary

Make the traveller *see* how much usable time they actually get. Replace the plain
"Out … → land … · back …" text line with a **stay gauge**: each day cell shows the
fraction of that day that is truly yours (coral fill) vs in-transit (gray). Mark
red-eye/late flights, show the origin airport so every trip is clearly from home,
and badge public holidays — in the **home** country ("no day off needed") and the
**destination** country ("holiday during your stay").

Research basis: no mainstream flight tool solves "usable time at destination"; the
proposal combines Google Flights' `+1` day-rollover convention, calendar-heatmap
single-glance coloring, jet-lag tools' day/night banding, and long-weekend tools'
"PTO needed" framing.

## Goals

- Show, per day, how much time is usable (arrive-time and depart-time made visual).
- Flag red-eye / overnight flights and cross-midnight arrivals (`+1`).
- Show the origin airport on every card (answer "are these all from home?").
- Badge home-country holidays as PTO savings, and destination holidays as context.

## Non-goals (YAGNI)

- No astronomical sunrise/sunset — day/night is fixed clock hours.
- No sleep-hatching on full middle days.
- No third "warning" accent color — red-eye uses an icon in ink; only holidays get
  a new (amber) channel, justified by calendar-app precedent.
- No destination *venue* closures beyond the public-holiday signal.

## Architecture

Same Next.js app. Three areas change: the deal model gains airport/country codes and
holiday annotations; the `/api/weekends` route enriches deals with holidays (server
side, cached) and locks the round-trip to the same airports; the card renders the
gauge, red-eye markers, origin chip, and holiday badges.

### 1. Deal enrichment — `src/lib/deals.ts`

Extend `Deal` and `normalizeDeals` (Tequila items already carry these fields):

```
interface Deal {
  cityTo: string; countryTo: string; flag: string;
  flyFrom: string;   // origin IATA, item.flyFrom (e.g. "BCN")
  flyTo: string;     // dest IATA, item.flyTo (e.g. "VCE")
  countryFromCode: string;  // item.countryFrom.code (e.g. "ES")
  countryToCode: string;    // item.countryTo.code (e.g. "IT")
  outDepart: string; outArrive: string; backDepart: string; backArrive: string;
  stayMinutes: number; nights: number; price: number; currency: string; deepLink: string;
}
```

Holiday annotations are added later by the route (see §3), not by `normalizeDeals`.
Skip items missing `flyFrom`/`flyTo` (in addition to the existing required fields).

### 2. Gauge & red-eye helpers — `src/lib/format.ts`

Rework `dayBlocks` to model the **time actually at the destination** — the span from
landing (`outArrive`) to leaving (`backDepart`), not `outDepart`→`backArrive`:

```
interface DayCell {
  weekday: string; day: number; month: string; isWeekend: boolean;
  role: "arrive" | "leave" | "middle" | "solo";
  fillStart: number;  // 0..1 — usable portion start (fraction of the day)
  fillEnd: number;    // 0..1 — usable portion end
}
function dayBlocks(outArrive: string, backDepart: string): DayCell[];
```

- Arrival day (first): `fillStart = arriveHour/24`, `fillEnd = 1`, role `arrive`.
- Departure day (last): `fillStart = 0`, `fillEnd = departHour/24`, role `leave`.
- Middle days: `fillStart = 0`, `fillEnd = 1`, role `middle`.
- Single day (land and leave same date): one `solo` cell, `fillStart = arriveHour/24`,
  `fillEnd = departHour/24`.
- `arriveHour`/`departHour` include minutes as a fraction (e.g. 08:20 → 8.33/24).

New red-eye helper:

```
function crossesMidnight(depIso: string, arrIso: string): boolean;  // arrival date > departure date
function isNightHour(iso: string): boolean;  // local hour in [0,6)
```

The card uses these on the outbound leg (`outDepart`→`outArrive`) for the arrival
cell, and the return leg (`backDepart`→`backArrive`) for the leave cell.

Existing `dayLabel`/`timeLabel`/`durationLabel`/`daysUntil` are unchanged.

### 3. Route enrichment — `src/app/api/weekends/route.ts` + `src/lib/holidays.ts`

**Same-airport lock:** add `ret_from_diff_airport: false` and `ret_to_diff_airport:
false` to the Tequila params so a round-trip can never return to a different home or
destination airport.

**Holiday enrichment (server side, after `normalizeDeals`):**

`src/lib/holidays.ts` (new):
```
interface Holiday { date: string; name: string }   // date = "YYYY-MM-DD"
async function fetchHolidays(countryCode: string, year: number): Promise<Holiday[]>;
// GET https://date.nager.at/api/v3/publicholidays/{year}/{CC}
// Next fetch cache: { next: { revalidate: 86400 } }; 404 → []; other errors → [].

function tripWorkdays(outArriveDate: string, backDepartDate: string): string[];
// distinct "YYYY-MM-DD" for each Mon–Fri calendar day in the inclusive span.

function annotate(deal, homeHolidays, destHolidays): DealHolidayInfo;
```

`DealHolidayInfo` (merged onto each deal by the route):
```
{
  ptoDays: number;                     // workdays in span NOT covered by a home holiday
  homeHoliday: { date, name } | null;  // first home holiday within the span (drives the PTO badge)
  destHoliday: { date, name } | null;  // first destination holiday within the span
}
```

Route flow:
1. `normalizeDeals` → deals with codes.
2. Collect the distinct set of `{ countryCode, year }` needed: the home country
   (`deals[0].countryFromCode`, same for all since one origin) plus each distinct
   `countryToCode`; years = the calendar years the trip spans (`outArrive`,
   `backDepart` — usually one, occasionally two).
3. `Promise.all` the `fetchHolidays` calls (deduped; Nager caches 24h).
4. For each deal, `annotate` against the home calendar and that destination's
   calendar → attach `ptoDays`, `homeHoliday`, `destHoliday`.
5. Return `{ deals }` (now holiday-annotated).

`Deal` type gains the three optional holiday fields (added in `deals.ts` so the type
is shared, but populated by the route). `ptoDays` defaults to the workday count with
no holidays; `homeHoliday`/`destHoliday` default `null`.

### 4. Card rendering — `DayBlocks` + `DealCard`

**`DayBlocks`** renders each cell with the gauge: a thin bar (`~8px`) with a coral fill
positioned by `fillStart`/`fillEnd`; weekend days keep the coral day-number accent;
the `arrive` cell shows a plane-arrival icon + arrival time (with `+1` when the
outbound crosses midnight and a moon glyph when it's a night arrival); the `leave`
cell shows a plane-departure icon + departure time (moon when night). The month
caption stays above the strip. Each cell keeps an `aria-label` (e.g. "Friday, arrive
08:20, most of the day usable"). The gray fill reuses the existing muted token; the
coral fill reuses the weekend-accent token (works in light/dark).

**`DealCard`** collapsed layout:
- Header: flag · city · country · origin chip `BCN → VCE` · price · "in N days".
- Month caption + the gauge strip (replaces the old text summary line — removed).
- The green stay pill (`{durationLabel} in {city}`) — unchanged.
- Holiday badges (see below).
- Expanded (on click): the two explicit flight lines, now with codes —
  `Outbound · Fri 18 06:30 BCN → VCE 08:20` / `Return · Sun 20 19:05 VCE → BCN 20:40`
  — plus any red-eye note.

**Holiday badges** (amber = its own channel, never the coral weekend accent):
- Home: when `homeHoliday` is set → amber pill
  `🎉 {holiday name} — {ptoDays === 0 ? "no day off needed" : ptoDays + " day off"}`.
- Destination: when `destHoliday` is set → a distinct-wording pill
  `{holiday name} in {city}` (context, not PTO). Rendered as a lighter/secondary tag
  so the two meanings never blur. Both may appear (user chose home + destination);
  home badge comes first.

## Data flow

1. Search → `/api/weekends` → normalized + holiday-annotated deals (same-airport).
2. Card computes `dayBlocks(outArrive, backDepart)` and red-eye flags from the deal's
   four times; renders gauge + markers + origin + holiday badges.

## Error handling

- Missing airport codes on an item → skip that deal.
- Nager.Date 404 (unknown country) or any error → treat as no holidays (`[]`); the
  card simply shows no badge. Holiday enrichment never fails the search.
- A deal with no workdays in span (pure Sat–Sun) → `ptoDays = 0`, no home badge unless
  a holiday still lands in-span.

## Testing

- **Unit (`format.ts`):** `dayBlocks` new span + `fillStart`/`fillEnd` for arrive/
  leave/middle/solo and a red-eye (sliver fills); `crossesMidnight`; `isNightHour`.
- **Unit (`deals.ts`):** `normalizeDeals` extracts `flyFrom`/`flyTo`/country codes;
  skips items missing codes.
- **Unit (`holidays.ts`):** `tripWorkdays` (Mon–Fri only, inclusive span, cross-month);
  `annotate` (home holiday reduces `ptoDays`; destination holiday detected; none →
  nulls); `fetchHolidays` maps Nager JSON and returns `[]` on 404/error (mock fetch).
- **Route:** `/api/weekends` sends `ret_from_diff_airport`/`ret_to_diff_airport`
  false; attaches holiday info from mocked `fetchHolidays`; a home holiday on the
  trip's Friday yields `ptoDays: 0` + `homeHoliday`.
- **Component:** `DayBlocks` renders the coral fill and the arrive/leave time labels,
  the `+1` and moon on a red-eye; `DealCard` shows the origin chip, the amber home
  badge with "no day off needed", the destination badge, and no old text line.

## Defaults chosen

- Day span for the gauge = `outArrive` → `backDepart` (time truly at destination).
- Night = local hours 00:00–05:59; `+1` only when a leg's arrival date > departure date.
- Home badge shows only when a home holiday lands in-span; PTO wording keys off `ptoDays`.
- Destination badge is context only (no PTO claim); both badges may show, home first.
