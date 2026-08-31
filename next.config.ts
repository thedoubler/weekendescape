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
const securityHeaders = [
  // SAMEORIGIN rather than DENY. The attack this exists to stop is a third
  // party framing the board and overlaying its own links on the Book buttons —
  // 'self' prevents that completely, because only weekend.flights can frame
  // weekend.flights. DENY additionally forbade the site framing itself, which
  // bought no security and broke same-origin previews and responsive testing.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
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
