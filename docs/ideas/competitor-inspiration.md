# Competitor inspiration — Skyweekend

Notes from studying [skyweekend.com](https://www.skyweekend.com/) (July 2026). Same core
concept as us (weekend round-trips, powered by Kiwi.com virtual interlining) but
**US-domestic only**, and a different model: they pick **one** weekend and step
through weekends, whereas we scan a **range** (next 1/2/3/6 months) — our model is
more powerful for "when is it cheapest".

## What they do that's interesting

### Search bar
- Departure airports as **chips** (up to 3) — multi-origin in one search.
- `To: anywhere` as an **editable pill** (default anywhere, or pin a destination).
- **Weekend stepper** `‹ Jul 18 ›`.
- `Depart ⌄` / `Return ⌄` dropdowns — fine control over depart/return day + time.
- Checkboxes: `Nonstop only`, `No red-eyes`, passenger count, `Thu–Sun` + `Fri–Mon`
  (non-exclusive — combine weekend shapes to widen options).
- Baked-in optimization: depart after 6pm, arrive before midnight ("don't lose a
  day to a morning flight"). We *visualize* usable time (day-blocks) instead.

### Results page
- **`🔥 Price X% lower than usual` deal badge** on standout fares (saw 29%, 65%, 23%).
  Their baseline is historical price data (which we don't have). ⭐ Best idea.
- **Map view** toggle (list ⇄ map of destinations). ⭐
- **Destination photos** on every card.
- Filter toolbar: `🔥 Deals` · `State` · `City` · `Days`.
- Mixes Thu–Sun and Fri–Mon results in one list, best per city.
- Virtual-interlining routes shown inline (`RDU–MCO–EYW`, `SAN–SEA–RDU`).
- `Change flight times` per card; `Book a hotel` cross-sell next to `See ticket`.
- "End of results. Try adding nearby airports for more options" nudge.
- Testimonials with real route + price (`ORD ⇄ DFW · $188`).

### What they DON'T have (our differentiation opportunities)
Per their FAQ: no email/price alerts, no price tracking, no accounts, no paid tier.

## Backlog — what's worth introducing (ranked by fit with our strengths)

Our real edges vs them: international (not US-only), range-scan, and the day-blocks
"usable time" visual. Ideas that reinforce those rank highest.

1. **No red-eyes filter** — 🟢 small. We already detect red-eyes (`isNightHour`, 🌙);
   just a Refine toggle to hide them.
2. **"Most time there" sort** — 🟢 small. We already have `stayMinutes` + day-blocks;
   a third sort makes our usable-time angle actionable.
3. **"Great value" deal badge** — 🟢 high value (see approach below).
4. **Map view** — 🟢 high "wow" for the weekend-escape concept. Needs dest coords + tiles.
5. **Destination photos** — 🟡 aspirational; needs an image source per city.
6. **Multi-origin / nearby airports** — 🟡 we already have `/locations/radius`.
7. **Price alerts** — 🟡 differentiator (they lack it); needs backend/persistence.

## Deal badge — chosen approach ("Great value")

**Constraint / honesty:** Skyweekend says "lower than *usual*" backed by price history.
We have **no history**, so we must NOT claim a historical baseline. Instead compute an
honest signal from the data already loaded in the list.

**Baseline options considered:**
- City's own weekend average (from the two-tier lookup) — rejected: the listed card is
  already the *cheapest* weekend for that city, so "below average" is guaranteed; it only
  measures price spread over time, and needs the on-expand fetch.
- Percentile / "top N cheapest" — rejected: just restates the sort; a cheap near-city
  flight isn't a deal, it's just short.
- **Distance-normalized (chosen):** distance drives what a flight *should* cost, so a fare
  is a deal if it's well below fares of similar distance in the current results.

**Method (client-side, no extra fetch, over `rawDeals`):**
```
add `distance` (km) to Deal from Kiwi `item.distance`   // one line in normalizeDeals
for each deal:
  peers    = ~7 nearest deals by distance
  baseline = median(peers.price)          // "typical fare for a trip this far"
  savings  = 1 - price / baseline
  badge if savings >= ~28% AND result count >= 8
```
- Median-of-neighbors (not a global line) is robust to the non-linear price/distance
  curve and to outliers.
- Compute over `rawDeals` so the baseline is stable when the user filters by month, etc.

**Design:**
- Honest wording: `🔥 Great value` with subtext/tooltip "≈30% below similar-distance
  trips" — NOT "than usual".
- Rare-by-design (the ~28% threshold keeps it on a few cards, so it stays meaningful).
- Placement: small pill near the price (top-right), like Skyweekend.
- Guardrails: no badge if `distance` is missing or fewer than ~8 results.

**Files:** `distance` in `Deal` (`normalizeDeals`); `src/lib/value.ts` (scoring + tests);
`page.tsx` memo over `rawDeals` → pass a score map to `DealCard`; pill in `DealCard`.

**Open question for later:** show the explicit % (`🔥 30% below similar trips`) vs. the
plain `🔥 Great value` pill.
