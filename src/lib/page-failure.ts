import { notFound } from "next/navigation";
import { logSafe } from "./log-safe";

/**
 * What an SEO page does when the upstream search it is built from fails.
 *
 * It rethrows, which sounds worse than notFound() and is much better. Both
 * the origin pages and the destination pages are ISR (`revalidate = 86400`),
 * so the two outcomes differ in what gets CACHED:
 *
 *   notFound()  a 404 is rendered AND cached, and every visitor and crawler
 *               is served it for up to a day. A ten-minute Tequila blip
 *               quietly turns every landing page on the site into a 404 for
 *               Googlebot — the one failure mode that costs traffic for weeks
 *               after the API comes back.
 *   throw       Next keeps serving the last good render and retries on the
 *               next request — next/dist/docs, incremental-static-regeneration
 *               under "Handling uncaught exceptions". Only a URL with nothing
 *               cached yet errors, and a 5xx tells Google "come back later"
 *               where a 404 says "this is gone".
 *
 * The build-time belt stays on, and it is the whole reason this is a function
 * rather than a `throw`. A throw during prerender escapes as "Export
 * encountered an error" and takes the WHOLE deploy down — rate limiting, CSP,
 * SEO fixes and all. There is no generateStaticParams on either route, so
 * nothing should ever prerender them; this is the belt to those braces,
 * because the cost of being wrong is asymmetric. A 404 on one page is a bad
 * page. A failed build is no site at all.
 *
 * The log line is the point of the exercise: these pages render on a schedule,
 * with nobody watching, so an upstream failure here has no user to report it.
 * `where` names the page, and logSafe carries message/code/status without
 * printing the apikey header (see log-safe.ts — that leak is why it exists).
 */
export function upstreamFailed(
  where: string,
  error: unknown,
  // Set by a page whose SUBJECT is the airport we just failed to route —
  // /from/[iata], whose code comes straight off the URL and is only shape
  // -checked. There, Tequila answering 422 is the authoritative "no such
  // airport", and the page really is missing. Caught live: without this,
  // every crawler walking /from/ZZZ got a 500 for Next to retry forever.
  //
  // The destination pages do NOT set it. Their slug is curated and already
  // validated against DESTINATION_PAGES before any search runs, so a 422
  // there is about one of the dozen ORIGINS, never about whether Rome
  // exists — an upstream problem, and the last good render should stand.
  opts?: { missingOn422?: boolean }
): never {
  console.error(`${where}: upstream search failed ${logSafe(error)}`);
  if (process.env.NEXT_PHASE === "phase-production-build") notFound();
  // Status read by shape rather than through axios, for the same reason
  // log-safe.ts does it: this module has no business importing an HTTP client.
  const status = (error as { response?: { status?: unknown } })?.response?.status;
  if (opts?.missingOn422 && status === 422) notFound();
  throw error instanceof Error ? error : new Error(String(error));
}

/**
 * A search that SUCCEEDED and returned nothing.
 *
 * Kept as a 404, because a curated page with no fares on it is a thin page
 * and should not be in the index — but logged at the same volume as a
 * failure, because on a curated city with a dozen origin metros, zero is far
 * more likely to be the shape of an upstream problem (a quota wall that
 * answers 200 with an empty list) than the honest truth about the weekend.
 */
export function noResults(where: string, detail: string): never {
  console.error(`${where}: upstream search returned 0 deals ${detail}`);
  notFound();
}
