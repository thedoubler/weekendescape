import { NextRequest, NextResponse } from "next/server";

// Per-IP rate limiting for the routes that cost money.
//
// Why this exists: every /api route here is a paid upstream call — a Kiwi
// search, a Tequila lookup, a Google TIM request — and until now the ONLY thing
// between a stranger and the bill was an in-memory cache. Quantizing the cache
// keys (see weekends/route.ts) removed the trivial way to miss that cache on
// purpose, but nothing capped request volume, and on Workers the cache is
// per-isolate and dies on cold start, so the real hit rate is well below what
// local testing suggests.
//
// Cloudflare's native rate-limiting binding does the counting at the edge,
// which is the only place it can be done cheaply and before the request costs
// anything. It is per-colo rather than global — a determined attacker spread
// across regions gets a multiple of the limit — so this is a cost control, not
// an access control. For the actual threat (one script hammering one endpoint)
// it is exactly right, and it needs no store of our own.

// Bindings are declared in wrangler.jsonc. Anywhere they do not exist — `next
// dev`, vitest, a non-Cloudflare host — the limiter has to disappear rather
// than fail, so the app stays runnable outside Workers.
type Limiter = { limit: (o: { key: string }) => Promise<{ success: boolean }> };

async function getLimiter(name: string): Promise<Limiter | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    const binding = (ctx?.env as Record<string, unknown> | undefined)?.[name];
    if (binding && typeof (binding as Limiter).limit === "function") {
      return binding as Limiter;
    }
  } catch {
    // Not running on Workers, or the binding is not configured. Both mean "no
    // limiting available", which must never be an error.
  }
  return null;
}

/**
 * The caller's IP, as Cloudflare sees it.
 *
 * CF-Connecting-IP is set by Cloudflare itself and cannot be spoofed by the
 * client — unlike X-Forwarded-For, which anyone can send. Falling back to a
 * single shared key would rate-limit every visitor as one person, so when there
 * is no trustworthy IP we return null and skip limiting instead.
 */
function clientKey(request: NextRequest): string | null {
  return request.headers.get("cf-connecting-ip");
}

/**
 * Returns a 429 response when the caller is over the limit, or null to proceed.
 *
 * Fails OPEN. A limiter that errors, or an environment without the binding,
 * must not take the product down — the cost of a missed limit is a few extra
 * upstream calls, and the cost of a false positive is a visitor who cannot
 * search at all.
 */
export async function rateLimited(
  request: NextRequest,
  binding: string
): Promise<NextResponse | null> {
  const key = clientKey(request);
  if (!key) return null;
  const limiter = await getLimiter(binding);
  if (!limiter) return null;
  try {
    const { success } = await limiter.limit({ key });
    if (success) return null;
  } catch {
    return null;
  }
  return NextResponse.json(
    {
      // Named for what the visitor should do, not for the policy they tripped.
      error: "Too many searches from this connection — wait a minute and retry.",
    },
    { status: 429, headers: { "Retry-After": "60" } }
  );
}
