# Results toolbar + Sort + Refine — UX research synthesis

Synthesis of three parallel research passes (filtering/refinement UX; results
toolbar/sort/edit-summary; competitive teardown of Google Flights / Skyscanner /
Kayak / Airbnb / Booking / Hopper / Going). Sources: NN/g, Baymard, GOV.UK, Algolia,
plus product teardowns. Goal: make the summary-bar + count + Sort + Refine area
prettier and best-in-class, on our minimalist black/white aesthetic.

## What we already do right (validated — don't touch)
- **Sort = 2-option segmented control, defaulted to Cheapest.** Research strongly
  endorses this: segmented is "visibility-first" (current order always on screen,
  solves Baymard's "can't tell how it's sorted" dropdown problem), 2 options is in the
  ideal 2–5 range, and defaulting to Cheapest matches the value prop. Do NOT switch to
  a dropdown or add sorts (porting Baymard's "4 essential sorts" is an ecommerce
  category error).
- **Count "N weekend escapes" as the anchor**, updating live as filters apply.
- **Refine = one distinct button with an active-count badge**, visually separate from
  Sort (avoids Google Flights' #1 confusion: sort vs filter look-alikes).
- **Two-tier model**: trip search (re-fetch) vs Refine (instant local filter), unified
  visual language + "no new search" hint.
- **Instant client-side filtering** (see reconciliation below).

## Reconciled conflict: instant-apply vs batch + Apply
- NN/g: instant filtering is correct when results appear in **under ~1s**; batch+Apply
  exists to hide **slow server reloads** and **jarring sheet reflow**.
- Our filters are **client-side (<1s)** and the Refine panel is **inline above the
  list** (not a modal sheet that could close on reflow). So the batch rationale doesn't
  apply → **keep instant-apply.** Just keep the live count moving as feedback.

## Prioritized redesign

### Tier 1 — highest impact, on-brand (recommended build)
1. **Active-filter chips when Refine is closed.** Biggest gap: today a collapsed Refine
   only shows a "(N)" badge. Show the actual selections as removable chips below the
   count/sort — `Jul ✕` `Europe ✕` `≤ €150 ✕` `Short-stay hidden ✕` — only rendered
   when ≥1 filter is active (zero clutter at rest). All three reports rank this #1
   (Baymard: ~20% of sites fail to keep applied filters visible → disorientation).
2. **"Clear all" next to the chip row** (and inside the panel) once anything is active.
3. **Per-option counts in the panel.** `Jul · 58`, `Europe · 40`, computed from
   `rawDeals`. Baymard: per-option counts are "one of the single highest-impact
   improvements to a filter UI" — users avoid dead-end (zero-result) selections.
4. **Price: slider → tappable buckets** (`≤ €100 · ≤ €150 · ≤ €200 · Any`) or slider +
   live editable value. Drag-only sliders are the classic touch-precision problem
   (NN/g); a max-cap on cheap fares fits coarse buckets well.

### Tier 2 — polish
5. **Clearer multi-select cue** on Month/Region pills (checkmark on selected) so users
   learn combinations are allowed.
6. **Empty state keeps the chips + a one-tap "Clear filters"** instead of a dead screen.
7. **Sort segments preview the tradeoff** (Skyscanner): tiny sublabel — cheapest price
   under "Cheapest", soonest date under "Soonest". Optional; watch width.
8. Micro-polish: hairline dividers (not boxes), consistent vertical rhythm, ~150–200ms
   condense/expand, solid black/white active-fill flip (already on-brand).

### Tier 3 — bigger bets
9. **Airbnb-style editable facets** in the summary bar: make `CLJ` / `Fri–Mon` /
   `next 3 months` independently tappable to change one thing without reopening the
   whole trip form. (The pill *is* the edit affordance; drop a separate "Edit" only if
   every facet is individually tappable.)
10. **Sticky, partially-persistent toolbar**: hide on scroll-down, reappear on
    scroll-up, keeping a slim `query pill + Sort + Refine` bar reachable deep in the
    list. NN/g: opaque, ≥16pt, minimal height — "earn it," don't pin a tall header.

## Avoid (clutter traps from the teardown)
- Sort and Refine as twin button rows (Google Flights confusion).
- A horizontal row of many filter dropdown-pills (desktop-flavored density).
- Per-option counts on everything in the resting UI (Booking noise) — counts belong
  inside the panel, one count line outside.
- Full multi-hue price heatmap (Hopper) — one restrained "good value" accent max.
- Translucent/tall permanent sticky headers (NN/g: kills contrast, wastes viewport).
- A separate "Edit" button if facets are individually tappable (Airbnb redundancy).

## Primary sources
NN/g: applying-filters · mobile-faceted-search · gui-slider-controls · progressive-
disclosure · scoped-search · touch-target-size · sticky-headers. Baymard: ecommerce
filter UI · applied-filters overview · essential-sort-types. GOV.UK/MOJ filter pattern.
Algolia search-filter UX. Airbnb collapse-to-pill teardown. Skyscanner/Kayak/Hopper/
Going product writeups.
