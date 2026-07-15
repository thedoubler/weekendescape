import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CheapestWeekend } from "@/components/CheapestWeekend";

const cheaper = {
  cityTo: "Ibiza",
  countryTo: "Spain",
  flag: "🇪🇸",
  flyFrom: "BCN",
  flyTo: "IBZ",
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
  outVia: [],
  backVia: [],
  price: 36,
  currency: "EUR",
  deepLink: "https://kiwi.com/deep/ibiza-36",
};

describe("CheapestWeekend", () => {
  beforeEach(() => vi.restoreAllMocks());

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
        currentPrice={41}
        style="frimon"
        months={3}
      />
    );

    await waitFor(() =>
      expect(screen.getByText(/cheapest weekend/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/36 EUR/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /book cheapest ibiza/i })).toHaveAttribute(
      "href",
      "https://kiwi.com/deep/ibiza-36"
    );
    expect(String((global.fetch as any).mock.calls[0][0])).toContain("flyTo=IBZ");
  });

  it("confirms when the current card is already the cheapest", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ deals: [{ ...cheaper, price: 41 }] }),
    } as Response);

    render(
      <CheapestWeekend
        flyFrom="BCN"
        flyTo="IBZ"
        cityTo="Ibiza"
        currentPrice={41}
        style="frimon"
        months={3}
      />
    );

    await waitFor(() =>
      expect(
        screen.getByText(/this is the cheapest weekend for ibiza/i)
      ).toBeInTheDocument()
    );
  });
});
