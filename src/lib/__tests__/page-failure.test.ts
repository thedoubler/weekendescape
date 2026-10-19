import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// notFound() throws a framework-private signal; all these tests need is to be
// able to tell that it was the thing that ran.
const NOT_FOUND = "NEXT_NOT_FOUND";
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error(NOT_FOUND);
  },
}));

import { upstreamFailed, noResults } from "@/lib/page-failure";

describe("upstreamFailed", () => {
  let spy: ReturnType<typeof vi.spyOn>;
  const phase = process.env.NEXT_PHASE;

  beforeEach(() => {
    spy = vi.spyOn(console, "error").mockImplementation(() => {});
    delete process.env.NEXT_PHASE;
  });
  afterEach(() => {
    spy.mockRestore();
    if (phase === undefined) delete process.env.NEXT_PHASE;
    else process.env.NEXT_PHASE = phase;
  });

  // The whole point. These pages are ISR, so notFound() does not just answer
  // one request with a 404 — it CACHES the 404 over a page that worked, for a
  // day, for Googlebot included. Rethrowing leaves the last good render in
  // place and retries on the next request.
  it("rethrows at runtime rather than caching a 404 over a working page", () => {
    const boom = new Error("Tequila 503");
    expect(() => upstreamFailed("Origin page /from/CLJ", boom)).toThrow(boom);
  });

  // The belt that the original notFound() existed for: a throw during
  // prerender escapes as "Export encountered an error" and takes the whole
  // deploy down. A bad page is survivable; no site is not.
  it("still refuses to throw during a production build", () => {
    process.env.NEXT_PHASE = "phase-production-build";
    expect(() => upstreamFailed("Origin page /from/CLJ", new Error("x"))).toThrow(
      NOT_FOUND
    );
  });

  // The one upstream failure that IS a missing page: Tequila answering 422
  // means it cannot route that airport at all, which is what a crawler
  // walking /from/ZZZ gets. Caught on a live server — before this, every
  // garbage three-letter URL became a 500 for Next to retry forever.
  it("404s on a 422, because that airport genuinely does not exist", () => {
    expect(() =>
      upstreamFailed("Origin page /from/ZZZ", { response: { status: 422 } }, {
        missingOn422: true,
      })
    ).toThrow(NOT_FOUND);
  });

  it("rethrows a 429, because the airport is fine and we are not", () => {
    expect(() =>
      upstreamFailed("Origin page /from/CLJ", { response: { status: 429 } }, {
        missingOn422: true,
      })
    ).not.toThrow(NOT_FOUND);
  });

  // A curated destination slug is validated before any search runs, so a 422
  // there is about one of its dozen origins — never about whether Rome
  // exists. Letting it 404 would cache "Rome is gone" over a working page.
  it("does not 404 a curated page on a 422", () => {
    expect(() =>
      upstreamFailed("Destination page /weekends-in/rome", {
        response: { status: 422 },
      })
    ).not.toThrow(NOT_FOUND);
  });

  it("wraps a non-Error so something with a stack reaches the logs", () => {
    expect(() => upstreamFailed("Origin page /from/CLJ", "just a string")).toThrow(
      /just a string/
    );
  });

  // These pages render on a schedule with nobody watching, so the log line is
  // the only way an outage here is ever noticed.
  it("logs which page failed and why", () => {
    try {
      upstreamFailed("Origin page /from/CLJ", { message: "timeout", code: "ECONNABORTED" });
    } catch {
      // expected
    }
    const line = String(spy.mock.calls[0]?.[0]);
    expect(line).toMatch(/Origin page \/from\/CLJ/);
    expect(line).toMatch(/ECONNABORTED/);
  });
});

describe("noResults", () => {
  let spy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    spy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    spy.mockRestore();
  });

  // A successful search with nothing in it stays a 404 — a curated page with
  // no fares is thin — but it is loud, because on a dozen origin metros zero
  // is more often a quota wall answering 200 than the truth about the weekend.
  it("404s, but not quietly", () => {
    expect(() => noResults("Destination page /weekends-in/rome", "to=ROM")).toThrow(
      NOT_FOUND
    );
    expect(String(spy.mock.calls[0]?.[0])).toMatch(/0 deals.*to=ROM/);
  });
});
