import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DealCard } from "@/components/DealCard";
import type { Deal } from "@/lib/deals";

const base: Deal = {
  cityTo: "Ibiza",
  countryTo: "Spain",
  flag: "🇪🇸",
  flyFrom: "BCN",
  flyTo: "IBZ",
  countryFromCode: "ES",
  countryToCode: "ES",
  outDepart: "2026-08-08T21:05:00.000Z",
  outArrive: "2026-08-08T22:10:00.000Z",
  backDepart: "2026-08-10T18:00:00.000Z",
  backArrive: "2026-08-10T19:35:00.000Z",
  stayMinutes: 2915,
  nights: 2,
  price: 37,
  currency: "EUR",
  deepLink: "https://kiwi.com/deep/ibiza",
};

describe("DealCard", () => {
  it("shows the origin chip, price, times and a booking link", () => {
    render(<DealCard deal={base} />);
    expect(screen.getByText("Ibiza")).toBeInTheDocument();
    expect(screen.getByText("BCN → IBZ")).toBeInTheDocument();
    expect(screen.getByText(/37/)).toBeInTheDocument();
    expect(screen.getByText("22:10")).toBeInTheDocument();
    expect(screen.getByText("18:00")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /book ibiza/i })
    ).toHaveAttribute("href", "https://kiwi.com/deep/ibiza");
  });

  it("expands to flight lines with airport codes", () => {
    render(<DealCard deal={base} />);
    expect(screen.queryByText(/outbound/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByText(/outbound/i)).toBeInTheDocument();
    expect(screen.getByText(/return/i)).toBeInTheDocument();
  });

  it("renders holiday badges when present", () => {
    const withHols: Deal = {
      ...base,
      ptoDays: 0,
      homeHoliday: { date: "2026-08-07", name: "Assumption" },
      destHoliday: { date: "2026-08-08", name: "Ferragosto" },
    };
    render(<DealCard deal={withHols} />);
    expect(screen.getByText(/no day off needed/i)).toBeInTheDocument();
    expect(screen.getByText(/Ferragosto/)).toBeInTheDocument();
  });
});
