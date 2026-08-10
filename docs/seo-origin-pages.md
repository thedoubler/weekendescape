# Spec — server-rendered origin pages (`/from/[iata]`)

Status: **not built.** Written 2026-07-30 so it can be picked up later.

## The problem

`src/app/page.tsx` is `"use client"`. The server sends a shell, React boots,
calls `/api/weekends`, and paints the board. A crawler that does not run
JavaScript sees the shell — **503 characters of visible text**, with no city, no
route and no price in it.

Measured, not estimated: `curl localhost:3000/` and strip the tags.

That is the whole SEO problem. Metadata (title, OG, robots, sitemap, JSON-LD —
all shipped) is hygiene; it cannot make a page rank for content the page does
not contain. It is also the GEO problem, since LLM crawlers do not run JS
either. One fix serves both, and there are no GEO-specific tactics in this spec
because none are established enough to write down.

## The unit is the ORIGIN, not the destination

An earlier draft of this said `/weekend/barcelona`, which reads as "a weekend
*in* Barcelona". That is not what this product answers. It answers **"where can
I go this weekend, from where I live."**

So: `/from/barcelona` — *Cheap weekend flights from Barcelona* — a ranked list
of destinations with prices.

Three reasons this is the right unit:

1. It matches the product. The board is anchored on a home airport.
2. It matches the query. People search "weekend getaway from Barcelona", not
   "weekend in Rome" — and against "weekend in Rome" this site has nothing to
   say that a thousand travel sites don't.
3. **It is bounded.** One page per origin airport. 100–200 pages, done.

### Do NOT build the pair matrix

`/from/barcelona/to/rome` is 200 x 200 = **40,000 pages**, each carrying a
single price. That is exactly the thin auto-generated content Google penalises,
and it would put the whole domain at risk to chase long-tail queries.

If origin pages work, pairs for the top ~10 routes per origin (~2,000 pages)
could be revisited. Only then, and only with a reason for each page to exist
beyond a number.

## How a page is populated

By running **the same search the board runs**, on the server, at revalidate
time. Nothing new is fetched and no copy is written to pad the page: the content
is the product's own output.

    /from/barcelona  ->  weekend search, flyFrom=BCN  ->  top ~20 deals as HTML

Each row renders city, dates, price, airline, flight time — genuinely unique per
origin, refreshed daily.

### The one piece of real work

All 320 lines of the search live inside the `GET` handler in
`src/app/api/weekends/route.ts`. A server component cannot call a route handler.

So the logic has to move into a shared module — say `src/lib/weekend-search.ts` —
that **both** the API route and the page import. That refactor is the bulk of
this job; the page itself is small. It is also worth doing on its own merits:
320 lines in a request handler is where testability goes to die.

Do NOT have the page `fetch()` its own API route. It works, and it wastes an
HTTP round trip to talk to itself.

## Caching

    export const revalidate = 86400   // daily

Rendered once per window, then served from cache. The 10,000th visitor costs a
file read — no React render, no route invocation, no Kiwi call.

`generateStaticParams` should return **a handful** of high-value origins, with
`dynamicParams` left on. Returning all 200 means 200 Kiwi calls in a burst at
deploy time, which is where a rate limit would bite and what would make every
deploy slow. The rest generate lazily on first visit, then cache.

## Load

Measured on a live board (`?from=CLJ`): **1 serverless invocation per visitor**
(`/api/weekends`), 25 requests, 101 KB. Weather, holidays and images are already
resolved server-side inside that one call.

| per visitor            | today            | cached origin page |
| ---------------------- | ---------------- | ------------------ |
| Serverless invocations | 1                | **0**              |
| Kiwi searches          | 0–1 (cache-dep.) | **0**              |

Added fixed cost: ~200 renders + ~200 Kiwi searches per day, spread out — about
8 an hour, under a minute of compute daily. Every visitor served from a cached
page *removes* an invocation, so this pays for itself quickly. Invocations are
the metered unit on Vercel's lower tiers.

The unknown that decides the cadence is the **Kiwi rate limit / overage cost**,
which is in the partner agreement, not the code. If it is tight, cut the origin
list — 30 good pages beat 200 thin ones for ranking anyway.

## The URL's origin WINS over geolocation

Decided, and it follows existing precedent: `?from=BCN` already beats
geolocation in the bootstrap effect in `page.tsx`.

A visitor who lands on `/from/barcelona` sees **Barcelona** results, whatever
their browser reports. Auto-overriding to their detected airport would:

- contradict the link they clicked and the headline they are reading;
- serve users content different from what was indexed for that URL;
- make the page's one job — answer "weekend flights from Barcelona" — fail.

For the visitor who is genuinely somewhere else, offer a **visible switch**
("Flying from somewhere else?") that takes them to the board. Never silently
relocate them.

## Prices go stale — say so

A page cached for a day shows fares that may have moved, and this product's
credibility is its numbers. The page carries the timestamp it was generated at
("checked today"), and the live board stays exactly as it is.

The static page is an entry point, not the booking surface: anyone who clicks
through lands on the real search.

## Checklist

- [ ] Extract the search from `route.ts` into `src/lib/weekend-search.ts`
- [ ] `src/app/from/[iata]/page.tsx` — server component, `revalidate = 86400`
- [ ] `generateStaticParams` — a handful of origins, `dynamicParams` on
- [ ] `generateMetadata` — per-origin title, description, canonical
- [ ] Add origin URLs to `src/app/sitemap.ts` (returns exactly one entry today)
- [ ] "Checked <date>" stamp + "Flying from somewhere else?" switch
- [ ] Confirm the Kiwi rate limit before choosing the origin count
