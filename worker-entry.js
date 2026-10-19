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
import { EmailMessage } from "cloudflare:email";
import handler from "./.open-next/worker.js";
import { runCanary, buildAlertEmail } from "./canary.js";

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

  // The cron half of the worker (triggers.crons in wrangler.jsonc). It is
  // here rather than inside Next because a scheduled() handler has no request
  // to hang off — OpenNext's generated worker only exports fetch.
  //
  // Everything effectful is wired here and passed in, so canary.js stays a
  // plain module vitest can import: `cloudflare:email` resolves only inside
  // workerd, and importing it from a tested file would break the suite.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      runCanary({
        kv: env.API_CACHE,
        apiKey: env.TEQUILA_API_KEY,
        sendEmail: async ({ subject, body }) => {
          const to = env.ALERT_TO || "raulropan@gmail.com";
          const from = "canary@weekend.flights";
          const raw = buildAlertEmail({
            from,
            to,
            subject,
            body,
            id: crypto.randomUUID(),
          });
          await env.ALERT_EMAIL.send(new EmailMessage(from, to, raw));
        },
      }).catch((e) => {
        // Never let the canary's own failure be silent — that would be the
        // monitor failing closed, which reads exactly like everything's fine.
        console.error(`Canary: run threw ${String(e)}`);
      })
    );
  },
};
