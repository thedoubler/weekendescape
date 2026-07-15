# Weekend Escape — Redesign & Richer Results Design

**Date:** 2026-07-15
**Status:** Approved for planning
**Builds on:** the initial `weekendescape` app (auto weekend-round-trip search via Kiwi Tequila API).

## Summary

Evolve the existing Weekend Escape app from a manual, dropdown-driven search into
an instant, richer experience: search runs automatically on load (geolocation →
nearest airport), results show real flight times, arrival time at the destination,
and true time-at-destination, with a visual "weekend blocks" strip. Dropdowns are
replaced by pill controls, and results can be filtered by month and sorted by
soonest-departure or price.

## Goals

- **Zero-click search:** results appear on load without pressing anything.
- **Feel the trip:** show weekday+day, local departure/arrival times, arrival time
  at the destination, and how long you actually get there.
- **See the weekend:** a day-blocks strip makes the weekend shape scannable.
- **Better controls:** pills instead of dropdowns; a month filter; sort toggle.

## Non-goals (YAGNI)

- No accounts / server persistence (home airport stays in `localStorage`).
- No map view, no price history/alerts, no multi-city.
- No timezone conversion — Kiwi `local_*` times are shown as local wall-clock.

## Architecture

Same Next.js 15 + TypeScript + Tailwind app. Changes are concentrated in the data
normalization layer, a few new pure helpers, and the client UI. The
`/api/weekends` route needs **no param changes** — the flight times are already in
the Tequila response; we just extract more of them.

### Data enrichment — `src/lib/deals.ts`

Extend `Deal` and `normalizeDeals` to pull times from the two flight legs
(`route[]`, identified by `return === 0` outbound / `return === 1` inbound):

```
interface Deal {
  cityTo: string;
  countryTo: string;
  flag: string;
  outDepart: string;   // ISO-local, outbound leg local_departure (from home)
  outArrive: string;   // ISO-local, outbound leg local_arrival (land at destination)
  backDepart: string;  // ISO-local, inbound leg local_departure (leave destination)
  backArrive: string;  // ISO-local, inbound leg local_arrival (arrive home)
  stayMinutes: number;  // backDepart − outArrive, in minutes (time at destination)
  nights: number;
  price: number;
  currency: string;
  deepLink: string;
}
```

`stayMinutes` is computed from the naive local timestamps (strip the trailing `Z`,
treat as wall-clock; no timezone math). Items missing any required leg/time are
skipped, as today.

### Formatting — `src/lib/format.ts` (new, pure)

- `dayLabel(iso): string` → `"Sat 8"` (weekday abbrev + day-of-month).
- `timeLabel(iso): string` → `"22:10"` (local `HH:MM`).
- `durationLabel(minutes): string` → `"2d 1h"` / `"18h"` / `"45m"` (drops zero units).
- `dayBlocks(outDepart, backArrive): DayCell[]` → one cell per calendar day from the
  departure day through the return day inclusive:
  `DayCell { weekday: string; day: number; isWeekend: boolean; role: "depart" | "return" | "middle" }`.
  `isWeekend` = Sat or Sun. The depart day is the outbound date; the return day is
  the inbound arrival date; days between are `middle`.

### Sorting & filtering — `src/lib/sort.ts` (new, pure)

- `type SortKey = "soonest" | "cheapest"`.
- `sortDeals(deals, key): Deal[]` → `soonest` orders by `outDepart` ascending;
  `cheapest` by `price` ascending (ties broken by `outDepart`).
- `monthsOf(deals): string[]` → distinct `YYYY-MM` of each deal's `outDepart`,
  ascending — the set the month filter offers.
- `filterByMonths(deals, months): Deal[]` → keeps deals whose `outDepart` month is
  in `months`; an empty `months` set means no filter (all deals).

Sorting and filtering are **client-side only** — changing sort or month never
refetches.

## UI & interaction — `src/app/page.tsx` and components

