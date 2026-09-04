# Weekend Escape — Ideas, Research & How-To Notes

Working notes captured during development. Not code — a place to think through
what's next and record research so we don't re-derive it.

---

## House rules

Decisions that apply everywhere, not just where they were first made.

### Filter chips never print a result count

A filter option shows its **value and nothing else** — `Sep`, not `Sep 1`;
`Europe`, not `Europe 13`.

**Why.** A number beside a value on this board is ambiguous by default: every
other number on the page is a date or a price, so `Sep 1` reads as the 1st of
September before it reads as "one flight". It is the same objection that
removed `Month 6` from the facet triggers — the count answers a question nobody
asked, in a notation already spoken for.

**What replaces it.** The count is still *computed*, and it still does the work
that matters: an option that would return nothing is **disabled** — dimmed, no
hover, no pointer — so the board never walks you into an empty result. The
signal survives; the noise does not.

**The counting rule itself.** A facet's counts are computed over the set
filtered by all the OTHER facets, never by itself. Excluding its own facet is
what lets an OR-multi-select stay widenable, and what makes the number mean
"how many more this would add". Both maps are seeded with every option at zero
first — a missing key is `undefined`, which is not `0`, and an option that
counts `undefined` stays wrongly enabled.

*Observed before this landed:* with `Sep` selected the Region row still read
`Europe 13 · Africa 1 · Asia 1` — the whole 15-deal board — while the list
showed 2. Tapping `Asia 1` produced `0 of 15 flights`.

Enforced by `counts a facet against the OTHER active facets, and disables dead
options` in `src/app/__tests__/page.test.tsx`.

---

## Roadmap — what else we could build

Roughly ordered by leverage. Items marked ✅ shipped this session.

- [ ] **"Experiences" / micro-personalization direction (owner's idea,
      2026-09-04 — research commissioned, decision pending).** The concept:
      users onboard with preferences (trip shape — long weekends vs strict
      Fri–Sun; interests — city breaks, live music, etc.) and the product
      proactively surfaces PAID-FOR experiences anchored to real events:
      "Jay-Z in London in two weeks, here's the cheap weekend around it."
      Bookings stay on third parties (no payment integration, probably);
      the open question is what users pay for and how. Needs: accounts +
      an email/notification channel (the site has neither today — that is
      the biggest architectural break with the current no-accounts ethos),
      an event-data source, and a personalization layer. Two research
      agents dispatched (business analysis; product/technical feasibility);
      their findings + the objective synthesis land in this file when done.

- [ ] **GBP for UK origin boards** (decided 2026-09-03, small). NOT a currency
      selector — that was weighed and rejected: ranking is currency-invariant,
      the automatic per-origin mapping already gives USD to US boards, and a
      user toggle would double the cache/quota per origin for a preference
      that changes no decision. The real gap: `currencyForOrigin` maps all of
      Europe to EUR, so the LONDON board prices in euros for an audience that
      thinks in pounds. Fix = map UK origins (LON, MAN, EDI…) to GBP in
      `src/lib/currency.ts`, then verify £ formatting flows through cards,
      the price filter buckets, and /from/lon's opener + FAQ. Same one search
      per origin, no cache growth. CHF/PLN/SEK are candidates for the same
      treatment later if those markets grow; RON deliberately not — Romanian
      deal culture quotes EUR.

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

### Design-system drift — what is left after the `--muted` pass (2026-08-31)

The secondary-text ramp is done: `--muted` is one per-theme token, 60 call
sites, documented in `globals.css` beside its own definition. What follows is
what was measured at the same time and deliberately NOT folded in, because each
needs a decision rather than a sweep. Counts are from `src/` on 2026-08-31.

