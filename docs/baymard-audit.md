# Weekend Escape — Baymard UX audit (consolidated, 2026-07-23)

Five parallel agents audited every feature against Baymard Institute guidelines
(+ WCAG/NN-g where relevant), reading the real code. This is the deduped,
prioritized synthesis. **Items flagged by ≥2 audits are marked ⭐ (high confidence).**

> Caveat: many Baymard figures live behind their paywall; percentages here come
> from Baymard's free article intros + reputable secondary coverage — treat as
> directional. Qualitative principles are corroborated across sources. WCAG
> contrast ratios were computed locally against the app's actual theme tokens.

## Context that shapes priorities
No on-site checkout — the product **deep-links out to Kiwi** to book (and a hotel
partner for "Stay"). So **hand-off trust + price honesty** and **search recovery**
matter more than typical e-commerce; cart/checkout guidance matters less.

---

## Tier 1 — Quick wins (small effort, high value)

**Accessibility correctness (mobile/a11y audit):**
- ⭐ **Announce result count / search status / errors to screen readers.** The
  "N escapes / Searching… / Couldn't load" line (`page.tsx:668-676`) has no
  `aria-live`; errors (`DealList.tsx:98`) have no `role="alert"`. Add
  `role="status" aria-live="polite"` + `role="alert"`. [WCAG 4.1.3]
- **Focus-visible is missing app-wide**, and the airport input removes its outline
  (`AirportInput.tsx:132`) with only a 1px border shift. Add a global
  `:focus-visible` ring. [WCAG 2.4.7]
- **Low-opacity grey text fails AA contrast in light mode**: `black/40` 2.85:1,
  `black/45` 3.36:1, `black/50` 3.95:1 (need 4.5:1). Carries real info (day-strip
  month label, leg durations, "in N days"). Raise informational greys to ≥
  `black/55` (light) / `white/55` (dark); keep low opacity only for `·` dots.
  Error `text-red-500` (3.76:1) → `red-700 dark:red-400`. [WCAG 1.4.3]
- ⭐ **Tap targets too small.** Primary **Book** CTA + Stay are ~20px inline links
  <24px apart (`DealCard.tsx:408-427`) — fails WCAG 2.5.8 *and* it's the conversion
  event. Give `min-h-11` + ≥24px spacing. Light-mode hours-bar 2.26:1 → deepen fill
  (`orange-500`). Bridge-chip `amber-900/75` (4.42:1) → full `amber-900`.

**Price honesty (detail + results audits):**
- ⭐ **Label the headline price.** It's a *party total* when adults>1, yet the CO₂
  line right below says "per person" (`DealCard.tsx:359` vs `:546`). Append
  "Round trip · for N traveller(s)" (+ "incl. taxes" once confirmed with Tequila).
- **Hotel "Stay" hardcodes `group_adults:1`** (`hotels.ts:16`) even for a 4-person
  trip — pass the trip's `adults`. (Straight bug.)
- **Hand-off labels**: "Book on Kiwi" / "Stay · Booking.com", add the external-link
  icon to Stay too (only Book has one). [NN/g new-tab: warn before leaving]

**Autocomplete (entry + mobile audits):**
- ⭐ **No "no results" state** — an unmatched query shows a silent empty dropdown
  (`AirportInput.tsx:134`). Add "No airports match '{q}' — try a city or code".
- **Submits unvalidated text**: "Barcelona" + Enter → `flyFrom=BARCELONA` (broken).
  Only fire `onSearch` for a resolvable IATA/suggestion.
- ⭐ **`aria-activedescendant` + option `id`s** so SR users hear arrow-key movement.

**Filtering (filtering audit):**
- ⭐ **Short-stay hide is an invisible applied filter** — active by default, removes
  cards, but no chip and not in the active count (`page.tsx:399-402,784-799`). Add a
  chip, count it, include in "Clear all".
- **Max-price buckets have no counts** while Month/Region do (`PriceFilter.tsx`).
  Add "≤100 EUR (12)" — Baymard's "single highest-impact filter improvement".

**Results (results audit):**
- **Widen-window terminal state** — at the 6-month cap the CTA just vanishes
  (`page.tsx:406,839`). Add "That's every weekend in the next 6 months".

---

## Tier 2 — Medium effort, high value

