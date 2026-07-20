# Weekend Escape — Ideas, Research & How-To Notes

Working notes captured during development. Not code — a place to think through
what's next and record research so we don't re-derive it.

---

## Roadmap — what else we could build

Roughly ordered by leverage. Items marked ✅ shipped this session.

### Highest leverage
1. **Make the new data actionable** — weather, airport-distance, and airline are
   currently *display only*. Turn them into filters/sorts: "warmest & driest
   weekends", "airport ≤ 30 km", hide a carrier. Weather-sort fits the brand.
2. **All-in price honesty** — combine fare + checked bag + airport-transfer
   distance into a single "real cost" signal. A €30 fare that's a €50 taxi from
   town isn't cheap (the Charleroi problem).
3. **Price context** — is this deal actually good? "Cheapest in 3 months" badge
   or a mini price-history sparkline. Extend `CheapestWeekend`.
4. **Events on your dates** — concerts/festivals during the trip (see below).

### Polish
- Skeleton cards while loading (cohesive with the smooth first-load).
- ✅ OpenGraph preview image for shared links (site-wide card).
- **Per-airport dynamic OG card** (e.g. "Cheap weekends from Barcelona 🇪🇸" in the
  image). Needs `generateMetadata({ searchParams })`, which can't live in a client
  component — so `page.tsx` needs a small server/client split (a server page that
  reads `searchParams` and renders the existing client component). Makes shared
  `?from=BCN` links much more clickable. Deferred.
- Save / shortlist & compare deals (`home-storage.ts` already exists).

### Trust / data quality
- Home-country "free day" accuracy — real location vs airport; statutory-only.
- Show prices in the user's currency (free FX API: Frankfurter / exchangerate.host).
- Deal freshness — "prices checked 2h ago".

### Growth
- Price-drop alerts (email/push) for a saved route.
- Multiple home airports in one search.
- SEO landing pages per route ("Cheap weekends to Porto from Barcelona").

### Technical health
- E2E smoke test (Playwright) — the preview-page trick is ad-hoc.
- Per-IP rate limiting (see below) — we have caching + coalescing, not abuse
  protection.
- Slim `cities.json` if the serverless bundle size ever bites (see below).

---

## Events integration (concerts / festivals)

Goal: "Oktoberfest is on during your trip" — pairs with the holiday feature and
makes a weekend *worth* booking.

### Ticketmaster Discovery API — **free**, but partial for us
- Free with registration: ~5,000 calls/day, 5 req/sec. Query by city + date range.
- **European coverage:** AT, BE, DE, DK, ES, FI, FR, GB, IE, NL, NO, PL, SE.
- **Gap:** Italy, Portugal, Greece, Croatia, Czechia, Hungary, Romania and most
  of Southern/Eastern Europe — i.e. many prime weekend spots (Rome, Lisbon,
  Porto, Athens, Split, Prague, Budapest) return nothing.
- **Verdict:** good as a *bonus* "what's on" section for northern/western cities;
  don't build a core feature on it given the Southern-Europe gaps.

### PredictHQ — **paid** (free trial only)
- Global coverage, attendance forecasts, festivals, "is this weekend busy".
- Commercial pricing; worth it only if events become central.

### Other options
- Bandsintown (music only, partner `app_id`), SeatGeek (free tier, US-heavy).
- Songkick / Eventbrite discovery APIs effectively closed to new apps.
- For a handful of famous recurring festivals (Oktoberfest, etc.) — just hardcode
  them; they're stable, like the airline-code overrides.

### How to validate before building
1. Get a free Ticketmaster key → `.env.local` as `TICKETMASTER_API_KEY=…`.
2. Script queries the API across the real top ~15 destinations over a sample
   weekend window.
3. Report hit-rate per city ("11/15 returned events" → worth it; "4/15" → skip).

---

## OpenGraph (link previews) — how it works

OG = `<meta property="og:…">` tags in the page `<head>`, read by other apps'
crawlers when a link is pasted (Slack/WhatsApp/iMessage/X/LinkedIn/Facebook).

Flow:
1. Someone pastes the link.
2. The platform's crawler fetches the URL and reads the tags from the
   **server-rendered HTML** (crawlers barely run JS — the tags must be in the
   initial HTML, which Next's `metadata` guarantees).
3. It renders a preview card: big image + title + description.

Core tags:
```html
<meta property="og:title" content="…" />
<meta property="og:description" content="…" />
<meta property="og:image" content="https://…/opengraph-image" />  <!-- 1200×630 -->
<meta property="og:url" content="https://…" />
<meta name="twitter:card" content="summary_large_image" />
```

Gotchas:
- Image must be an **absolute, public URL**, ideally **1200×630**.
- Platforms **cache** previews hard — refresh via their debuggers (Facebook
  Sharing Debugger, LinkedIn Post Inspector).

Next.js implementation:
- **Static card:** `opengraph-image.png` in `src/app/` + `openGraph` fields on the
  `metadata` export.
- **Dynamic card (what we did):** `opengraph-image.tsx` renders JSX → PNG via
  `next/og` `ImageResponse` at request time. Designed in code, matches the dark
  palette. No binary asset to manage.
- **Per-URL** OG (e.g. per airport) needs `generateMetadata({ searchParams })`,
  which can't live in a client component — our `page.tsx` is `"use client"`, so
  per-airport cards would need a small server/client split. Site-wide card is the
  80/20 and is what we shipped.

---

## Per-IP rate limiting — options

- **Quick, no deps (in-memory):** token bucket keyed by IP
  (`request.headers.get("x-forwarded-for")?.split(",")[0]`), ideally in
  `middleware.ts` so it runs before the route.
  - Caveat: serverless in-memory state is **per-instance and resets on cold
    start** — stops casual hammering, not a distributed attack.
- **Correct at scale:** `@upstash/ratelimit` + Upstash Redis (serverless-native,
  free tier ~10k commands/day), shared across instances. Needs two env vars.

Verdict: with the caching + coalescing already in place, the in-memory version is
plenty unless real abuse shows up.

---

## Slimming `cities.json` — options

Reality check first: it's **server-only** (never shipped to the browser), so it
has **zero client/page performance impact**. The only cost is serverless bundle
size + a one-time few-ms JSON parse on cold start.

If it ever needs slimming with **no coverage loss**:
- **Cross-reference `airports.json`:** a marketed destination is always an airport
  city — drop cities with no airport within ~X km. Removes the long tail we never
  look up; keeps 100% of reachable destinations.
- **Compact encoding:** size is dominated by `"CC:cityname"` string keys.
  Reformat to nested `{ CC: { name: [lat,lon] } }` or a packed array.
- Out-of-function: Vercel KV / Upstash lookup, or CDN-served JSON fetched+cached.
  More moving parts — only if bundle size actually bites the deploy.

---

## Data-source caveats (for future maintenance)

- **Airline names** (`src/lib/airlines.json`) come from a **Wikidata snapshot**
  taken during development — it won't self-update. If a carrier rebrands, re-run
  the SPARQL query. Curated overrides cover the low-cost groups (Wizz/Ryanair)
  and a few flag carriers (Tarom, Bulgaria Air, Olympic Air, Sky Express).
- **Holidays** (Nager.Date) list **statutory** national holidays — reliable for
  "is X a real public holiday", but they **do not** include ad-hoc government
  bridge days (e.g. Romanian "punți"). Only market statutory days with confidence.
- **Airport/city coords** (`airports.json` / `cities.json`) are OpenFlights /
  GeoNames snapshots — fine for distance math, not guaranteed current.
