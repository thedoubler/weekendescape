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

  it("marks Any pressed at the max and reports a cap on bucket click", () => {
    const onChange = vi.fn();
    render(
      <PriceFilter
        buckets={[60, 100, 150]}
        max={200}
        value={200}
        currency="EUR"
        onChange={onChange}
      />
    );
    expect(screen.getByRole("button", { name: /Any/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: /≤\s*100/ }));
    expect(onChange).toHaveBeenCalledWith(100);
  });
});
