import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Committed rather than generated. The first failing deploy had no Cloudflare
// config in the repo at all, so `wrangler deploy` scaffolded one mid-build and
// installed whatever adapter version was newest that day — a build that could
// change without a commit.
export default {
  ...defineCloudflareConfig(),
  // The adapter shells out to build Next before it bundles the Worker. Left to
  // its default it runs the project's `build` script — and that script now runs
  // the adapter, so it would call itself forever. Naming the Next build
  // explicitly breaks that loop.
  //
  // --webpack, not Turbopack: Turbopack emits the next/font/google CSS as a real
  // .css chunk under .next/server that @font-face's the woff2 files, and the
  // esbuild pass here has no loader for a font binary. That is what five
  // "No loader is configured for .woff2" errors were.
  buildCommand: "next build --webpack",
};
