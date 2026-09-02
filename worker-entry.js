// The real worker entry: a thin shell around OpenNext's generated worker.
//
// It exists for ONE job — the http→https redirect — because inside the Next
// pipeline it cannot be done: the proxy's 301 came out with its Location
// normalised back to the incoming scheme (verified in workerd with both a
// mutated URL object and a literal https string), which in production would
// have been a redirect loop. Out here nothing rewrites anything.
//
// wrangler's `main` points HERE; everything except the scheme check is
// delegated untouched, and the durable objects the generated worker exports
// are re-exported so their bindings keep resolving.
import handler from "./.open-next/worker.js";

export {
  DOQueueHandler,
  DOShardedTagCache,
  BucketCachePurge,
} from "./.open-next/worker.js";

const PROD_HOST = /(^|\.)weekend\.flights$/;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const host = url.hostname;
    // cf-visitor is Cloudflare's own record of the visitor's scheme; the
    // URL's protocol covers any path that reaches the worker un-proxied.
    // Gated on the production host so workerd previews (plain http on
    // localhost) keep working.
    const visitorHttp =
      request.headers.get("cf-visitor")?.includes('"scheme":"http"') ||
      url.protocol === "http:";
    if (PROD_HOST.test(host) && visitorHttp) {
      return Response.redirect(
        `https://${host}${url.pathname}${url.search}`,
        301
      );
    }
    return handler.fetch(request, env, ctx);
  },
};
