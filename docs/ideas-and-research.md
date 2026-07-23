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

### Weekend-delight ideas (brainstormed 2026-07)
Ranked by fit × delight for a weekend-getaway tool:
1. **Bridge-day / long-weekend detector ("puentes")** — ✅ *shipped as an opt-in
   mode.* A "Hunt for bridge days" toggle in the search panel (default OFF → plain
   search, no home-holiday fetch, no bridge queries; `bridges=1` in the shareable
   URL when on). When ON the API returns **only** long-weekend escapes and marks
   them up. Holiday source: Nager.Date (home = national only for honest PTO;
   destinations keep national+regional so "holiday there" stays accurate).
   Holiday-anchored windows the fixed weekend windows miss (Kiwi DOW 0=Sun…6=Sat):
   - **Tue holiday** → depart Fri/Sat, return Tue (take Mon off) — 1 day off.
   - **Wed holiday** → depart Wed, return Sun (take Thu+Fri off) — 2 days off.
   - **Thu holiday** → depart Wed/Thu, return Sun (take Fri off) — 1 day off.
   - Mon/Fri holidays fall out of the normal windows (kept via the main search,
     filtered to `isBridge`), so no extra query for them.
   Extra searches run in parallel with the main board search (latency = max, not
   sum), each cached; board search only (single-city skips). Card badge states the
   real cost ("no day off needed" / "1 day off" / "2 days off required"); the
   DayBlocks strip tints the holiday day and tags the workdays you'd book off.
   **Follow-up:** map home airport → ISO region to re-add a resident's own regional
   holidays (e.g. Catalonia's Diada for BCN) — currently national-only for home.
2. **Total weekend cost, not just airfare** — rough flight + 2-nights hotel
   estimate so the card shows the real all-in (~€120), not just the teaser fare.
3. **"Warm this weekend" near-term mode** — toggle for this weekend / next 2–3
   weeks; unlocks real weather forecasts (and the parked AQI idea).
4. **Vibe tags** — Beach · City · Nightlife · Hikes · Food, from a curated
   per-city map (no live API), so a glance tells you the kind of weekend.
5. **Surprise me** — one button → one full-bleed random great deal. Spontaneity.
6. **Watchlist + price-drop alerts** — star a route, get pinged on a drop. The
   retention feature (turns a one-visit tool into a recurring one).

### Parked — revisit if the shape changes
- **Air quality index (AQI).** Considered 2026-07; skipped for now. Open-Meteo
  has a free Air Quality API (same provider we use for weather), but AQI can't
  be forecast beyond ~5–7 days, and our deals are booked 1–2 months out — so
  for the typical card there's no meaningful value to show, and AQI seasonal
  climatology (unlike temperature) isn't an intuitive, trusted signal. It also
  rarely changes the decision for European weekend breaks, and the card is
  already dense. **Revisit if we add a near-term "this weekend / next few weeks"
  mode** — there real AQI forecasts exist and would make a good expanded-detail
  line (not a headline chip).

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

## Filter strictness & the weekend presets (research, 2026-07-23)

Friend feedback: *"If I pick Fri–Mon, why do I get other shapes? Should results
always match what I selected?"* Researched via two agents (UX best-practice +
travel-search incumbents). Full findings below; **no code changed yet — pending a
decision on default posture.**

### The confirmed problem
Each preset labels ONE shape but the search returns a **bag of shapes**, because
the preset secretly bundles two things — **departure day** *and* **trip length
(nights)** — and varies both:

| Label shown | Departs | Returns | Nights | Can actually return |
|---|---|---|---|---|
| Fri–Sun (`strict`) | Fri | Sun | 1–2 | Fri→Sat (1n), Fri→Sun |
| Fri–Mon (`frimon`) | Fri/Sat | Sun/Mon | 1–3 | Fri→Sat, Fri→Sun, Fri→Mon, Sat→Sun, Sat→Mon |
| Thu–Mon (`loose`) | Thu/Fri/Sat | Sun/Mon | 1–4 | anything Thu→Sun … 1-night Sat→Sun |

So a "Fri–Mon" pick can surface a 1-night Fri→Sat. See `src/lib/weekend.ts`
(`fly_days`/`ret_fly_days`/`nights_in_dst_from/to`).

### Verdict
**The bug is label↔behaviour mismatch, not strict-vs-flexible.** A filter is read
as a promise ("remove non-matches"); violating it erodes trust. But pure-strict
risks dead-end "0 results" in a thin niche (a top abandonment driver). The
evidence-backed resolution: **honest default → explicit, named flexibility opt-in
→ "no exact matches, here are the closest" fallback.**

