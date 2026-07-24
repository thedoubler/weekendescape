# Weekend Escape — Baymard UX audit (consolidated, 2026-07-23)

Five parallel agents audited every feature against Baymard Institute guidelines
(+ WCAG/NN-g where relevant), reading the real code. This is the deduped,
prioritized synthesis. **Items flagged by ≥2 audits are marked ⭐ (high confidence).**

> Caveat: many Baymard figures live behind their paywall; percentages here come
> from Baymard's free article intros + reputable secondary coverage — treat as
> directional. Qualitative principles are corroborated across sources. WCAG
> contrast ratios were computed locally against the app's actual theme tokens.

## Status (2026-07-23)
**Shipped this pass:** price "round trip · N travellers" label; price-freshness
stamp ("checked X ago · fares can change at booking") via `fetchedAt`; hand-off
labels ("Book on Kiwi" + external-link icons, opens-new-tab aria); hotel
`group_adults` bug fixed (uses party size); airport autocomplete no-results state +
don't-submit-invalid + `aria-activedescendant` + focus-visible ring + 44px option
rows; first-load explainer (value prop + location-use note) instead of bare
skeletons; short-stay hidden count surfaced + reset in "Clear all"; widen-window
terminal state. Also (per user taste) **removed** month-chip counts and skipped the
"add max-price counts" rec.
**Deferred (user: "note for later"):** the rest of the Tier-1 a11y bundle —
site-wide low-opacity grey contrast sweep, `aria-live`/`role=alert` on the result
count & errors, tap-target sizing for filter pills/segments, light-mode hours-bar
contrast, bridge-chip contrast. Kept here as the next a11y batch.
**Open questions:** make CO₂ comparative (low/avg/high) vs leave; value-signal
approach (#1 free percentile now vs #3 price-history API later).

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

---

## Expanded-card (PDP) audit — follow-up pass (2026-07-24)
Dedicated UX-agent pass on the `{open && …}` detail panel (`DealCard.tsx:467-602`)
— the decision surface right before the Kiwi/Booking hand-off. Data status noted
per item. None built yet — parked for a pick.

**P1 — high impact, data mostly in hand**
- ⭐ **Show the destination photo IN the expanded panel.** The image is already
  fetched but only rendered on the *collapsed* card (desktop hover "peel",
  `DealCard.tsx:277-308`); it vanishes the moment you open the card. For a trip the
  place *is* the product (Baymard: 56% of users go straight for imagery on a PDP).
  Un-gate it. *S · data: HAVE (Unsplash url + credit wired).* Biggest, cheapest win.
- **Per-person vs total** in the panel when `adults > 1` ("€X total · €Y pp") —
  resolves the clash with the "per person" CO₂ line beside the party-total price
  (Baymard price-per-unit: 81% don't show it). *S · HAVE.*
- **Short-layover warning** — flag connections under ~90 min from `layover.minutes`.
  *S · HAVE.* A true "self-transfer, re-check bags" flag needs a Kiwi field
  (`virtual_interlining`/`hidden_city`) not parsed in `normalizeDeals` — *M · NEW field.*
- **All-in cost** — combine flight + checked bag into one "all-in from €X"; label
  hotel separate. *S for flight+bag (HAVE); hotel price estimate = NEW SOURCE
  (Booking/RateHawk).* (Baymard: 67% don't show total order cost.)

**P2 — meaningful**
- **"What to know" chip strip** atop the panel: `🌙 2 nights · Direct · Cabin only ·
  1 day off · Airport 6 km` — skimmable digest of facts currently scattered
  (Baymard spec-sheet scannability). *S–M · HAVE. Also pull `airportKmFromCity` into
  the panel, currently collapsed-only (`:344-357`).*
- **Save / shortlist** (localStorage, no account — Baymard: 21% rely on Save;
  requiring login is "a severe mistake"). *M · client-only.*
- **Trust microcopy at Book** — "Final price & baggage confirmed on Kiwi." *S copy;
  accurate free-cancellation/flex signal = NEW field from Kiwi.*

**P3 — polish**
- **Disclosure a11y** — panel (`:467`) has no `id`/`role="region"`; the two toggle
  buttons (`:310-315`, `:378-393`) lack `aria-controls`. Wire them. *S.*
- **Weather → packing cue** — reuse the classified temp/condition (`weather.ts:54-66`)
  for a one-word "pack a layer". *S · HAVE.*

**Needs new data (parked):** hotel price estimate, self-transfer flag, "vs typical
price" (price-history API — see ideas-and-research.md).

**Recommended first batch (cheap, data-in-hand):** image-in-expanded + per-person +
short-layover warning + "what to know" chips + Book microcopy + disclosure a11y.

Sources: [Baymard Product Page UX 2026](https://baymard.com/blog/current-state-ecommerce-product-page-ux) ·
[Product Page Usability benchmark](https://baymard.com/blog/product-page-usability-report-and-benchmark) ·
[Spec-sheet scannability](https://baymard.com/blog/spec-sheet-scannability) ·
[Shipping/total cost on PDP](https://baymard.com/blog/show-shipping-costs-on-product-pages).