**The type scale runs to seventeen sizes.** Eleven arbitrary px values
(`8, 10, 11, 12, 12.5, 13, 15, 17, 20, 38, 54`) plus six named (`xs` through
`2xl`). `text-[11px]` alone appears 27 times and `text-sm` 45, so there is a
real spine in there; the question is whether 12 / 12.5 / 13 are three sizes or
one. That is a typographic decision that moves layout on every surface, so it
belongs to a deliberate pass, not a find-and-replace. Renaming them 1:1 into
tokens would be motion without consolidation.

**Amber means two things.** Seven shades (`100, 200, 300, 400, 500, 700, 900`)
carry both "this costs an upstream call" (the receipt's dotted underlines,
which are load-bearing product grammar) and "good news" (the calendar's weekend
blocks, the bridge-day chips). Same hue, opposite valence. Fixing it means
picking a second hue for one of the two meanings — a brand decision.

**Glyphs are text where the rest of the app draws SVG.** `✕` ×6, `▼`/`▲`, `+`/`−`
stand in for a close button, a disclosure caret and an expander, while
`TakeoffIcon` and `MapPinIcon` in the same components are authored SVG at a
consistent stroke. The glyphs also carry the app's only sub-11px text (the
10px `▼`). An icon set would settle both.

**`/about` has its own prose ramp.** Eight paragraphs at `text-black/70`, two
at `/60` and `/55`, all `text-sm leading-relaxed` — one role, three values.
Not folded into `--muted`, because `/70` is reading text rather than supporting
text; the fix is to pick one value for that page, which needs someone to look
at the page.

**Outline pills are NOT drift.** Six variants exist and they differ in intent —
facet trigger, option chip, map price pill, quiet recovery action. The two that
genuinely match (`Clear filters`, `Try again`) are only two uses, below the
threshold worth abstracting. Left alone on purpose.

Two things stay non-token by design, and the reasons are in `globals.css`:
`text-black/70` (body prose and control labels that darken to full foreground
on hover) and `text-black/25–/35` (separator dots, the `→`, out-of-weekend
calendar days, disabled pills — decoration, which carries no words and is
allowed below text contrast).

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

### ✅ Shipped: exact-shape vs "close matches" split (2026-07-23)
Kept the broad search; the list now leads with trips that EXACTLY match the
preset's shape, then a labelled "Not exactly {label} · N close matches" divider,
then the rest (falls back to "No exact {label} — closest matches" when none match).
Classified by **arrival-at-destination + departure-from-destination** (matches the
card's shown dates; a Fri-night red-eye that lands Saturday is a close Sat–Mon, not
exact Fri–Mon). Off in bridge mode. See `WEEKEND_SHAPE` / `matchesWeekendShape`
(`src/lib/weekend.ts`) + `DealList` `splitShape`.

### ⏳ Follow-up (noted, revisit later): exact-shape results are sparse
Observed live (BCN / Fri–Mon / 2mo): only ~15 of 70 are *exactly* Fri–Mon. Root
cause is the **board search returns each city's *cheapest* option** (`one_for_city:1`),
which is usually a shorter/cheaper shape — so the split is honest but the "exact"
section stays thin. The split alone doesn't make exact-shape results *plentiful*.
Levers if we want more genuine exact matches:
- **Tighten the search params** for a stricter mode (single `fly_days`/`ret_fly_days`,
  fixed `nights_in_dst_from=to`) — fewer but on-shape.
