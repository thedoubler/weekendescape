# Handoff — what's done & what's next

Snapshot for picking work back up in a fresh session. See also
[competitor-inspiration.md](competitor-inspiration.md) and
[refine-toolbar-ux.md](refine-toolbar-ux.md) for the detailed research/approach.

## Done (recent)
- **Refine UX** (from NN/g/Baymard research): active-filter chips + Clear all,
  per-option counts on pills, distribution-based price buckets (finer under the
  cheap band), checkmarks on selected pills, empty-state "Clear filters".
- **Short-stay filter** moved under Refine with an honest explanation.
- **Card**: itinerary-style flight legs, weekend-date anchor (dropped the
  constant origin), month dividers (sticky) on the Soonest sort.
- **Editable summary facets** + floating "↑ Sort & filter" pill on deep scroll.
- **Hotels**: per-card "🛏 Stay" Booking.com deep-link (city + exact weekend
  dates). Monetization pending (see below).
- **Search panel redesign**: hero full-width input, "Use my location" as a link,
  hairline divider, primary "Done" button.
- **Copywriting pass (panel)**: Weekend → **Weekend length**; Search the next →
  **Timeline**; Flights → **Stops** (+ "Direct = nonstop only").
- Both repos on GitHub (`thedoubler/weekendescape`, `thedoubler/onewayticket`).

## Next — pick up here

### Features (documented, ready to build)
1. **"Great value" deal badge** — distance-normalized, honest (NOT "lower than
   usual" — we have no history). Add `distance` (km) to `Deal` from Kiwi
   `item.distance` (confirmed present); score = price vs median of ~7 nearest
   deals by distance; badge if ≥~28% below & ≥8 results. Full plan in
   competitor-inspiration.md. Open Q: show explicit % or just "Great value".
2. **Map view** of destinations — list⇄map toggle. Blocker/decision: Kiwi does
   NOT return coordinates (verified — only `distance`). Need a bundled
   IATA→[lat,lon] dataset (e.g. OpenFlights, ~150KB, server-side enrich in
   `/api/weekends`). Rendering: self-contained SVG vs Leaflet+OSM tiles — user
   hasn't chosen yet (asked, deferred).

### Design polish (user is iterating on the expanded panel)
- User picked **copywriting** first (done for the panel). Still open, their pick
  pending: extend copy elsewhere (header subtitle, Refine texts, empty-state,
  "Done" → maybe "Show escapes"); **alignment & spacing** of the panel grid;
  **visual style / typography** (more premium look).
- Earlier proposed but NOT chosen: input icon + resolved city name
  ("CLJ · Cluj-Napoca"), label icons, 2-col compact layout.

### User action needed (not ours)
- **Hotel affiliate**: user joins Booking.com (or Expedia) partner program →
  set `NEXT_PUBLIC_BOOKING_AID` in `.env.local`. Link works unmonetized without
  it. If monetizing, add an affiliate-disclosure line in a footer.

## Guardrails / context
- Secrets: `.env.local` is gitignored (`.env*` + `!.env.example`). NEVER commit
  the Tequila key — repo is public; the environment hard-blocks it anyway.
- Tests: `npx vitest run` (107 passing). Build: `npm run build`.
- Mobile: verify no horizontal scroll at 320/375px × up to 125% font.
- Dev server: port 3005.
