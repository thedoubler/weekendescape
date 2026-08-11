import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Home from "@/app/page";

const ibiza = {
  cityTo: "Ibiza",
  cityFrom: "Barcelona",
  countryTo: "Spain",
  flag: "🇪🇸",
  flyFrom: "BCN",
  flyTo: "IBZ",
  countryFrom: "Spain",
  segments: [],
  countryFromCode: "ES",
  countryToCode: "ES",
  outDepart: "2026-08-08T21:05:00.000Z",
  outArrive: "2026-08-08T22:10:00.000Z",
  backDepart: "2026-08-10T22:45:00.000Z",
  backArrive: "2026-08-10T23:45:00.000Z",
  stayMinutes: 2915,
  nights: 2,
  outStops: 0,
  backStops: 0,
  outLayovers: [],
  backLayovers: [],
  price: 37,
  currency: "EUR",
  deepLink: "https://kiwi.com/deep/ibiza",
};
const rome = {
  ...ibiza,
  cityTo: "Rome",
  countryTo: "Italy",
  flag: "🇮🇹",
  flyTo: "FCO",
  countryToCode: "IT",
  outDepart: "2026-09-05T07:00:00.000Z",
  outArrive: "2026-09-05T09:00:00.000Z",
  backDepart: "2026-09-06T20:00:00.000Z",
  backArrive: "2026-09-06T22:00:00.000Z",
  price: 25,
  deepLink: "https://kiwi.com/deep/rome",
};

function mockFetch() {
  return vi.fn(async (url: string) => {
    if (url.includes("/api/airports")) {
      return {
        ok: true,
        json: async () => ({ airports: [{ code: "BCN" }] }),
      } as Response;
    }
    return {
      ok: true,
      json: async () => ({ deals: [ibiza, rome] }),
    } as Response;
  });
}

function grantGeolocation(lat = 41.4, lon = 2.1) {
  Object.defineProperty(global.navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (success: (p: any) => void) =>
        success({ coords: { latitude: lat, longitude: lon } }),
    },
  });
}

function denyGeolocation() {
  Object.defineProperty(global.navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (_s: unknown, error: (e: any) => void) =>
        error({ code: 1 }),
    },
  });
}

