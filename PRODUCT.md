# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

B2C consumers looking for short getaways. **Global from day one** (user-confirmed 2026-08-31): any home airport is a first-class citizen; avoid Europe-only assumptions in features and copy. Budget-minded people with a nearby airport stealing 2–4 day escapes around a work week — they know when they can leave (Fri–Sun, Fri–Mon, Thu–Mon), not where they want to go.

Note: parts of the current implementation lean European (EUR for European origins in `src/lib/currency.ts`, Nager.Date national holidays for bridge days, puentes framing). These are evolution points, not audience definitions.

## Product Purpose

Finds the cheapest weekend round-trip flights from the user's home airport across a future timeline (1–6 months). Answers "where can I go this weekend, from where I live" — the origin is the anchor, never the destination. Success (user-confirmed 2026-08-31): **real traffic + affiliate revenue** — a public consumer product where organic search, handoff trust, and Kiwi/Booking.com/GetYourGuide affiliate income are the model, not a side effect.

## Positioning

- **The weekend is the unit of search.** Each preset is a canonical shape (the label's exact arrive/leave days); the search casts a wider net and splits results into the exact shape first, then close matches. Competitors search dates; this searches weekends.
- **Bridge-day / long-weekend detection** ("puentes"): the one feature no competitor has (currently an off-by-default toggle; README tracks surfacing it on the board).
- **The name is the pitch**: weekend.flights is product, promise, and address at once.
- **Honesty as a mechanism**: no fabricated signals. "Great value" must be computable from data on hand (distance-normalized vs. nearby deals), never "lower than usual" — there is no price history.

## Operating Context

- Data: one Kiwi Tequila `/v2/search` call returns the cheapest weekend round-trip per destination, shown cheapest-first. Kiwi returns `distance` but not coordinates; airport coordinates come from bundled datasets in `src/lib/`.
- **No on-site checkout.** The product deep-links out: flights to Kiwi.com, stays to Booking.com, activities to GetYourGuide. So handoff trust, price honesty ("checked X ago · fares can change at booking"), and search recovery outrank typical e-commerce cart guidance.
- Home airport persists in `localStorage`; currency currently derives from origin (EUR for European origins, USD otherwise — `WEEKEND_CURRENCY` override deliberately discouraged).
- Holidays via Nager.Date (home country = national-only, for honest PTO math).
- Dev: `npm run dev` (Next.js 16 / Turbopack); tests `npx vitest run`; the user often has their own dev server already running — check before starting one.

## Capabilities and Constraints

- Board features: weekend-shape presets, timeline window, origin autocomplete + geolocation, month/price/continent facets, sort controls, calendar view, map view (MapLibre), per-deal card with itinerary legs, stay/activities links, CO₂, weather, daylight, baggage.
- **House rule — filter chips never print a result count** (`Sep`, not `Sep 1`): every other number on the board is a date or price, so a count is ambiguous. Counts are still computed to disable dead options; a facet's counts honour the OTHER active facets only. Enforced by test in `src/app/__tests__/page.test.tsx`.
- SEO constraint: `page.tsx` is `"use client"`; crawlers see ~503 chars. Planned fix is server-rendered origin pages `/from/[iata]` (docs/seo-origin-pages.md) — bounded at one page per origin; **never** build the `/from/x/to/y` pair matrix.
- Secrets: repo is public; `.env.local` gitignored; TEQUILA_API_KEY must never be committed.
- Mobile guardrail: no horizontal scroll at 320/375px widths up to 125% font scale.
- Undecided (recorded, not invented): map rendering approach was deferred by the user earlier; "Great value" badge display (explicit % vs. plain label) is an open question.

## Brand Commitments

- Name: **weekend.flights**, lowercase, dot unspaced — must match everywhere it is quoted (tab title, search result, share card, header).
- Type: Space Grotesk (UI/data) + Instrument Serif italic (display warmth). Fonts also vendored in `assets/`.
- Color: warm orange accent (orange-600 light / orange-400 dark), soft off-black `#14161c` dark ground, viewport-anchored warm glow behind the header.
- Voice: plain, honest, specific ("Direct = nonstop only"); explains itself rather than hedging.

## Evidence on Hand

- Real live data via Tequila API; no testimonials, no price history, no user counts — future work must not fabricate any of these.
- docs/baymard-audit.md — consolidated five-agent Baymard/WCAG audit with shipped/deferred status.
- docs/ideas-and-research.md — house rules, ranked roadmap, research notes.
- docs/ideas/NEXT.md — session handoff; docs/seo-origin-pages.md — origin-pages spec.
- OG card ships from `src/app/opengraph-image.tsx` (preview in docs/og-card-preview.png).

## Product Principles

1. **Origin-anchored**: every surface answers "from where I live"; the destination is the result, not the query.
2. **Honest numbers or no numbers**: price freshness stamps, real all-in costs, computable badges only; a signal we can't back with data on hand doesn't ship.
3. **The handoff is the checkout**: trust at the moment of leaving (clear "Book on Kiwi" labeling, external-link affordances) is the conversion surface.
4. **Global-ready**: no feature may assume a European origin; currency, holidays, and copy must degrade gracefully worldwide.
5. **Signal over noise**: compute everything, print only what changes a decision (the chip-count rule is the template).

## Accessibility & Inclusion

**WCAG 2.1 AA is binding** (user-confirmed 2026-08-31): all new and touched UI must meet it — 4.5:1 text contrast, visible focus, screen-reader announcements for result count/status/errors, 44px touch targets. The deferred Tier-1 a11y batch in docs/baymard-audit.md (light-mode muted-text sweep, `aria-live`/`role=alert`, pill tap targets, hours-bar and bridge-chip contrast) is real debt to pay, not aspiration.