### UX principles (Baymard, NN/g)
- Applied filters are a promise; unlabelled non-matches cause disorientation &
  distrust. Label-vs-behaviour mismatch reads as a mild dark pattern.
- Users conflate filtering (removes non-matches) with sorting (reorders) — so an
  off-spec result under a filter directly contradicts the operation's meaning.
- Zero-results is a real, high-abandonment risk → mitigate with *labelled*
  relaxation, never by silently padding with off-spec items.
- Sources: Baymard [applied filters](https://baymard.com/blog/how-to-design-applied-filters),
  [no-results](https://baymard.com/blog/no-results-page),
  [5 filter types](https://baymard.com/blog/5-essential-filters);
  NN/g [faceted search](https://www.nngroup.com/reports/ecommerce-ux-search-including-faceted-search/),
  [match system↔real world](https://www.nngroup.com/articles/match-system-real-world/),
  [recognition vs recall](https://www.nngroup.com/articles/recognition-and-recall/).

### What incumbents do
- Flexibility is **always an explicit, named opt-in on an exact default**:
  momondo literally labels it **"exact dates" vs "±3 days"**; Google **"Date grid /
  Flexible dates"** with a Duration-in-nights range; Kayak **"±3 days"** price
  calendar; Skyscanner **"Whole month / Cheapest month"**; Hopper **"Flex Watch"**;
  Airbnb length chips **"Weekend / Week / Month."**
- Flexibility is tied to an explicit **length**, so a "weekend" can't leak a
  1-nighter unless asked (Google Duration, Airbnb "Weekend", Kiwi `nights_in_dst`).
- Kiwi/Tequila (our API) gives strict-able knobs: `fly_days` / `ret_fly_days`
  (weekday lists, 0=Sun…6=Sat), `*_fly_days_type` (departure/arrival),
  `nights_in_dst_from/to` (min/max stay). Strict Fri→Sun 2-night =
  `fly_days=5` + `ret_fly_days=0` + `nights_in_dst 2/2`. We broaden only because we
  pass multiple day values + a wide night band.
- Sources: [Google](https://support.google.com/faqs/answer/2736592?hl=en),
  [Skyscanner](https://www.skyscanner.com/tips-and-inspiration/where-should-i-go-us/skyscanner-tips-and-tools-how-to-search-flight-prices-across-whole-month),
  [Kayak](https://www.kayak.com/news/flexible-dates/),
  [momondo](https://www.momondo.com/about/why-travelers-choose-momondo),
  [Hopper Flex Watch](https://techcrunch.com/2017/09/14/hopper-debuts-flex-watch-a-personalized-flight-deal-finder-for-flexible-travel-dates),
  [Airbnb](https://www.airbnb.com/help/article/252),
  [Kiwi API params (Travelpayouts mirror)](https://support.travelpayouts.com/hc/en-us/articles/360019237899-Kiwi-com-affiliate-program-API).

### Who's annoyed (the Fri→Saturday question)
Opposite failures: the **planner** ("I have Monday off") hates the loose junk; the
**bargain-hunter** ("cheapest, I'm flexible") hates strict hiding a cheaper Fri→Sun.
Don't pick a side — (a) never leak *length* (bound nights per shape), (b) let the
user choose posture explicitly.

### Recommendation (pending decision)
Weekend Escape is a *discovery* board (cards already show exact dates + timeline),
so it leans flexible. Proposed:
1. **Must-fix (the real bug):** bound `nights_in_dst` per shape so a "weekend"
   can't return a 1-nighter by accident.
2. **Make presets honest** — pick one:
   - **A — length-family labels** (Airbnb-style): rename e.g. "Long weekend ·
     2–3 nights", keep useful breadth. *(Leaning here.)*
   - **B — strict shape + "Flexible dates" toggle** (momondo/Kayak-style): presets
     mean exactly their label; a toggle widens days/nights for deal-hunters.
3. Optional **"Exact dates only"** toggle for planners regardless of A/B.

**Open decision:** default posture — deal-hunter (flexible-but-honest default) vs
planner (strict default + opt-in flex). Other filters (Direct, max price, months)
are already honest; the weekend preset is the lone offender.

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

## Flight data sources — fallbacks & complements

The app's magic = **aggregating low-cost carriers + flexible "cheapest weekend"
search**. That combo is rare, which is what makes replacing Tequila hard.

**Kiwi Tequila (current primary)** — uniquely good at LCC + flexible-date
search, but access is precarious: docs confirm parameters are being deprecated
(`flight_type` explicitly), commercial/production access needs a **partnership**,
and via Travelpayouts the Kiwi affiliate API requires **50,000+ MAU**. Keep the
key, but don't treat it as a guaranteed long-term foundation.

Options, ranked for this app:
1. **Travelpayouts (Aviasales/Jetradar) Data API — best complement + fallback.**
   Free with affiliate signup, **includes LCCs**, deal-shaped endpoints (cheapest
   tickets, price calendar, "cheap flights from city", month matrix). Bonus:
   built-in **monetization** (booking commission). Caveat: prices are *cached*
   from prior searches, not always live/bookable — fine for discovery.
2. **Amadeus Self-Service — live prices, wrong for budget.** Has the perfect-fit
   Flight Cheapest Date Search + Flight Inspiration Search, generous free tier —
   **but no low-cost carriers on Self-Service** (nor AA/Delta/BA). Dealbreaker as
   a primary; useful only as a complement for legacy-carrier routes / price checks.
3. **Duffel** — modern, booking-grade, some LCCs via NDC. Right if we add in-app
   booking; per-booking pricing, not free at scale.
4. **Skyscanner** — partner-only, no open self-service. Skip.
5. **RapidAPI scraper wrappers** (unofficial Skyscanner/Kiwi/Google) — cheap free
   tiers, ToS/reliability risk. Throwaway fallback only. (Google Flights/QPX has
   no public API.)

Two concrete moves:
- **Abstract flight-search behind an adapter.** We already normalize Tequila into
  the `Deal` shape (`normalizeDeals`) — formalize as an interface so Tequila /
  Travelpayouts / Amadeus are swappable with automatic fallback.
- **De-Tequila the airport lookup (free resilience win).** Autocomplete +
  nearest-airport currently hit Tequila `/locations`, but we already bundle
  `airports.json` (6k airports + coords) — serve both locally, removing one
  Tequila dependency entirely.

Recommendation: keep Tequila primary, add **Travelpayouts** as the LCC fallback +
monetization layer, treat **Amadeus** as an optional live-price complement, and
move airport lookup to the bundled data.

Sources: [Tequila](https://tequila.kiwi.com/) ·
[Kiwi affiliate 50k MAU](https://support.travelpayouts.com/hc/en-us/articles/360019237899-Kiwi-com-affiliate-program-API) ·
[Amadeus Cheapest Date Search](https://developers.amadeus.com/self-service/category/flights/api-doc/flight-cheapest-date-search) ·
[Amadeus pricing](https://developers.amadeus.com/pricing)

---

## Best practices for flight-deal / getaway sites (researched)

Mapped to Weekend Escape. ✅ have it · ⚠️ gap · 💡 opportunity.

1. **All-in price transparency** (⚠️, high) — FTC Unfair/Deceptive Fees Rule (May
   2025) + DOT Full Fare Rule expect the *total* incl. mandatory fees up front;
   hidden fees are the #1 abandonment trigger. We show fare + bag price + airport
   distance but not a combined "real cost". Build the all-in price (fare + bag +
   rough transfer). Conversion win *and* compliance-aligned.
2. **"Is this a good deal?" signal** (💡, high) — the whole reason to use a
   deal-finder vs Google Flights. A "cheapest in 3 months" / "great price" badge
   or price sparkline. `CheapestWeekend` is a start.
3. **Skeleton loaders while searching** (💡, low) — kill the dead pause; big
   perceived-quality lift for little effort.
4. **Freshness + currency** (💡, low/med) — "prices checked 2h ago" (Tequila
   links go stale) and prices in the user's currency. Trust signals.
5. **Helpful defaults + labels** (✅ mostly) — we default Fri–Mon / Direct /
   Cheapest; add "best value"/"popular" style badges to speed decisions.
6. **Immediate feedback / micro-interactions** (✅) — hover states, fade-in,
   smooth first-load done; skeletons are the missing piece (see 3).
7. **Search prominence + flexibility** (✅) — auto-search + "anywhere + which
   weekend" is the core advantage; keep it front and centre.
8. **Mobile carries disproportionate revenue risk** (✅) — audited; padding +
   touch targets tuned.
9. **Visual/functional balance** (✅) — scannable list stays primary; imagery and
   the serif headline are tasteful accents, not clutter.

**Priority order:** the wins are trust/decision signals, not more chrome —
(1) all-in "real price", (2) "is this a good deal" badge/sparkline,
(3) skeletons, (4) freshness + currency.

Sources: Baymard (flight-booking UX 2026), RALabs (booking UX), Smashing
(flight-search UX), FTC (unfair/deceptive fees rule), Mediaboom (travel design).

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
