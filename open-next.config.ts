import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Committed rather than generated. The failing deploy had no Cloudflare config
// in the repo at all, so `wrangler deploy` scaffolded one mid-build and
// installed whatever version of the adapter was newest that day — a build that
// could change without a commit. Pinning it here makes the deploy reproducible.
export default defineCloudflareConfig();
