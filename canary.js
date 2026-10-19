// The Tequila canary: one fixed search every 30 minutes, so an outage is
// found by a cron rather than by a visitor.
//
// WHY A DIRECT TEQUILA CALL and not a fetch of our own /api/weekends: the
// route is wrapped in the KV upstream cache (src/lib/api-cache.ts), and a
// canary that repeats identical params would mostly be served from that
// cache — it would stay green through an outage, which is worse than no
// canary at all. Calling Tequila straight tests the one thing that has no
// other alarm on it: is the API answering, and is our key still good. Our own
// 5xx are covered by the Cloudflare error-rate alert and by the per-branch
// log lines in /api/weekends.
//
// Plain ESM, no imports, no `cloudflare:email`: wrangler bundles this into
// worker-entry.js, and vitest imports the same file directly. The two
// effectful things it needs — fetching, and sending mail — are passed in.

const TEQUILA_BASE_URL = "https://tequila-api.kiwi.com";
const STATE_KEY = "canary:tequila";

// Two in a row before anyone is woken. One failure is a blip (a dropped
// connection, a colo hiccup, a 30-second upstream wobble) and mailing on it
// trains you to ignore the mail — which is the real failure mode of a canary.
const FAILURES_BEFORE_ALERT = 2;

function pad(n) {
  return String(n).padStart(2, "0");
}

// dd/mm/yyyy, the format Tequila takes (mirrors formatTequilaDate in
// src/lib/timeline.ts — duplicated rather than imported because this file is
// outside the Next build).
function tequilaDate(d) {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * One probe: fetch it, and decide whether the answer is the shape we live on.
 * A 200 whose body we do not recognise counts as down — a quota wall that
 * answers 200 with nothing is exactly the outage this exists for, and it is
 * the one a plain status check sails straight past.
 */
async function probe(url, apiKey, fetchImpl, arrayKey) {
  try {
    const res = await fetchImpl(url, {
      headers: { apikey: apiKey },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
    const body = await res.json();
    if (!body || !Array.isArray(body[arrayKey])) {
      return { ok: false, detail: `HTTP 200 with no ${arrayKey}[] array` };
    }
    return { ok: true, detail: `HTTP 200, ${body[arrayKey].length} row(s)` };
  } catch (e) {
    const name = e?.name === "TimeoutError" ? "timeout" : e?.name || "error";
    return { ok: false, detail: `${name}: ${e?.message ?? String(e)}` };
  }
}

/**
 * TWO probes, because one of them cannot fail the way you would expect.
 *
 * Measured against the live API on 2026-10-19, same host the app uses:
 *
 *   /v2/search       200 with a good key, 200 with a junk key, and 200 with
 *                    NO apikey header at all — byte-for-byte identical
 *                    responses (5163 bytes each). It does not authenticate.
 *   /locations/query 200 with a good key, 401 {"error_code":401} with a junk
 *                    one. It does.
 *
 * So a search-only canary would sit green through a revoked or expired key —
 * the first failure anyone actually worried about here. /locations/query is
 * the key check (and it is the cheap endpoint, per wrangler.jsonc), /v2/search
 * is the product check. Auth goes first because a dead key makes the other
 * result meaningless.
 */
export async function checkTequila({ apiKey, fetchImpl = fetch, now = new Date() }) {
  if (!apiKey) return { ok: false, detail: "TEQUILA_API_KEY missing" };

  const auth = await probe(
    `${TEQUILA_BASE_URL}/locations/query?${new URLSearchParams({
      term: "cluj",
      location_types: "airport",
      limit: "1",
    })}`,
    apiKey,
    fetchImpl,
    "locations"
  );
  if (!auth.ok) return { ok: false, detail: `key check: ${auth.detail}` };

  const to = new Date(now);
  to.setMonth(to.getMonth() + 1);
  const search = await probe(
    `${TEQUILA_BASE_URL}/v2/search?${new URLSearchParams({
      fly_from: "CLJ",
      date_from: tequilaDate(now),
      date_to: tequilaDate(to),
      flight_type: "round",
      nights_in_dst_from: "1",
      nights_in_dst_to: "3",
      curr: "EUR",
      sort: "price",
      limit: "1",
    })}`,
    apiKey,
    fetchImpl,
    "data"
  );
  if (!search.ok) return { ok: false, detail: `search: ${search.detail}` };

  return { ok: true, detail: `key ok, search ${search.detail}` };
}

/** RFC 5322, by hand. Cloudflare rejects a message without a Message-ID. */
export function buildAlertEmail({ from, to, subject, body, id }) {
  return [
    `From: Weekend Flights canary <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Message-ID: <${id}@weekend.flights>`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="utf-8"',
    "",
    body,
  ].join("\r\n");
}

/**
 * The state machine. Mails on the SECOND consecutive failure and on the
 * recovery after one, and never in between — a canary that mails every 30
 * minutes for a day-long outage is a canary you filter into a folder.
 */
export async function runCanary({
  kv,
  apiKey,
  sendEmail,
  fetchImpl = fetch,
  now = new Date(),
  log = console,
}) {
  const result = await checkTequila({ apiKey, fetchImpl, now });

  let state = { consecutive: 0, alerted: false, lastOkAt: null };
  try {
    const raw = await kv?.get(STATE_KEY);
    if (raw) state = { ...state, ...JSON.parse(raw) };
  } catch (e) {
    // A canary that dies because its own notebook is unreadable is no canary.
    log.error(`Canary: unreadable state, assuming healthy ${String(e)}`);
  }

  let action = "none";
  if (result.ok) {
    if (state.alerted) {
      action = "recovered";
      await sendEmail({
        subject: "Tequila is answering again",
        body: [
          `Recovered at ${now.toISOString()}.`,
          `Check: ${result.detail}`,
          "",
          "Nothing was changed to fix it — this is the canary noticing the",
          "search came back. If you did not do anything, assume Kiwi did.",
        ].join("\n"),
      });
    }
    state = { consecutive: 0, alerted: false, lastOkAt: now.toISOString() };
  } else {
    state.consecutive += 1;
    log.error(`Canary: tequila check failed (${state.consecutive}) ${result.detail}`);
    if (state.consecutive >= FAILURES_BEFORE_ALERT && !state.alerted) {
      action = "alerted";
      state.alerted = true;
      await sendEmail({
        subject: "Tequila search is failing",
        body: [
          `${state.consecutive} consecutive failed checks, the latest at ${now.toISOString()}.`,
          `Reason: ${result.detail}`,
          `Last good check: ${state.lastOkAt ?? "not since this worker was deployed"}`,
          "",
          "What this means: the board, the origin pages and the destination",
          "pages all run on this one API. The SEO pages keep serving their",
          "last good render while it is down (they no longer cache a 404),",
          "so the damage is bounded — but nothing new is being priced.",
          "",
          "Where to look: Workers Logs, filtered on `outcome=` for the",
          "per-branch failure lines from /api/weekends.",
        ].join("\n"),
      });
    } else if (state.consecutive < FAILURES_BEFORE_ALERT) {
      action = "waiting";
    } else {
      action = "already-alerted";
    }
  }

  try {
    await kv?.put(STATE_KEY, JSON.stringify(state));
  } catch (e) {
    log.error(`Canary: could not write state ${String(e)}`);
  }
  return { result, state, action };
}
