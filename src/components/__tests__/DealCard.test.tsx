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
  outStops: 0,
  backStops: 0,
  outLayovers: [],
  backLayovers: [],
  price: 37,
  currency: "EUR",
  deepLink: "https://kiwi.com/deep/ibiza",
};

describe("DealCard", () => {
  it("shows the origin chip, price, times and a booking link", () => {
    render(<DealCard deal={base} />);
    expect(screen.getByText("Ibiza")).toBeInTheDocument();
    // Weekend dates anchor the card; the constant origin route is not repeated.
    expect(screen.getByText(/Sat 8 – Mon 10 Aug/)).toBeInTheDocument();
    expect(screen.queryByText("BCN → IBZ")).not.toBeInTheDocument();
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

  it("shows the time on the ground", () => {
    render(<DealCard deal={base} />);
    // arrive → return departure = 2915 min ≈ 2 days at the destination
    expect(screen.getByText(/2d on the ground/)).toBeInTheDocument();
  });

  it("labels a direct trip and shows layover detail on expand", () => {
    render(<DealCard deal={base} />);
    expect(screen.getByText("Direct")).toBeInTheDocument();

    const layover: Deal = {
      ...base,
      outStops: 1,
      backStops: 1,
      outLayovers: [{ at: "MAD", minutes: 185 }],
      backLayovers: [{ at: "MAD", minutes: 100 }],
    };
    render(<DealCard deal={layover} />);
    expect(screen.getByText("1 stop each way")).toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole("button", { expanded: false })[1]
    );
    // layover airport + duration appears on the outbound and return lines
    expect(screen.getByText(/MAD \(3h 5m\)/)).toBeInTheDocument();
    expect(screen.getByText(/MAD \(1h 40m\)/)).toBeInTheDocument();
  });

  it("renders the home-holiday pill and marks a destination holiday on its day", () => {
    const withHols: Deal = {
      ...base,
      ptoDays: 0,
      homeHoliday: { date: "2026-08-07", name: "Assumption" },
      destHoliday: { date: "2026-08-08", name: "Ferragosto" },
    };
    render(<DealCard deal={withHols} />);
    // Home holiday stays a prominent pill.
    expect(screen.getByText(/Assumption · Fri 7 Aug/)).toBeInTheDocument();
    expect(screen.getByText(/no day off needed/i)).toBeInTheDocument();
    // Destination holiday is a dot on its day (announced via the cell label),
    // not a redundant dated line.
    expect(
      screen.getByLabelText(/Sat 8,.*public holiday: Ferragosto/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Sat 8 Aug/i)).not.toBeInTheDocument();
    // The named note shows only in the expanded panel.
    expect(
      screen.queryByText(/Public holiday in Ibiza/i)
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /show details/i }));
    expect(
      screen.getByText(/Public holiday in Ibiza · Ferragosto/i)
    ).toBeInTheDocument();
  });
});