- ⭐ **Don't auto-prompt geolocation on load over blank skeletons** (`page.tsx:205-235,
  482-493`). First-timers get a native OS location prompt on a screen that hasn't
  explained itself. Render the search form immediately (with a subtle "detecting…"
  hint), gate geolocation behind the "📍 Find my airport" tap. [web.dev permissions;
  NN/g skeletons stop helping >3s]
- ⭐ **Persistent destination thumbnail, esp. mobile.** The photo only peels in on
  desktop *hover* (`DealCard.tsx:276-307`) — so **mobile cards have no image**, and
  imagery is the #1 desire driver for travel. Show a real thumbnail; keep the peel as
  a hover enhancement. [Baymard: imageless items are "completely ignored"]
- ⭐ **Price freshness + "fares can change at Kiwi".** No timestamp today
  (`route.ts:236-240`); price reads as live but is 30-min cached. Return `fetchedAt`,
  show "Checked Xm ago · fares can change at Kiwi". **Highest-ROI fix for the
  deep-link model** — defuses the metasearch "price changed / trip gone" letdown.
- **Elevate price in the visual hierarchy** — price shares the exact type treatment
  as the city name (`text-lg font-semibold`, `:319` vs `:359`) so it doesn't read as
  the top attribute. Make it out-rank the city.
- **Value signal on the collapsed card** — promote a compact "cheapest in 3 mo / €X
  below typical" from the hidden `CheapestWeekend` panel. Trip analog of ratings.
- **Value proposition on entry + disclose deep-link-out.** "Est. cheapest weekends"
  is cryptic; say what it does + that booking is on Kiwi + prices are estimates
  (`page.tsx:476-478`).
- **No-results: relax ONE constraint** with counts ("Show 14 with any stops",
  "Expand to 6 months", "Remove Region: Asia") instead of only "Clear all".
- **Cross-facet counts** — Month(12)+Region(8) can both be shown yet combine to 0;
  compute each facet's count against the *other* active facets.

---

## Tier 3 — New filters & features (medium–large)

- **Filters for attributes we already show but can't filter** (Baymard: 38% fail
  this). Highest-want: **Nonstop as a refine** (client-side), **Trip duration /
  nights**, **Depart-time / no-red-eye**, **Airline**. Also country/city, "close to
  centre".
- **Promote Region + Price** above the list instead of burying all facets behind
  "Refine" (Baymard: 61% fail to surface key filters).
- **"Best value" sort** (price per night) — fits 2–4-night trips better than raw
  cheapest.
- **Total-trip-cost line** (flight + checked bag [+ far-airport transfer]) — 48%
  abandon on unexpected cost; "67% don't show total near the buy button".
- **Self-transfer / tight-layover warning** for multi-stop Kiwi itineraries
  (virtual-interlining risk). Data is in `outLayovers/backLayovers`.
- **Affiliate disclosure** ("we may earn a commission — your price is unchanged") +
  add `rel="…sponsored"` to Book to match Stay.
- **A11y structure**: skip-link to results, landmarks (`<search>`/`<nav>`), restore
  focus when the panel collapses, `enterkeyhint="search"`/`inputmode` on the field,
  reduced-motion guard on the photo peel (`DealCard.tsx:287`).
- **Persist expand state / deep-link a card** so a shared board opens on a trip.
- **Keep the single-column list** (correct for dense trip cards — don't add a grid).

---

## Already excellent (keep)
Header/brand; the DayBlocks day-timeline (thorough `aria-label`s, night-flight moon,
holiday/day-off tags); skeletons that mirror the collapsed card (no layout shift);
removable filter chips + "Clear all"; client-side instant refine; fetch timeouts with
retryable copy; lazy weather/image on expand; contextual empty states; honest CO₂ /
weather (forecast vs climatology) / baggage copy; **all dark-mode accent colours pass
AA** (amber/teal/green all >8:1 — the suspected dark-mode failures were a false alarm;
the real contrast issues are light-mode greys).

## Highest-ROI sequence if picking a few
1. Price-freshness + "fares can change at Kiwi" (Tier 2) — the deep-link model's #1 exposure.
2. Tier-1 a11y bundle (aria-live, focus, contrast, tap targets) — cheap, correctness.
3. Persistent mobile thumbnail (Tier 2).
4. Price labelling + hotel-adults bug + hand-off labels (Tier 1).
5. Stop auto-geolocation prompt (Tier 2).
