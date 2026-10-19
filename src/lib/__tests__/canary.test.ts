import { describe, it, expect, vi } from "vitest";
// Plain ESM at the repo root: wrangler bundles it into the worker, the Next
// build never sees it, and this suite imports the very file that ships.
import { runCanary, checkTequila, buildAlertEmail } from "../../../canary.js";

const NOW = new Date("2026-10-19T09:00:00.000Z");
const silent = { error: () => {} } as unknown as Console;
// The fakes answer with the two fields checkTequila reads, not a whole
// Response; the cast keeps that honest without dragging in a DOM polyfill.
const asFetch = (f: unknown) => f as unknown as typeof fetch;

/** A KV stand-in that remembers, because the whole point is what carries over. */
function fakeKv(initial?: unknown) {
  let value = initial === undefined ? null : JSON.stringify(initial);
  return {
    get: async () => value,
    put: async (_k: string, v: string) => {
      value = v;
    },
    read: () => (value ? JSON.parse(value) : null),
  };
}

// Both probes answer healthy: /locations/query returns locations[], the
// search returns data[].
const ok = () =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({ locations: [{ code: "CLJ" }], data: [{ price: 42 }] }),
  });
const down = () => Promise.resolve({ ok: false, status: 503, json: async () => ({}) });

function run(kv: ReturnType<typeof fakeKv>, fetchImpl: () => Promise<unknown>) {
  const sendEmail = vi.fn<(msg: { subject: string; body: string }) => Promise<void>>();
  return runCanary({
    kv,
    apiKey: "k",
    sendEmail,
    fetchImpl: asFetch(fetchImpl),
    now: NOW,
    log: silent,
  }).then(
    (r: { action: string }) => ({ ...r, sendEmail })
  );
}

describe("the canary's state machine", () => {
  // One failure is a blip. Mailing on it is how a canary gets filtered into a
  // folder and stops working the day it matters.
  it("stays quiet on a single failure", async () => {
    const kv = fakeKv();
    const r = await run(kv, down);
    expect(r.sendEmail).not.toHaveBeenCalled();
    expect(r.action).toBe("waiting");
    expect(kv.read().consecutive).toBe(1);
  });

  it("mails on the second consecutive failure", async () => {
    const kv = fakeKv();
    await run(kv, down);
    const r = await run(kv, down);
    expect(r.sendEmail).toHaveBeenCalledTimes(1);
    expect(r.sendEmail.mock.calls[0][0].subject).toMatch(/failing/i);
    expect(kv.read().alerted).toBe(true);
  });

  // A day-long outage must not mean 48 emails.
  it("does not mail again while it is still down", async () => {
    const kv = fakeKv();
    await run(kv, down);
    await run(kv, down);
    const third = await run(kv, down);
    const fourth = await run(kv, down);
    expect(third.sendEmail).not.toHaveBeenCalled();
    expect(fourth.sendEmail).not.toHaveBeenCalled();
    expect(fourth.action).toBe("already-alerted");
  });

  it("mails once when it recovers, then goes quiet", async () => {
    const kv = fakeKv();
    await run(kv, down);
    await run(kv, down);
    const back = await run(kv, ok);
    expect(back.sendEmail).toHaveBeenCalledTimes(1);
    expect(back.sendEmail.mock.calls[0][0].subject).toMatch(/again/i);
    expect(back.action).toBe("recovered");
    const after = await run(kv, ok);
    expect(after.sendEmail).not.toHaveBeenCalled();
  });

  // The counter resetting matters: two failures a week apart are two blips,
  // not an outage, and must not add up to an alert.
  it("forgets a failure once a check succeeds", async () => {
    const kv = fakeKv();
    await run(kv, down);
    await run(kv, ok);
    const r = await run(kv, down);
    expect(r.sendEmail).not.toHaveBeenCalled();
    expect(kv.read().consecutive).toBe(1);
  });

  it("still runs when its own stored state is garbage", async () => {
    const kv = {
      get: async () => "{not json",
      put: async () => {},
    };
    const r = await run(kv as never, ok);
    expect(r.action).toBe("none");
  });
});

