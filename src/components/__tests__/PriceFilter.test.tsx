import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PriceFilter } from "@/components/PriceFilter";

describe("PriceFilter", () => {
  it("renders nothing when there is no range", () => {
    const { container } = render(
      <PriceFilter min={50} max={50} value={50} currency="EUR" onChange={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the current cap and reports slider changes", () => {
    const onChange = vi.fn();
    render(
      <PriceFilter min={30} max={200} value={120} currency="EUR" onChange={onChange} />
    );
    expect(screen.getByText(/Under 120 EUR/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Maximum price"), {
      target: { value: "80" },
    });
    expect(onChange).toHaveBeenCalledWith(80);
  });
});
