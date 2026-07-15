import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DealCard } from "@/components/DealCard";
import type { Deal } from "@/lib/deals";

const deal: Deal = {
  cityTo: "Ibiza",
  countryTo: "Spain",
  flag: "🇪🇸",
  outDepart: "2026-08-08T21:05:00.000Z",
  outArrive: "2026-08-08T22:10:00.000Z",
  backDepart: "2026-08-10T22:45:00.000Z",
  backArrive: "2026-08-10T23:45:00.000Z",
  stayMinutes: 2915,
  nights: 2,
  price: 37,
  currency: "EUR",
  deepLink: "https://kiwi.com/deep/ibiza",
};

describe("DealCard", () => {
  it("renders city, price, times and a booking link when collapsed", () => {
    render(<DealCard deal={deal} />);
    expect(screen.getByText("Ibiza")).toBeInTheDocument();
    expect(screen.getByText(/37/)).toBeInTheDocument();
    expect(screen.getByText(/22:10/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /book ibiza/i });
    expect(link).toHaveAttribute("href", "https://kiwi.com/deep/ibiza");
  });

  it("hides the flight detail until expanded", () => {
    render(<DealCard deal={deal} />);
    expect(screen.queryByText(/outbound/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByText(/outbound/i)).toBeInTheDocument();
    expect(screen.getByText(/return/i)).toBeInTheDocument();
  });

  it("shows the stay duration once, even when expanded", () => {
    render(<DealCard deal={deal} />);
    expect(screen.getByText(/in Ibiza/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getAllByText(/in Ibiza/i)).toHaveLength(1);
  });
});
