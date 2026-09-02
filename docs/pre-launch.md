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

## The build cache lies

Cloudflare restores `.next` between builds ("Success: Build output restored from
build cache"), and `next build` then re-exports pages from that stale output
instead of from source. This burned four deploys: builds kept generating 18
pages and throwing `MissingApiKeyError` from a `throw` that no longer existed in
`main`, twelve minutes after the commit that removed it.

`npm run build` now starts with `rm -rf .next .open-next`. If a build ever again
reports a page count or an error that does not match the source, suspect the
cache before suspecting the ref.

## Blockers

- [x] ~~**Deploy current `main`.**~~ Resolved 2026-09-01: the stale-ref
      mystery was Cloudflare's restored build cache, fixed by the `rm -rf
      .next .open-next` prefix in the build script. Deploys have tracked
      `main` faithfully since (dozens verified live through 2026-09-02).
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
- [x] ~~**`NEXT_PUBLIC_SITE_URL` as a build variable.**~~ No longer a
      blocker: `src/lib/site.ts` defaults to `https://weekend.flights` in
      production (verified live — canonical, OG and sitemap all correct).
      Setting the variable remains optional belt-and-braces for forks.
- [x] **PostHog needs no variable any more.** The public project token is
      inline in `src/instrumentation-client.ts` (same reasoning as the GA id
      in layout.tsx); `NEXT_PUBLIC_POSTHOG_KEY` remains as an optional
      override for a fork or staging project. US cloud (project 588833) is
      the default host.

## The deploy that "succeeds" can still hang one route

Observed live 2026-09-02: a deployment came up with `/` hanging forever
(zero bytes, every query variant) while `/about`, `/from/*`, the 404 and all
APIs served normally. The code was healthy — the identical build served `/`
in 0.15s under local workerd, and redeploying the same commit fixed
production in ~80s — so the deployment artifact itself was bad, most
plausibly a corrupt cache/asset entry for the root HTML. Cloudflare's build
reported success; nothing on their side checks that routes actually answer.

**The drill, if the site "is down" but only sort of:** curl `/`, `/about`,
`/from/OTP` and an API route separately. One route hanging while the rest
serve = wedged deployment, not code — push an empty commit to roll a fresh
deployment over it (`git commit --allow-empty`), and expect stragglers for a
minute while old isolates drain. All routes failing = look at DNS/Cloudflare
status first.

- [ ] **Post-deploy smoke check** so this class is caught by a machine, not a
      visitor: an uptime ping on `https://weekend.flights/` expecting 200
      within a few seconds (UptimeRobot free tier, or a Worker cron that
      fetches `/` and alerts). Dashboard-side, five minutes of setup.

## Worth doing before the first real traffic

- [ ] **Create the KV namespace.** The code is done; the BINDING is commented out
      in wrangler.jsonc because a placeholder id is not inert — wrangler
      validates ids at deploy time and refuses the whole deploy. Run the command,
      paste the id, uncomment the block. Previously:
      `npx wrangler kv namespace create API_CACHE`, then paste it over
      REPLACE_WITH_NAMESPACE_ID in wrangler.jsonc. Until then the binding is
      absent and the cache is memory-only — nothing breaks, it is just less
      effective. Previously: **move the API cache to Workers KV.** `src/lib/api-cache.ts` is per-isolate
      and dies on cold start. On Workers that is far more aggressive than on a
      long-lived Node server, so the real hit rate will be well below what local
      testing suggests and quota burn will exceed expectations even with no
      attacker. This is the difference between "cheap" and "surprising bill".
- [x] ~~**Confirm GA4 actually fires.**~~ Verified live 2026-09-01: a real
      page_view hit reaches google-analytics.com with tid=G-BVSSW686DH, and
      the paired snippet sits at the top of the document. If the GA console
      still says "not detected", check the DATA STREAM URL: it must be
      https://weekend.flights — www has no DNS record and a www stream URL
      dials a dead host forever. Original note: It is gated to `NODE_ENV === "production"`,
      so it has never run locally. Load the live site and check Realtime.
- [x] ~~**Look at light mode.**~~ Verified 2026-09-01 on a production build:
      zero contrast failures, --muted resolving to #5f6368. Previously: Every visual check this session ran in dark mode
      because that is the machine's setting. The tokens are computed correct
      (`#5f6368` is 6.05:1 on white) but nobody has actually looked at it.
- [ ] **Rotate `TEQUILA_API_KEY`.** It was pasted into a chat transcript on
      2026-09-01 while debugging the missing secret.

## Housekeeping

- [x] ~~Kill the public Cloudflare quick tunnel at localhost:3001.~~ Gone —
      verified 2026-09-02, no cloudflared targets 3001 any more. (Five OTHER
      projects' quick tunnels were still running on this machine at the time;
      not this repo's to kill, but worth their owner's attention.)
- [x] ~~Drop `allowedDevOrigins` from `next.config.ts`~~ Done 2026-09-02,
      same commit as this edit. Original note: drop it
      once tunnelling stops — it is dev-only, but it is a wildcard over anyone's
      quick tunnel.
- [ ] `NEXT_PUBLIC_BOOKING_AID` (build variable) if the hotel links should earn.
      They work unmonetized without it.
- [ ] `GOOGLE_TIM_API_KEY` (secret) if the CO2 figures should be live.
- [ ] **"Always Use HTTPS"** in Cloudflare (SSL/TLS → Edge Certificates):
      verified 2026-09-01 that `http://weekend.flights` serves the page with
      no redirect. One toggle.
- [ ] **HSTS** (same screen), after Always-Use-HTTPS has soaked: start with a
      modest max-age before committing to preload.
- [ ] **A `www` record + redirect to the apex.** `www.weekend.flights` has no
      DNS record at all — every typed-www visit and any www link dead-ends,
      and a www GA4 stream URL can never verify. DNS → add `www` (proxied,
      AAAA 100:: is fine) → Bulk Redirects or a redirect rule to the apex.

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
