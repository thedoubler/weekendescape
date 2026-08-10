import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import {
  CheapestWeekend,
  clearCheapestWeekendCache,
} from "@/components/CheapestWeekend";

// The trip shown on the card, for the all-in comparison.
const base = {
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
  backDepart: "2026-08-10T18:00:00.000Z",
  backArrive: "2026-08-10T19:35:00.000Z",
  stayMinutes: 2000,
  nights: 2,
  outStops: 0,
  backStops: 0,
  outLayovers: [],
  backLayovers: [],
  price: 60,
  currency: "EUR",
  deepLink: "https://kiwi.com/deep/ibiza-60",
};

const cheaper = {
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
  outDepart: "2026-08-01T21:05:00.000Z",
  outArrive: "2026-08-01T22:10:00.000Z",
  backDepart: "2026-08-03T18:00:00.000Z",
  backArrive: "2026-08-03T19:35:00.000Z",
  stayMinutes: 2000,
  nights: 2,
  outStops: 0,
  backStops: 0,
  outLayovers: [],
  backLayovers: [],
  price: 36,
  currency: "EUR",
  deepLink: "https://kiwi.com/deep/ibiza-36",
};

describe("CheapestWeekend", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearCheapestWeekendCache();
  });

  it("shows a cheaper weekend when one exists", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ deals: [cheaper] }),
    } as Response);

    render(
      <CheapestWeekend
        flyFrom="BCN"
        flyTo="IBZ"
        cityTo="Ibiza"
        current={{ ...base, price: 60 }}
        style="frimon"
        months={3}
        direct={false}
        adults={1}
      />
    );

    // 60 -> 36 clears both the 10-unit and 10% floors.
    await waitFor(() =>
      expect(screen.getByText(/36 EUR/)).toBeInTheDocument()
    );
    expect(screen.getByText(/24 EUR less/)).toBeInTheDocument();
    // The word "Book" belongs to the primary CTA, never to this card.
    expect(screen.queryByText(/^Book$/)).not.toBeInTheDocument();
    // Dates use the same range grammar as the rest of the card.
    expect(screen.getByText("Sat 1 – Mon 3 Aug")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /see the .* ibiza trip on kiwi/i })
    ).toHaveAttribute("href", "https://kiwi.com/deep/ibiza-36");
    expect(String((global.fetch as any).mock.calls[0][0])).toContain("flyTo=IBZ");
  });

  it("stays silent when the saving is too small to act on", async () => {
    // 60 -> 55 is under the 10% / 10-unit floors. A trivial delta dressed up
    // as a percentage next to a 60+ EUR bag fee oversells nothing.
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ deals: [{ ...cheaper, price: 55 }] }),
    } as Response);

    render(
      <CheapestWeekend
        flyFrom="BCN"
        flyTo="IBZ"
        cityTo="Ibiza"
        current={{ ...base, price: 60 }}
        style="frimon"
        months={3}
        direct={false}
        adults={1}
      />
    );

    // The slot still occupies its height so the Book CTA below never moves,
    // but it says nothing — we no longer claim "cheapest weekend for {city}"
    // off a single origin, style and window.
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText(/EUR/)).not.toBeInTheDocument();
  });
});