describe("what counts as a failure", () => {
  it("treats a non-2xx as down", async () => {
    const r = await checkTequila({ apiKey: "k", fetchImpl: asFetch(down), now: NOW });
    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/503/);
  });

  // THE reason there are two probes. Measured live: /v2/search answers 200
  // with a junk key and with no key at all, byte-identical, so a search-only
  // canary sits green through a revoked key. /locations/query 401s, which is
  // what actually catches it.
  it("catches a revoked key, which the search endpoint cannot", async () => {
    const fetchImpl = vi.fn<(url: string) => Promise<unknown>>(async (url: string) =>
      url.includes("/locations/query")
        ? { ok: false, status: 401, json: async () => ({ error_code: 401 }) }
        : { ok: true, status: 200, json: async () => ({ data: [{ price: 42 }] }) }
    );
    const r = await checkTequila({ apiKey: "revoked", fetchImpl: asFetch(fetchImpl), now: NOW });
    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/key check.*401/);
  });

  it("checks the key before the search, so a dead key is the diagnosis", async () => {
    const seen: string[] = [];
    const fetchImpl = async (url: string) => {
      seen.push(url);
      return { ok: true, status: 200, json: async () => ({ locations: [1], data: [1] }) };
    };
    await checkTequila({ apiKey: "k", fetchImpl: asFetch(fetchImpl), now: NOW });
    expect(seen[0]).toMatch(/\/locations\/query/);
    expect(seen[1]).toMatch(/\/v2\/search/);
  });

  // The failure a plain status check sails past: a quota wall that answers
  // 200 with an empty body. The board would show nothing and look healthy.
  it("treats a 200 with no data[] as down", async () => {
    const r = await checkTequila({
      apiKey: "k",
      fetchImpl: asFetch(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ locations: [1] }),
      })),
      now: NOW,
    });
    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/search.*no data/);
  });

  it("treats a thrown fetch as down rather than crashing the cron", async () => {
    const r = await checkTequila({
      apiKey: "k",
      fetchImpl: asFetch(async () => {
        throw new Error("connection reset");
      }),
      now: NOW,
    });
    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/connection reset/);
  });

  it("says so when the key is missing, without calling out", async () => {
    const fetchImpl = vi.fn();
    const r = await checkTequila({ apiKey: "", fetchImpl: asFetch(fetchImpl), now: NOW });
    expect(r.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  // Tequila takes dd/mm/yyyy; sending ISO gets a 422 and a canary that cries
  // outage on a healthy API.
  it("asks Tequila in the date format Tequila takes", async () => {
    const fetchImpl = vi.fn<(url: string) => Promise<unknown>>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ locations: [], data: [] }),
    });
    await checkTequila({ apiKey: "k", fetchImpl: asFetch(fetchImpl), now: NOW });
    const url = String(fetchImpl.mock.calls[1][0]);
    expect(url).toMatch(/date_from=19%2F10%2F2026/);
    expect(url).toMatch(/date_to=19%2F11%2F2026/);
  });
});

describe("the alert mail itself", () => {
  // Cloudflare rejects a message with no Message-ID, which would turn the
  // alert into a silent throw inside the cron — the monitor failing closed.
  it("carries the headers Cloudflare requires", () => {
    const raw = buildAlertEmail({
      from: "canary@weekend.flights",
      to: "someone@example.com",
      subject: "Tequila search is failing",
      body: "detail",
      id: "abc",
    });
    expect(raw).toMatch(/^From: .*<canary@weekend\.flights>\r\n/);
    expect(raw).toMatch(/\r\nMessage-ID: <abc@weekend\.flights>\r\n/);
    expect(raw).toMatch(/\r\nMIME-Version: 1\.0\r\n/);
    expect(raw).toMatch(/\r\n\r\ndetail$/);
  });
});