describe("Home page", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    // The page now seeds from / writes to the URL; reset it so a search left in
    // window.location by one test doesn't seed the next (jsdom persists it).
    window.history.replaceState(null, "", "/");
  });

  it("auto-searches via geolocation on mount and renders deals", async () => {
    grantGeolocation();
    const fetchMock = mockFetch();
    vi.spyOn(global, "fetch").mockImplementation(fetchMock as any);

    render(<Home />);

    await waitFor(() => expect(screen.getByText("Ibiza")).toBeInTheDocument());
    const airportsCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("/api/airports")
    );
    const weekendsCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("/api/weekends")
    );
    expect(airportsCalls.length).toBe(1);
    expect(weekendsCalls.length).toBe(1);
    expect(String(weekendsCalls[0][0])).toContain("flyFrom=BCN");
  });

  it("re-sorts client-side without a new weekends fetch", async () => {
    grantGeolocation();
    const fetchMock = mockFetch();
    vi.spyOn(global, "fetch").mockImplementation(fetchMock as any);

    render(<Home />);
    await waitFor(() => expect(screen.getByText("Ibiza")).toBeInTheDocument());

    const before = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("/api/weekends")
    ).length;
    fireEvent.click(screen.getByRole("button", { name: /soonest/i }));
    const after = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("/api/weekends")
    ).length;
    expect(after).toBe(before);
  });

  it("falls back to the saved home airport when geolocation is denied", async () => {
    localStorage.setItem("weekendescape:home", "MAD");
    denyGeolocation();
    const fetchMock = mockFetch();
    vi.spyOn(global, "fetch").mockImplementation(fetchMock as any);

    render(<Home />);
    await waitFor(() => expect(screen.getByText("Ibiza")).toBeInTheDocument());
    const weekendsCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("/api/weekends")
    );
    expect(weekendsCalls.length).toBe(1);
    expect(String(weekendsCalls[0][0])).toContain("flyFrom=MAD");
  });

  it("focuses the input and does not search when geolocation is denied and no home is saved", async () => {
    denyGeolocation();
    const fetchMock = mockFetch();
    vi.spyOn(global, "fetch").mockImplementation(fetchMock as any);

    render(<Home />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText(/airport or city/i)).toHaveFocus()
    );
    const weekendsCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("/api/weekends")
    );
    expect(weekendsCalls.length).toBe(0);
  });

  it("shows the filters without anything having to be opened", async () => {
    // The Refine disclosure is gone. Filters are instant and free, and hiding
    // them behind a toggle cost 268px to open and pushed the first card off a
    // phone screen entirely.
    grantGeolocation();
    vi.spyOn(global, "fetch").mockImplementation(mockFetch() as any);

    render(<Home />);
    await waitFor(() => expect(screen.getByText("Ibiza")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: "Aug" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /refine/i })
    ).not.toBeInTheDocument();
  });

  it("hides short-layover trips by default and reveals them on demand", async () => {
    grantGeolocation();
    const doha = {
      ...rome,
      cityTo: "Doha",
      flyTo: "DOH",
      outStops: 1,
      backStops: 1,
      outLayovers: [{ at: "IST", minutes: 120 }],
      stayMinutes: 600, // under a day
      deepLink: "https://kiwi.com/deep/doha",
    };
    vi.spyOn(global, "fetch").mockImplementation((async (url: string) => {
      if (String(url).includes("/api/airports")) {
        return { ok: true, json: async () => ({ airports: [{ code: "BCN" }] }) } as Response;
      }
      return { ok: true, json: async () => ({ deals: [ibiza, doha] }) } as Response;
    }) as any);

    render(<Home />);
    await waitFor(() => expect(screen.getByText("Ibiza")).toBeInTheDocument());
    expect(screen.queryByText("Doha")).not.toBeInTheDocument();

    // No Refine to open — the toggle is simply on the page.
    fireEvent.click(
      screen.getByRole("checkbox", { name: /under a day at the destination/i })
    );
    expect(screen.getByText("Doha")).toBeInTheDocument();
  });

  // Second occurrence of this bug class: form state changing the LABELS on
  // results that were fetched with different parameters. The first was months /
  // stops / adults; this one relabelled 57 weekend results as "bridge escapes"
  // the instant the toggle was tapped, with no search run. Everything the
  // results header says must come from the `applied` snapshot.
  //
  // The toggle now commits on the spot, so the window in which the bug could
  // appear is the in-flight search. This holds the second fetch open and checks
  // the header never describes results that have not arrived.
  it("does not relabel results while the bridge search is still in flight", async () => {
    grantGeolocation();
    // Typed loosely on purpose: TS's control-flow analysis cannot see that
    // the fetch closure assigns this, and narrows it to `never` at the call.
    const releaseSecond: { fn?: () => void } = {};
    let weekendCalls = 0;
    vi.spyOn(global, "fetch").mockImplementation((async (url: string) => {
      if (String(url).includes("/api/airports")) {
        return { ok: true, json: async () => ({ airports: [{ code: "BCN" }] }) } as Response;
      }
      weekendCalls += 1;
      if (weekendCalls > 1) {
        await new Promise<void>((r) => {
          releaseSecond.fn = r;
        });
      }
      return { ok: true, json: async () => ({ deals: [ibiza, rome] }) } as Response;
    }) as any);

    render(<Home />);
    await waitFor(() => expect(screen.getByText("Ibiza")).toBeInTheDocument());
    expect(screen.getByText(/^\d+ flights?$/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch", { name: /long weekends/i }));

    expect(screen.getByRole("switch", { name: /long weekends/i })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    // The switch is on and a search is running, but nothing on screen may claim
    // to be a long weekend until the results that are actually long weekends
    // have replaced the ones that aren't.
    await waitFor(() => expect(screen.getByText("Searching…")).toBeInTheDocument());
    // Scoped to the results heading — the switch itself says "Long weekends"
    // and is legitimately on.
    expect(
      screen.queryByText(/^\d+ long weekends?$/i)
    ).not.toBeInTheDocument();
    releaseSecond.fn?.();
    await waitFor(() =>
      expect(screen.getByText(/^\d+ long weekends?$/i)).toBeInTheDocument()
    );
  });

  // The search is a line of prose now, not a panel: "Searching BCN · Fri–Sun ·
  // direct · 1 adult", every value editable in place. Nothing about it is
  // hidden behind a disclosure, but the airport field — which needs
  // autocomplete, chips and a location prompt — is a form, so it lives in a
  // sheet that only exists while you are editing it.
  it("states the whole search as an editable line, with no panel", async () => {
    grantGeolocation();
    vi.spyOn(global, "fetch").mockImplementation(mockFetch() as any);

    render(<Home />);
    await waitFor(() => expect(screen.getByText("Ibiza")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: /^BCN/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Fri–Sun/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^1 adult/ })).toBeInTheDocument();
    // No inline field, and no Edit button to reveal one.
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^edit$/i })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^BCN/ }));
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("runs one search per edit, not one per tap", async () => {
    // The commit bar is gone: a facet applies when its popover closes. That is
    // the whole reason the popover exists — tapping through 1→2→3→4 adults
    // must cost one upstream call, not three, and the call must carry the value
    // it was closed on rather than the one the refs held a tick earlier.
    grantGeolocation();
    const fetchMock = mockFetch();
    vi.spyOn(global, "fetch").mockImplementation(fetchMock as any);

    render(<Home />);
    await waitFor(() => expect(screen.getByText("Ibiza")).toBeInTheDocument());
    const weekends = () =>
      fetchMock.mock.calls.filter((c) => String(c[0]).includes("/api/weekends"));
    const before = weekends().length;

    fireEvent.click(screen.getByRole("button", { name: /^1 adult/ }));
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    fireEvent.click(screen.getByRole("button", { name: "3" }));
    fireEvent.click(screen.getByRole("button", { name: "4" }));
    // Still nothing: the popover is open, so the edit is not finished.
    expect(weekends().length).toBe(before);

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(weekends().length).toBe(before + 1));
    expect(String(weekends()[before][0])).toContain("adults=4");
  });

  it("shows the form when there is no airport yet", async () => {
    denyGeolocation();
    vi.spyOn(global, "fetch").mockImplementation(mockFetch() as any);

    render(<Home />);
    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());
    expect(
      screen.queryByRole("button", { name: /^edit$/i })
    ).not.toBeInTheDocument();
  });
});
