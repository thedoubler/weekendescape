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

  it("hides the refine filters until the Refine button is clicked", async () => {
    grantGeolocation();
    vi.spyOn(global, "fetch").mockImplementation(mockFetch() as any);

    render(<Home />);
    await waitFor(() => expect(screen.getByText("Ibiza")).toBeInTheDocument());

    expect(screen.queryByRole("button", { name: "Aug" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /refine/i }));
    expect(screen.getByRole("button", { name: "Aug" })).toBeInTheDocument();
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

    // The short-stay filter now lives under Refine, as a labeled toggle.
    fireEvent.click(screen.getByRole("button", { name: /refine/i }));
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
  it("does not relabel results when the bridge toggle is tapped", async () => {
    grantGeolocation();
    vi.spyOn(global, "fetch").mockImplementation(mockFetch() as any);

    render(<Home />);
    await waitFor(() => expect(screen.getByText("Ibiza")).toBeInTheDocument());
    // The panel auto-collapses now that an airport is known.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    const heading = () =>
      screen.getByText(/^\d+ (.+ flights?|long weekends?)$/i);
    const before = heading().textContent;
    expect(before).toMatch(/flights?$/i);

    fireEvent.click(screen.getByRole("switch", { name: /bridge days/i }));

    expect(screen.getByRole("switch", { name: /bridge days/i })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    // The toggle is on, but no search has run — the heading must still describe
    // the results actually on screen.
    expect(heading().textContent).toBe(before);
    expect(screen.queryByText(/long weekends? in the next/i)).not.toBeInTheDocument();
  });

  // The panel's default is conditional, and both halves matter. Collapsing
  // unconditionally hid every setting behind an "Edit" a newcomer had no reason
  // to press; never collapsing left ~500px between the header and the first
  // result for someone who already has an airport.
  it("collapses to the summary once an airport is known, and reopens on Edit", async () => {
    grantGeolocation();
    vi.spyOn(global, "fetch").mockImplementation(mockFetch() as any);

    render(<Home />);
    await waitFor(() => expect(screen.getByText("Ibiza")).toBeInTheDocument());

    await waitFor(() =>
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    );
    // The caption is gone; the collapsed state is identified by its Edit
    // affordance and the tappable facets, not by a label.
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("keeps the form open when there is no airport to collapse to", async () => {
    // Nothing geolocated and nothing saved: collapsing here would hide the one
    // control the visitor actually needs.
    denyGeolocation();
    vi.spyOn(global, "fetch").mockImplementation(mockFetch() as any);

    render(<Home />);
    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());
    expect(
      screen.queryByRole("button", { name: /^edit$/i })
    ).not.toBeInTheDocument();
  });
});
