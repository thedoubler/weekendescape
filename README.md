# weekend.flights

Finds the cheapest weekend round-trip flights from your home airport across a
future timeline. Built with Next.js + the Kiwi Tequila API.

## Setup

1. `npm install`
2. Create `.env.local`:
   ```
   TEQUILA_API_KEY=your_key          # required — https://partners.kiwi.com/
   ```
3. `npm run dev` and open http://localhost:3000

### Optional environment

| Variable | Effect if unset |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical URLs, OG images, `robots.txt` and the sitemap fall back to the Vercel production domain, then `localhost`. Set it on the real deploy. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | `/about` shows a developer note where the address should be. |
| `NEXT_PUBLIC_COFFEE_URL` | The "buy me a coffee" paragraph on `/about` does not render at all. |
| `NEXT_PUBLIC_GYG_PARTNER_ID` | Falls back to the built-in GetYourGuide partner ID. Set to disable or re-point the activities panel. |
| `NEXT_PUBLIC_BOOKING_AID` | Booking.com links go out without an affiliate ID. |
| `UNSPLASH_ACCESS_KEY` / `DESTINATION_IMAGES` | Destination images are skipped. |
| `WEEKEND_CURRENCY` | **Leave it unset.** Currency is chosen from the origin — EUR for a European home airport, USD otherwise (`src/lib/currency.ts`). Setting this pins every board to one currency and overrides that. |

## How it works

- Set your home airport (type an IATA code or use geolocation).
- Pick a weekend style (**Fri–Sun** by default; also Fri–Mon / Thu–Mon) and
  timeline (1–6 months). Each preset is a *canonical shape* (the label's exact
  arrive/leave days); the search casts a wider net for cheaper fares, and results
  are split into that exact shape first, then a "close matches" section.
- One Tequila `/v2/search` call returns the cheapest weekend round-trip per
  destination; results are shown cheapest-first.

## Testing

`npm test` runs the Vitest suite.

## What's next

Tracked work, roughly in the order it is worth doing. Detail and file:line
references live in the task list; the strategy behind the first two is in
`docs/`.

**Product**
- Surface bridge days on the board — a strip naming the long weekends ahead
  ("Independence Day · Wed 11 Nov · 2 days off → 5 · from 52 EUR"). The bridge
  search already exists in `src/lib/bridges.ts` but is a toggle that is off by
  default, so the one feature no competitor has is hidden. Mockup and reasoning:
  the three treatments compared before choosing B.
- Server-rendered origin pages (`/from/[iata]`) — see
  `docs/seo-origin-pages.md`. A crawler currently sees 503 characters of the
  board; `/about` is the only page it can read in full. Blocked on extracting
  the search out of the route handler.

**Correctness**
- Don't write a home airport to `localStorage` before the search succeeds.
- Verify the map renders in a production build (reported, not reproduced).

**Interface**
- A 72px reserved slot sits empty above "Book on Kiwi" on most deals.
- Map labels clip at narrow widths; two separator/wrap bugs.
- Design-system consolidation, the part still outstanding: the type scale runs
  to seventeen sizes (eleven arbitrary px values plus six named), amber carries
  both "warning" and "good news", and ✕ / ▼ / ▲ / + / − are text characters
  where the rest of the app draws SVG. Detail in
  `docs/ideas-and-research.md`. Six outline-pill variants turned out NOT to be
  drift — they differ in intent (facet trigger, option chip, map pill, quiet
  action) and should stay separate.
- `/about` uses three values — `black/55`, `/60` and `/70` — for one prose
  role; the board's paragraphs no longer do.

Done since this list was written: light-mode muted text now uses a per-theme
`--muted` token (it failed WCAG AA in light only, because the alpha ramp was
tuned on the dark ground and reused); the error state has a retry button.

**Config** — see the optional environment table above; `WEEKEND_CURRENCY`
should be removed from any existing `.env.local`.
