import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PriceFilter } from "@/components/PriceFilter";
import { priceBuckets } from "@/lib/price";

describe("priceBuckets", () => {
  it("returns nothing without enough prices or range", () => {
    expect(priceBuckets([50])).toEqual([]);
    expect(priceBuckets([50, 50, 50, 50])).toEqual([]);
  });

  it("returns ascending thresholds strictly inside the range", () => {
    const prices = [30, 40, 55, 60, 80, 95, 120, 160, 240, 900];
    const b = priceBuckets(prices);
    expect(b.length).toBeGreaterThanOrEqual(2);
    expect(b[0]).toBeGreaterThan(30);
    expect(b[b.length - 1]).toBeLessThan(900);
    for (let i = 1; i < b.length; i++) expect(b[i]).toBeGreaterThan(b[i - 1]);
  });

  it("concentrates thresholds in the low band, not linearly across a wide max", () => {
    // Most deals cheap, one long-haul outlier: buckets should stay well under max.
    const prices = [40, 45, 50, 60, 70, 85, 100, 130, 180, 2700];
    const b = priceBuckets(prices);
    expect(Math.max(...b)).toBeLessThan(500);
  });
});

describe("PriceFilter", () => {
  it("renders nothing when there are no buckets", () => {
    const { container } = render(
      <PriceFilter buckets={[]} max={200} value={200} currency="EUR" onChange={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  // At the max there is no cap, so there is nothing to reset — and "Any",
  // rendered always, was a filled black chip advertising the absence of a
  // filter. It appears only once a cap is actually set.
  it("offers no reset until a cap is set, and reports a cap on bucket click", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <PriceFilter
        buckets={[60, 100, 150]}
        max={200}
        value={200}
        currency="EUR"
        onChange={onChange}
      />
    );
    expect(screen.queryByRole("button", { name: /Any/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /up to 100 EUR/i }));
    expect(onChange).toHaveBeenCalledWith(100);

    rerender(
      <PriceFilter
        buckets={[60, 100, 150]}
        max={200}
        value={100}
        currency="EUR"
        onChange={onChange}
      />
    );
    // Now the reset exists, and clearing goes back to the max rather than to a
    // bucket — a cap of `max` is what "no cap" means everywhere else.
    fireEvent.click(screen.getByRole("button", { name: /Any/i }));
    expect(onChange).toHaveBeenLastCalledWith(200);
  });
});
