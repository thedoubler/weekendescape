// Site identity, in a plain module rather than in layout.tsx.
//
// A route file may only export the names Next knows about (`default`,
// `metadata`, `generateMetadata`, …). Exporting `siteUrl` and `SITE_NAME` from
// the layout type-checked under Turbopack and failed under webpack with
// "Property 'siteUrl' is incompatible with index signature" — the same build
// that Cloudflare's OpenNext adapter runs. So this was a latent deploy blocker,
// not a style preference.

// Absolute base for canonical links, OG image URLs, robots and the sitemap.
//
// The last fallback used to be localhost, which is right in dev and silently
// catastrophic anywhere else. Deployed to Cloudflare — where none of Vercel's
// env vars exist — production shipped `<link rel="canonical"
// href="http://localhost:3000">`, a sitemap listing localhost URLs, a robots.txt
// pointing Google at a localhost sitemap, and an og:image nobody could fetch.
// A missing build variable should not be able to do that, so the production
// fallback is now the real domain and localhost is reached only in development.
const PRODUCTION_ORIGIN = "https://weekend.flights";

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.NODE_ENV === "production"
      ? PRODUCTION_ORIGIN
      : "http://localhost:3000");

// The product is called weekend.flights — the name is the pitch and the address
// at once. It has to match the header everywhere it is quoted back at a reader:
// tab title, search result, link preview, share card. Keep the dot lowercase and
// unspaced; it is part of the name, not punctuation around it.
export const SITE_NAME = "weekend.flights";
