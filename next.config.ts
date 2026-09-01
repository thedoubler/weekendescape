import type { NextConfig } from "next";

// Headers that matter for THIS product, which is a board of affiliate
// click-outs. Framing is the direct attack: an attacker embeds the site,
// overlays their own links on the Book buttons, and takes the commission — so
// frame-ancestors is a revenue control, not boilerplate.
//
// No full CSP yet, deliberately. The activities panel injects a third-party
// script from widget.getyourguide.com at runtime and maplibre needs blob:
// workers, so a script-src written blind would break both. That is a follow-up
// with the page in front of you, not a launch gate.
// A real CSP, enumerated from what the app actually loads rather than guessed.
// Every host here earns its place:
//   googletagmanager / google-analytics  GA4
//   widget.getyourguide.com              the activities widget (script + iframe)
//   tiles.openfreemap.org                map style JSON and vector tiles
//   images.kiwi.com                      airline logos
// Everything else the code touches — Tequila, Open-Meteo, Nager.Date, the Google
// travel-impact model — is called from the SERVER and never appears in a browser
// request, so it must not be in connect-src.
//
// script-src keeps 'unsafe-inline'. Next injects its own bootstrap inline, and
// removing it needs a nonce, which needs middleware — and middleware is both a
// bigger change and the surface one of Next's advisories lives on. The tradeoff
// is acceptable HERE specifically because this app renders no user-authored
// HTML: every dynamic value reaches the DOM as a React text child, which is
// escaped. The CSP still does the thing that matters, which is stopping a
// script from an unknown host running at all.
//
// worker-src blob: is maplibre, which compiles its renderer into a blob worker.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  // *.posthog.com in script-src as well as connect-src: posthog-js is bundled,
  // but it lazily loads extension scripts (session replay's recorder, the
  // toolbar) from PostHog's assets host at runtime. Blocking those fails
  // silently and turns a project-settings toggle into a mystery.
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://widget.getyourguide.com https://*.posthog.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.kiwi.com https://tiles.openfreemap.org https://widget.getyourguide.com https://*.getyourguide.com https://www.googletagmanager.com https://*.google-analytics.com",
  "font-src 'self' data:",
  "connect-src 'self' https://tiles.openfreemap.org https://widget.getyourguide.com https://*.getyourguide.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://*.posthog.com",
  "worker-src 'self' blob:",
  "frame-src https://widget.getyourguide.com https://*.getyourguide.com",
  // No upgrade-insecure-requests. On the https production origin it is a no-op
  // — every subresource here is already https or same-origin — and on a plain
  // http origin it actively breaks things: an older Chromium that does not
  // exempt localhost upgrades the stylesheet request to an https port nothing
  // listens on, and the page renders bare HTML. Observed, not theoretical.
].join("; ");

const securityHeaders = [
  // SAMEORIGIN rather than DENY. The attack this exists to stop is a third
  // party framing the board and overlaying its own links on the Book buttons —
  // 'self' prevents that completely, because only weekend.flights can frame
  // weekend.flights. DENY additionally forbade the site framing itself, which
  // bought no security and broke same-origin previews and responsive testing.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send the origin to affiliate partners (they attribute on it) but never the
  // full URL, which carries the visitor's airport and dates.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Geolocation is the one capability the product asks for; nothing else.
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), camera=(), microphone=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  // Dev only: lets HMR and hydration work through a Cloudflare quick tunnel.
  // It is a wildcard over anyone's quick tunnel, so it must not outlive the
  // tunnelling it enables.
  allowedDevOrigins: ["*.trycloudflare.com"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
