// Site identity, in a plain module rather than in layout.tsx.
//
// A route file may only export the names Next knows about (`default`,
// `metadata`, `generateMetadata`, …). Exporting `siteUrl` and `SITE_NAME` from
// the layout type-checked under Turbopack and failed under webpack with
// "Property 'siteUrl' is incompatible with index signature" — the same build
// that Cloudflare's OpenNext adapter runs. So this was a latent deploy blocker,
// not a style preference.

// Absolute base for OG image URLs and canonical links. Prefers an explicit env
// var, then Vercel's stable production domain, else localhost in dev.
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

// The product is called weekend.flights — the name is the pitch and the address
// at once. It has to match the header everywhere it is quoted back at a reader:
// tab title, search result, link preview, share card. Keep the dot lowercase and
// unspaced; it is part of the name, not punctuation around it.
export const SITE_NAME = "weekend.flights";