### Auto-search on load
On mount: request geolocation → `GET /api/airports?lat&lon` → set home airport →
run the search. Fallbacks (no blocking errors):
1. Geolocation denied/unavailable → use a saved home airport from `localStorage`
   if present, and search it.
2. No saved airport → focus the home-airport input, show no results yet.

There is **no Search button**. Changing the home airport (on blur/enter), the
weekend style, or the timeline **re-runs the search**. Changing the month filter or
sort only re-derives the visible list client-side.

### Controls — pills, not dropdowns
A reusable `SegmentedControl` (pill group) replaces every `<select>`:
- **Weekend style:** Strict · Fri–Mon · Loose.
- **Timeline:** 1m · 2m · 3m · 6m (default 3).
- **Sort:** Soonest · Cheapest (default **Soonest**).
- **Month filter (`MonthFilter`):** one pill per month in `monthsOf(deals)`, labeled
  `"Aug"` etc. Multi-select toggle; **none selected by default = all months**. A
  small "All" affordance clears the selection. Derived from current results, so
  empty months never appear.

### Day blocks — `DayBlocks` component
Renders the `DayCell[]` as a horizontal strip: each cell shows weekday + day; Sat/Sun
cells get the weekend accent (coral); depart/return cells carry plane-departure/
arrival icons. Purely presentational.

### Hybrid card — `DealCard`
- **Collapsed (default):** destination + flag + country, the `DayBlocks` strip, a
  one-line summary ("Out Sat 21:05 → land 22:10 · back Mon 22:45 · 2d 1h there"),
  price, and a Book link. A subtle "in N days" hint.
- **Expanded (on click):** reveals two explicit flight lines — outbound
  (`home 21:05 → dest 22:10 · Sat`) and return (`dest 22:45 → home 23:45 · Mon`) —
  plus a "≈ 2 days in <city>" pill. Toggled by local component state; keyboard-
  accessible (button semantics, `aria-expanded`).

`DealList` maps the filtered+sorted deals to `DealCard`s; loading/error/empty states
as today, with an added empty state when a month filter excludes everything ("No
deals in the selected months").

## Data flow

1. Mount → geolocate → `/api/airports` → home airport → `/api/weekends?flyFrom&style&months`.
2. Route returns enriched `Deal[]` (now with times + `stayMinutes`).
3. Client keeps the raw list; derives the view via
   `filterByMonths` → `sortDeals` on every sort/month/results change.
4. `MonthFilter` options come from `monthsOf(rawDeals)`.

## Error handling

- Geolocation denied → silent fallback chain above; a one-line hint that manual
  entry works.
- `/api/airports` empty/failed → error message, input focused.
- `/api/weekends` failure → existing generic message.
- Zero results overall vs. zero after month filter → distinct empty-state copy.

## Testing

- **Unit (`format.ts`):** `dayLabel`, `timeLabel`, `durationLabel` (multi/zero
  units), `dayBlocks` (weekend accent, roles, multi-day span, single-night trip).
- **Unit (`sort.ts`):** `sortDeals` both keys + tie-break; `monthsOf` distinct+sorted;
  `filterByMonths` including the empty-set = all rule.
- **Unit (`deals.ts`):** enriched `normalizeDeals` extracts all four times and
  computes `stayMinutes`; skips items missing a leg/time.
- **Component:** `SegmentedControl` selection/callback; `DayBlocks` weekend accent
  and icon roles; `DealCard` collapsed content + expand/collapse via click and
  keyboard.
- **Page:** auto-search on mount with mocked `navigator.geolocation` + `fetch`;
  geolocation-denied fallback to saved airport; pill change re-runs search; sort and
  month changes re-derive the list without a new fetch (assert `fetch` call count).

## Defaults chosen (not asked)

- Geolocation-denied fallback to saved airport then focused input.
- Month filter is multi-select, client-side, default all.
- Card expand is per-card local state (multiple can be open); collapsed by default.
- Day-blocks span exactly departure→return inclusive (not a fixed week window).
