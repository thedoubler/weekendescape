import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DealCard } from "@/components/DealCard";
import type { Deal } from "@/lib/deals";

const deal: Deal = {
  cityTo: "Rome",
  countryTo: "Italy",
  flag: "🇮🇹",
  dateOut: "2026-09-05",
  dateBack: "2026-09-06",
  nights: 1,
  price: 55,
  currency: "EUR",
  deepLink: "https://kiwi.com/deep/rome",
};

describe("DealCard", () => {
  it("renders city, price and a booking link", () => {
    render(<DealCard deal={deal} />);
    expect(screen.getByText("Rome")).toBeInTheDocument();
    expect(screen.getByText(/55/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /book/i });
    expect(link).toHaveAttribute("href", "https://kiwi.com/deep/rome");
  });
});
