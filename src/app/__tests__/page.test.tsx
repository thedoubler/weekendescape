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

// The boot flow reads the Permissions API before it will touch geolocation
// (the soft-ask rule: page load never summons the browser dialog), so the
// mocks set BOTH: the permission state and the geolocation behaviour behind
// it.
function mockPermissionState(state: "granted" | "denied" | "prompt") {
  Object.defineProperty(global.navigator, "permissions", {
    configurable: true,
    value: { query: async () => ({ state }) },
  });
}

function grantGeolocation(lat = 41.4, lon = 2.1) {
  mockPermissionState("granted");
  Object.defineProperty(global.navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (success: (p: any) => void) =>
        success({ coords: { latitude: lat, longitude: lon } }),
    },
  });
}

function denyGeolocation() {
  mockPermissionState("denied");
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

  it("soft-asks on undecided permission: sheet opens, the dialog is never summoned", async () => {
    // The heart of the soft-ask rule: permission state "prompt" + nothing
    // saved must open the origin sheet WITHOUT calling getCurrentPosition —
    // the browser dialog stays behind the "Find my airport" tap.
    mockPermissionState("prompt");
    const getPos = vi.fn();
    Object.defineProperty(global.navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: getPos },
    });
    const fetchMock = mockFetch();
    vi.spyOn(global, "fetch").mockImplementation(fetchMock as any);

    render(<Home />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText(/airport or city/i)).toBeInTheDocument()
    );
    expect(getPos).not.toHaveBeenCalled();
    expect(
      fetchMock.mock.calls.filter((c) => String(c[0]).includes("/api/"))
    ).toHaveLength(0);
  });

  it("never prompts a returning visitor: a saved home wins before any permission check", async () => {
    localStorage.setItem("weekendescape:home", "MAD");
    mockPermissionState("prompt");
    const getPos = vi.fn();
    Object.defineProperty(global.navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: getPos },
    });
    const fetchMock = mockFetch();
    vi.spyOn(global, "fetch").mockImplementation(fetchMock as any);

    render(<Home />);
    await waitFor(() => expect(screen.getByText("Ibiza")).toBeInTheDocument());
    expect(getPos).not.toHaveBeenCalled();
    const weekendsCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("/api/weekends")
    );
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

  // The disclosure question, settled twice in opposite directions, so the test
  // records where it landed. "Refine" hid three rows behind ONE word and drew
  // "options are disappearing"; three permanent rows answered that and cost
  // 135px, putting the first card at y=510 on a 723px phone. What ships is
  // three doors, each stating what its filter is currently set to, and the row
  // costs the same at three months or seven.
  it("states each facet's current setting without anything being opened", async () => {
    grantGeolocation();
    vi.spyOn(global, "fetch").mockImplementation(mockFetch() as any);

    render(<Home />);
    await waitFor(() => expect(screen.getByText("Ibiza")).toBeInTheDocument());

    // "Month", not "Month 6": the option count read as a date on a board where
    // every other number is one. Only Month is asserted — the two-deal fixture
    // yields no price buckets, so that trigger correctly does not render.
    expect(
      screen.getByRole("button", { name: "Month. Change" })
    ).toBeInTheDocument();
    // Closed, so the values themselves are not on the page yet.
    expect(screen.queryByRole("button", { name: "Aug" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /refine/i })
    ).not.toBeInTheDocument();

    // ...and one tap brings them back, in place.
    fireEvent.click(
      screen.getByRole("button", { name: "Month. Change" })
    );
    expect(screen.getByRole("button", { name: "Aug" })).toBeInTheDocument();
  });

  // Kayak's rule, and the reason hiding the chips is survivable: a set facet
  // stops naming the field and shows the value, so a filtered board says what
  // it is filtered to with nothing open.
  it("shows the chosen value on the trigger once a facet is set", async () => {
    grantGeolocation();
    vi.spyOn(global, "fetch").mockImplementation(mockFetch() as any);

    render(<Home />);
    await waitFor(() => expect(screen.getByText("Ibiza")).toBeInTheDocument());

    fireEvent.click(
      screen.getByRole("button", { name: "Month. Change" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Aug" }));

    expect(
      screen.getByRole("button", { name: "Month: Aug. Change" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Month. Change" })
    ).not.toBeInTheDocument();
  });

  // REGRESSION. Facet counts used to be computed over the whole board, ignoring
  // the other facets. Observed on the live app: with Sep selected the Region row
  // still read "Europe 13 · Africa 1 · Asia 1" while the list showed 2 of 15,
  // and tapping "Asia 1" produced "0 of 15 flights" — the count promised a
  // result the month filter had already excluded.
  it("counts a facet against the OTHER active facets, and disables dead options", async () => {
    grantGeolocation();
    // Tokyo is the only non-European deal and it is the only one in September.
    const tokyo = {
      ...rome,
      cityTo: "Tokyo",
      flyTo: "HND",
      countryTo: "Japan",
      countryToCode: "JP",
      deepLink: "https://kiwi.com/deep/tokyo",
    };
    vi.spyOn(global, "fetch").mockImplementation((async (url: string) => {
      if (String(url).includes("/api/airports")) {
        return { ok: true, json: async () => ({ airports: [{ code: "BCN" }] }) } as Response;
      }
      return { ok: true, json: async () => ({ deals: [ibiza, tokyo] }) } as Response;
    }) as unknown as typeof fetch);

    render(<Home />);
    await waitFor(() => expect(screen.getByText("Ibiza")).toBeInTheDocument());

    // Unfiltered, Asia really does hold a deal and is selectable.
    fireEvent.click(screen.getByRole("button", { name: "Region. Change" }));
    expect(screen.getByRole("button", { name: "Asia" })).toBeEnabled();

    // Narrow to August, which holds only Ibiza — a European deal.
    fireEvent.click(screen.getByRole("button", { name: "Month. Change" }));
    fireEvent.click(screen.getByRole("button", { name: "Aug" }));

    // Asia yields nothing against that choice, so it must not be clickable.
    // The count itself is never rendered (house rule) — the disabled state is
    // the whole of what the user sees, so it is what this pins.
    fireEvent.click(screen.getByRole("button", { name: "Region. Change" }));
    expect(screen.getByRole("button", { name: "Asia" })).toBeDisabled();
    // Europe still holds the one August deal, so it stays live.
    expect(screen.getByRole("button", { name: "Europe" })).toBeEnabled();
  });

  // The rule used to be a default with a checkbox to override it; the override
  // was removed on request — a trip with under a day at the destination is not
  // shown, full stop — so the test now pins both the hiding and the absence of
  // any control to reveal it.
  it("never shows short-layover trips, and offers no toggle to reveal them", async () => {
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
    }) as unknown as typeof fetch);

    render(<Home />);
    await waitFor(() => expect(screen.getByText("Ibiza")).toBeInTheDocument());
    expect(screen.queryByText("Doha")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: /under a day at the destination/i })
    ).not.toBeInTheDocument();
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

    // Long weekends is a choice inside the trip-length facet now, not a switch
    // of its own — it answers the same question as Fri–Sun rather than running
    // alongside it. Like every facet, it commits when the popover closes.
    fireEvent.click(screen.getByRole("button", { name: /^Fri–Sun/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Long weekends/ }));
    fireEvent.mouseDown(document.body);

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

  // The search is a line of prose now, not a panel: "From Barcelona ·
  // Fri–Sun · direct · 1 adult", every value editable in place. The origin
  // reads as the CITY, taken from the deals' server-resolved cityFrom, because
  // codes are an aviation dialect. Nothing about it is
  // hidden behind a disclosure, but the airport field — which needs
  // autocomplete, chips and a location prompt — is a form, so it lives in a
  // sheet that only exists while you are editing it.
  it("states the whole search as an editable line, with no panel", async () => {
    grantGeolocation();
    vi.spyOn(global, "fetch").mockImplementation(mockFetch() as any);

    render(<Home />);
    await waitFor(() => expect(screen.getByText("Ibiza")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: /^Barcelona/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Fri–Sun/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^1 adult/ })).toBeInTheDocument();
    // No inline field, and no Edit button to reveal one.
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^edit$/i })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Barcelona/ }));
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

    fireEvent.mouseDown(document.body);
    await waitFor(() => expect(weekends().length).toBe(before + 1));
    expect(String(weekends()[before][0])).toContain("adults=4");
  });

  it("Escape abandons a receipt edit instead of searching for it", async () => {
    // Dismissal is the commit, but Escape is not a dismissal — everywhere else
    // on the web it means "undo what I just did". It used to run the commit
    // path, so backing out of "4 adults" fired the search for four adults and
    // reloaded the board with the change the user had just cancelled.
    grantGeolocation();
    const fetchMock = mockFetch();
    vi.spyOn(global, "fetch").mockImplementation(fetchMock as any);

    render(<Home />);
    await waitFor(() => expect(screen.getByText("Ibiza")).toBeInTheDocument());
    const weekends = () =>
      fetchMock.mock.calls.filter((c) => String(c[0]).includes("/api/weekends"));
    const before = weekends().length;

    fireEvent.click(screen.getByRole("button", { name: /^1 adult/ }));
    fireEvent.click(screen.getByRole("button", { name: "4" }));
    fireEvent.keyDown(document, { key: "Escape" });

    // No search, and the label is back to what it was — a cancelled edit must
    // leave no trace, not just skip the fetch.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^1 adult/ })).toBeInTheDocument()
    );
    expect(weekends().length).toBe(before);
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