- **Per-city "cheapest exact shape" fetch** (like the existing expand-time "cheaper
  weekend?" check) so each city can show its exact-shape option even when a shorter
  trip is cheaper.
Tie this to the still-open default-posture decision above.

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

> ⚠️ **Premise contested (2026-07-30).** Competitive research reports that
> Ryanair signed a distribution agreement with Skyscanner in September 2025,
> and that its approved-OTA roster now includes Kiwi, Expedia, Booking and TUI;
> Wizz has long been listed on Skyscanner. If that holds, "we aggregate the LCCs
> metasearch won't" stopped being true in late 2025, and Travelpayouts' value
> below is redundancy rather than coverage.
>
> NOT VERIFIED FIRST-HAND — the session that surfaced it had exhausted its web
> search budget and relied on trade-press summaries. **Check before relying on
> either version of this paragraph.**

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

### Price-history / "is this a good deal?" baseline (for the real value signal)
Kiwi gives only *current* fares — a true "below typical" badge needs history:
- **Amadeus Flight Price Analysis** — purpose-built: returns min / median /
  **quartile** price metrics per route+date, so "cheap / typical / expensive"
  drops out directly. Free dev tier, paid prod quota. **Best fit.**
  [docs](https://developers.amadeus.com/self-service/category/flights/api-doc/flight-price-analysis)
- **Travelpayouts / Aviasales Data API** — cheapest-fare price **calendar +
  monthly history** per route; **free** with affiliate signup (and earns
  commission). Derive the baseline yourself.
- Skyscanner / Google Flights would be ideal but are partner-only / no public API.
**Parked value-signal experiments:**
- **price-per-night** (`≈ X EUR/night` = total ÷ nights) — tried on the card, then
  removed 2026-07-24: marginal for 2–3-night weekends and not self-explanatory.
  Revisit only if trips get longer/variable or paired with a "best value" sort.
- **cross-destination percentile** ("cheapest 10%") — rejected: redundant with the
  price sort and misleads (compares destinations, not "good for this route").
The only *real* value signal ("below typical for this route") needs the price
history source above (Amadeus Price Analysis / Travelpayouts).

Sources: [Tequila](https://tequila.kiwi.com/) ·
[Kiwi affiliate 50k MAU](https://support.travelpayouts.com/hc/en-us/articles/360019237899-Kiwi-com-affiliate-program-API) ·
[Amadeus Cheapest Date Search](https://developers.amadeus.com/self-service/category/flights/api-doc/flight-cheapest-date-search) ·
[Amadeus pricing](https://developers.amadeus.com/pricing)

### TODO: the provider ladder (agent-researched 2026-09-02, decided with owner)

The September 2026 research pass (agent-verified against live docs and API
responses) settled the strategy: **Kiwi today → Aviasales as tested fallback →
Skyscanner when big.** All three are affiliate models — the data is free and
they pay commissions; the axes that matter are access and data quality, never
a bill. Amadeus was ruled out (production 500s for origins like BER; no
weekday filtering; nothing bookable to link to), Google-Flights scraping too
(Google v. SerpApi, Dec 2025).

- [ ] **Owner: email the Kiwi partner contact** for a plain statement on the
      key's continuity. Tequila closed to new partners May 2024 and Kiwi
      publicly de-prioritised the affiliate/deeplink model — the existing key
      is a grandfathered privilege. Their pruning filter is commercial value,
      so booking volume through our links is the number that protects us.
- [ ] **Owner: create a free Travelpayouts account** (self-serve, ~1–5 days'
      approval) and drop the API token in `.env.local` as
      `TRAVELPAYOUTS_TOKEN`. Blocks the next item.
- [ ] **Build the Aviasales shadow adapter** (S–M, ~2–4 days): a second
      implementation behind the `searchDeals()` seam in
      `src/lib/weekend-search.ts` that runs QUIETLY beside Kiwi on real
      searches and logs coverage/price deltas — users never see it. What it
      measures is the one unverifiable claim: European cache depth (their
      data comes from Aviasales users, who skew RU/CIS). Mapping notes from
      the research: origin→everywhere works (`destination` omitted /
      `prices_for_dates`), weekday windows and nights must be filtered
      client-side from returned date pairs, `market` must not default to
      `ru`, response `link` + our `marker` is the affiliate handoff, and
      cached prices go stale — the "checked X ago" stamp becomes
      load-bearing honesty.
- [ ] **After ~a month of shadow data, decide**: fallback-only (insurance if
      Kiwi pulls the key) · enrichment (merge where Kiwi is thin — dedupe by
      city+weekend, keep cheapest, label staleness honestly) · or shelve it
      if European coverage measures weak (owner's floor from the decision
      chat: ~15–25% fewer weekend pairs for smaller EU origins would be the
      pain threshold to discuss).
- [ ] **Owner: apply to Skyscanner's plain affiliate programme** once traffic
      clears ~5k uniques/month (impact.com, links/widgets only — no data
      feed) so handoffs earn before the API is reachable.
- [ ] **Apply for the Skyscanner Travel API at ~100k monthly visitors** — the
      strategic destination: Indicative Prices is cached everywhere-search
      built for exactly this board, with CPC-valued deeplinks. Their usage
      guidelines impose UX obligations (Powered-by branding, pre-deeplink
      disclosure, click-quality bars) that need a design pass of their own.

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

---

## Kiwi (Tequila) fields we don't parse yet — verified against a live response (2026-07-28)

Pulled a real `/v2/search` response (BCN, round trip, `nights_in_dst_from/to`) and dumped the
segment keys. Full `route[]` segment shape:

```
airline, bags_recheck_required, cityCodeFrom, cityCodeTo, cityFrom, cityTo,
combination_id, equipment, fare_basis, fare_category, fare_classes, flight_no,
flyFrom, flyTo, guarantee, id, local_arrival, local_departure,
operating_carrier, operating_flight_no, return, utc_arrival, utc_departure,
vehicle_type, vi_connection
```

Sample values: `airline: "VY"`, `flight_no: 3902`, `operating_carrier: "VY"`,
`operating_flight_no: "3902"`, `vehicle_type: "aircraft"`.

Itinerary level: `duration: {departure, return, total}` (seconds — this is what
`outDurationMin`/`backDurationMin` now read), `virtual_interlining: false`,
`availability: {seats: null}`.

### Worth harvesting

| Field | Why | Note |
|---|---|---|
| `operating_carrier` + `operating_flight_no` | **Unlocks the Travel Impact Model** (below) | Prefer *operating* over marketing carrier — on a codeshare TIM models the aircraft actually flying |
| `virtual_interlining` | The real self-transfer flag | `lib/baggage.ts` currently *infers* this from "2 carriers + a stop". Replace the guess with the fact |
| `bags_recheck_required` (per segment) | Answers "must I re-claim and re-check my bag?" | Concrete and actionable at a connection |
| `utc_departure` / `utc_arrival` | True elapsed time without timezone maths | We use `duration.*` for this now; these are the cross-check |

### Not usable

- `equipment` — `null` in the sample. Don't build aircraft-type UI on it without checking coverage.
- `availability.seats` — `null` here, and scarcity messaging would corrode the honesty positioning
  the rest of the product is built on. Deliberately skip.

## Travel Impact Model (TIM) — better CO₂ than our great-circle estimate

<https://travelimpactmodel.org> · Google's model, the emerging industry standard (used by Google
Flights, Skyscanner and others). Free API, key required.

**What it replaces:** `lib/co2.ts` is a great-circle distance estimate with a fixed economy factor.
TIM uses actual aircraft type and seat configuration per flight, so it distinguishes a full A320
from a half-empty regional jet on the same route.

**Keys off:** carrier + flight number + departure date — all confirmed present above, once we parse
them. This is the only blocker.

**Shape of the work:**
1. Parse `operating_carrier` / `operating_flight_no` / segment dates in `normalizeDeals`.
2. Server-side lookup, cached hard (emissions for a given flight+date barely move) — reuse
   `lib/api-cache.ts`.
3. **Per-segment**: a 1-stop trip needs both legs summed. Returns per-cabin figures; we want economy.
4. Fall back to the existing great-circle estimate when TIM has no data for a flight, and keep
   labelling estimates as estimates.

**Honest caveat:** coverage is not total. Some flights return nothing, so the great-circle path has
to stay as the fallback rather than being ripped out.

---

## Destination facts for short trips — research verdict (2026-07-29)

Researched the candidate list (car-free centres, tourist tax, ride-share, city
passes, "for foodies"/"cultures", train networks, hilliness/footwear, cash-vs-card,
guest registration, power outlets). Three independent consults, each measuring
against **live boards** (BCN 76 deals / CLJ 63 / LTN 75 — 214 deals, 42 destination
countries, 8 of them outside Europe).

### The rule that decides most of it

> **Silence must be a property of the trip, never of the dataset.**

The card's grammar depends on absence meaning something: no layover flag = the
connection is fine; no daylight line = daylight doesn't constrain this trip. A
hand-curated city fact breaks that — present on Rome, absent on Bergamo — and the
damage isn't local: readers learn a blank might just mean "we didn't get to it",
which retroactively devalues every honest silence already shipped. Worse, curated
coverage tracks city size, which tracks fare, so the *thinnest* cards would be
exactly the long tail this product exists to surface.

Three gates, all required: **derived not curated · fires on ≤25–30% of a real
board · changes which card you tap** (not what you pack).

### Worth adding

| Rank | Thing | Why | Effort |
|---|---|---|---|
| 1 | **Rebuild `cities.json`** from GeoNames `cities1000` + fix `norm()` | Fixes a *live* bug, no new feature needed. Current table misses 15 of 147 board cities — Dubrovnik, Valletta, Memmingen, Tromsø, Ibiza, Corfu — i.e. the leisure tail, so `airportKmFromCity` is silently null there. Also `norm()` mangles non-decomposable letters: `Tromsø → "troms"`, `Wrocław → "wroc aw"` | 0.5–1 d |
| 2 | **Airport → centre transfer time** | Distance isn't a travel time, and on a 48h trip a 90-min transfer is 6.3% of the trip (0.45% of a fortnight). FlixBus publishes a first-party pan-EU GTFS feed (33 MB, **ODbL**, refreshed within days) — airport→centre is usually one direct vehicle, so a `stop_times` self-join gives real numbers with no routing engine. Verified: Bergamo→Milan 55 min, Girona→Barcelona 75 min, Hahn→Frankfurt 150 min. ~40–50% of cards yield a defensible time; show the km line otherwise | 6–9 d |
| 3 | **Power outlet — Type G crossing only** | The only candidate with `daylight.ts`-grade certainty. Pure function of `(countryFromCode, countryToCode)`, both already on the Deal, so **no city anchor and no long-tail problem**. Wikidata P2853 (CC0) covered 42/42 board countries | 0.5 d |

**Copy the plug line as a difference, never a spec:** *"UK sockets — your charger
won't fit without an adapter."* Suppress it when the home airport is itself Type G
(fires on 91% of an LTN board — a constant).

### Not worth it, and why the reasons differ

- **Hilliness** — tested against EU-DEM and ASTER. Computable, and *wrong*: Lisbon ranks 23rd of 124 cities, below Oslo and Alicante; Edinburgh below Kaunas. A GeoNames centroid isn't the tourist core (Lisbon reads 5.74% at Baixa vs 3.18% at the table's coordinate). Honest version needs sampling along the walk network — 6–8 days plus curating "where is the core" for 300 cities.
- **Car-free centres** — OSM measures tagging convention, not pedestrianisation. Bruges (9.7%) ranks below Charleroi (12.1%); Trapani reads 0.0% despite a pedestrianised corso. Hand-curate ~40 cities or skip.
- **Tourist tax** — highest decision impact, worst data. Per-municipality for ~60% of every board (Italy alone: ~1,410 comuni). Changes are gazetted the *same day* they take effect (Turkey, 1 May 2026) and compilations disagree on live figures. 80–135 h/yr maintenance. The most expensive way to acquire our first confidently-wrong number.
- **Cash-vs-card / currency / 112 / tipping** — all *constants*, not conditionals (cash-heavy fires on 72–76% of every board; euro-vs-not is 97% from Cluj). Tipping additionally has **no authoritative source** — GastroSuisse states outright that no tipping statistics exist, while Switzerland Tourism publishes "~10%".
- **Schengen/borders** — fails the "identical for every passenger" test (nationality decides visa/EES/ETIAS/UK ETA), and the route-level claim is currently false: NL, FR and SE have notified intra-Schengen *air* border controls into late 2026.
- **Ride-share** — Bolt's city list is scrapeable (`robots.txt: Allow: /`, 723 EU cities, 70% board coverage) but **Uber's city pages are an SEO gazetteer, not a service map** — ~1,200 Italian "cities" listed, ~7 served. Never scrape Uber.
- **City passes** — no machine-readable dataset exists, and for 48–72h the honest answer is usually *don't buy one*: Roma Pass 48h is −€5 against a realistic two-sight basket; Paris Museum Pass 2-day −€19.
- **"For foodies" / "cultures"** — preferences, not facts. This codebase prints a bare IATA code rather than an unverified airline name; it can't then assert on nobody's authority that one city is "for foodies". If it ever ships, it's a **filter the user sets**, never a card row.

### Also flagged
- **Nager.Date** (in production, `holidays.ts`) states commercial use requires sponsorship. This product carries affiliate revenue — worth checking the terms.
- **Boards are not Europe-only.** 8 of 42 destination countries are outside Europe; any country table inherits the `airport-overrides.ts` duty to blank rather than guess.
- **Venice's access fee** is enforced Fri–Sun 08:30–16:00 — exactly this product's window. Deserves a hand-written note regardless.

---

## Outstanding work (as of 2026-07-30)

The authoritative list lives in the task tracker; this is the durable copy, with
the reasoning that does not fit in a task title. Numbers are task IDs.

### Product
- **#1 Surface bridge days on the board.** The bridge search already exists
  (`src/lib/bridges.ts`) but sits behind a toggle that is OFF by default, so the
  one thing competitors do not do is invisible. Three treatments were mocked and
  compared; **B** (a strip above the first card, naming each occasion with a
  "2 days off → 5" pill) was chosen because A and C both assume the reader
  already knows what a bridge day is. Must render nothing at all when an origin
  has no occasions — Warsaw's three are a favourable example, not typical.
  Do NOT simply default the toggle on: the route does `deals.filter(isBridge)`,
  which would cut a 57-deal board to a handful.
- **#5 → origin pages.** `docs/seo-origin-pages.md`. Blocked on extracting the
  search out of the route handler.

### Correctness
- **#6** `saveHomes()` runs before the fetch, so a failing origin is persisted
  and reloaded on the next visit.
- **#7** Map reported blank in a production build. Unreproduced — this
  environment cannot paint WebGL reliably, so a blank map here proves nothing.

### Interface — from the UI review (2026-07-30)
- **#2** Light-mode muted text fails WCAG AA in ~100 places (worst 1.83:1). The
  same alphas pass on the dark ground, which is the tell: the ramp was tuned in
  dark and reused. Needs per-theme tokens, not a find-and-replace.
- **#3** Error state is a bare red `<p>` with no retry.
- **#4** A 72px reserved slot renders empty above "Book on Kiwi" on most deals.
- **#10** Map labels clip at narrow widths; separator orphaning on wrap; weather
  emoji misaligns on multi-line.
- **#9** Design-system consolidation. True but low-impact — schedule it, don't
  absorb it into a bug-fix pass.

### Config
- **#8** Remove `WEEKEND_CURRENCY` from `.env.local` (it defeats
  `currencyForOrigin`), and set the contact / coffee / site-URL vars. See the
  table in `README.md`.

### Method note, worth keeping
Three separate mistakes this session came from the same habit: **measuring the
DOM and concluding something about how a thing LOOKS, without looking at it.**
A 150px-tall element was read as "laid out compactly" when it was rendering
blank; a `{"height": 0}` postMessage was read as "no inventory" when GYG sends
it for every city. If a claim is about appearance, it needs a screenshot behind
it, not a `getBoundingClientRect`.
