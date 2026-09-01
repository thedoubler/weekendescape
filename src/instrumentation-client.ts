// PostHog, initialised before the app becomes interactive — Next's
// instrumentation-client convention, so no provider component and no layout
// changes.
//
// Activation is gated twice, and both gates matter:
//   · NEXT_PUBLIC_POSTHOG_KEY is inlined at BUILD time (the NEXT_PUBLIC rule
//     in docs/pre-launch.md — it can never be a runtime Secret). Until the
//     key is set as a Cloudflare BUILD variable, this whole file is a no-op.
//   · Production only, same reasoning as the GA guard in layout.tsx: every
//     dev session and preview deploy would otherwise write into the same
//     project as real visitors.
//
// The import is dynamic and inside the guard, so a keyless build never
// fetches the PostHog chunk at all — the board's LCP pays nothing for an
// analytics tool that isn't configured.
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (key && process.env.NODE_ENV === "production") {
  import("posthog-js").then(({ default: posthog }) => {
    posthog.init(key, {
      // US cloud, where this project actually lives (project 588833). An
      // EU-cloud key would need the host set alongside it.
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      // PostHog's versioned defaults: initial pageview + history-change
      // pageviews, sane cookie behaviour. The board rewrites its query
      // string per filter tap via replaceState — those are real state
      // changes, so counting them as pageviews is signal, not noise.
      defaults: "2025-05-24",
      // No person profiles for anonymous visitors: same posture the About
      // page promises for analytics generally — measurement, not identity.
      // Nothing here calls identify(), so today every visitor is anonymous.
      person_profiles: "identified_only",
    });
    // The app's own events go through track() in src/lib/analytics.ts, which
    // reads this handle. A window global rather than an import, so component
    // bundles never pull posthog-js in — when this file didn't run (dev,
    // keyless build), track() finds nothing and costs nothing.
    (window as { __ph?: unknown }).__ph = posthog;
  });
}
