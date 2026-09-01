# Pre-launch checklist

Written 2026-09-01, after the security audit and the Cloudflare deploy work.
Ordered by what actually stops a launch, not by how interesting it is.

## The one rule about NEXT_PUBLIC_ variables

`NEXT_PUBLIC_*` values are **inlined into the bundle at build time**. They can
never be runtime secrets: a Cloudflare *Secret* is read from `env` when a
request arrives, and by then the string has already been baked into the
JavaScript — or not. Setting `NEXT_PUBLIC_CONTACT_EMAIL` as a secret does
nothing at all.

    NEXT_PUBLIC_*      -> Workers Builds "Build variables". Needs a REDEPLOY.
    everything else    -> the Worker's "Variables and Secrets". Live immediately.

`TEQUILA_API_KEY`, `UNSPLASH_ACCESS_KEY` and `GOOGLE_TIM_API_KEY` are server-only
and belong in the second group. Every `NEXT_PUBLIC_` one belongs in the first.

## Blockers

- [ ] **Deploy current `main`.** Production has repeatedly built a stale ref —
      on 2026-09-01 it served `4a6ca21` while `main` was three commits ahead, and
      it had previously served a NEWER build and then gone backwards. Check the
      branch under Workers Builds → Git configuration. Everything below assumes
      the deploy actually tracks `main`.
- [x] ~~**Rate limiting on `/api/*`.**~~ Done — Cloudflare's native rate-limit
      bindings, 20/min on the weekend search and 120/min on the cheap routes,
      keyed on `CF-Connecting-IP`. Verified in workerd: exactly 20 pass, then
      429 with `Retry-After: 60`, and a different IP is unaffected. Per-colo, so
      it is a cost control rather than an access control. Previously: Quantizing the cache keys
      shrank the blast radius (a loop over `maxPrice` no longer misses the cache
      every time) but nothing caps request volume, and every miss is a paid Kiwi
      search. On Cloudflare this is a WAF Rate Limiting rule, not code — the free
      plan includes one, which is enough: something like 30 requests / 10s per IP
      on `/api/*`.
- [ ] **`NEXT_PUBLIC_SITE_URL=https://weekend.flights`** as a *build* variable.
      Unset, canonical URLs, OG images, `robots.txt` and the sitemap all fall
      back to a Vercel domain or localhost. Link previews and every SEO signal
      depend on it, so this is a launch blocker rather than a nicety.

## Worth doing before the first real traffic

- [ ] **Create the KV namespace.** The code and binding are done; it needs an id:
      `npx wrangler kv namespace create API_CACHE`, then paste it over
      REPLACE_WITH_NAMESPACE_ID in wrangler.jsonc. Until then the binding is
      absent and the cache is memory-only — nothing breaks, it is just less
      effective. Previously: **move the API cache to Workers KV.** `src/lib/api-cache.ts` is per-isolate
      and dies on cold start. On Workers that is far more aggressive than on a
      long-lived Node server, so the real hit rate will be well below what local
      testing suggests and quota burn will exceed expectations even with no
      attacker. This is the difference between "cheap" and "surprising bill".
- [ ] **Confirm GA4 actually fires.** It is gated to `NODE_ENV === "production"`,
      so it has never run locally. Load the live site and check Realtime.
- [x] ~~**Look at light mode.**~~ Verified 2026-09-01 on a production build:
      zero contrast failures, --muted resolving to #5f6368. Previously: Every visual check this session ran in dark mode
      because that is the machine's setting. The tokens are computed correct
      (`#5f6368` is 6.05:1 on white) but nobody has actually looked at it.
- [ ] **Rotate `TEQUILA_API_KEY`.** It was pasted into a chat transcript on
      2026-09-01 while debugging the missing secret.

## Housekeeping

- [ ] Kill the public Cloudflare quick tunnel still pointed at localhost:3001.
- [ ] Drop `allowedDevOrigins: ["*.trycloudflare.com"]` from `next.config.ts`
      once tunnelling stops — it is dev-only, but it is a wildcard over anyone's
      quick tunnel.
- [ ] `NEXT_PUBLIC_BOOKING_AID` (build variable) if the hotel links should earn.
      They work unmonetized without it.
- [ ] `GOOGLE_TIM_API_KEY` (secret) if the CO2 figures should be live.

## Not blockers, but they are the growth plan

- [x] ~~**Server-rendered origin pages**~~ Shipped. `/from/bcn` serves 5,270
      characters of real content against the board's 656, opening with a
      sentence an assistant can quote. Five origins are prerendered and in the
      sitemap; the rest render lazily. To add more, extend SEEDED in
      `from/[iata]/page.tsx` and ORIGIN_PAGES in `sitemap.ts` together.
      Previously: **origin pages** (see `docs/seo-origin-pages.md`). A crawler currently sees 656 characters of the
      board and `?from=BCN` changes none of them; `/about` is the only page on
      the site that can be read in full. Until this ships there is no organic
      acquisition path, and the same fix serves LLM crawlers, which do not run
      JavaScript either.
- [ ] **Surface bridge days.** The one feature no competitor has is behind an
      off-by-default toggle. It is also the most citable thing here: assistants
      quote specific facts they cannot synthesise, and "which long weekends does
      a public holiday stretch, and what does it cost in leave" is exactly that.

## Already done, so nobody re-checks it

Secrets never committed (`.env.local` was never tracked); no SSRF (every
outbound host is a constant); sanitized error responses; `rel="noopener
noreferrer"` and `sponsored` on the affiliate links; origins validated, deduped
and capped; security headers shipped; `error.tsx` boundary; guarded
`localStorage`; `npm audit` clean across all dependencies; affiliate disclosure
in the footer; WCAG AA on the muted-text ramp.
