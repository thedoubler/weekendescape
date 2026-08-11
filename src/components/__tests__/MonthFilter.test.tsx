import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MonthFilter } from "@/components/MonthFilter";

describe("MonthFilter", () => {
  it("renders nothing when there are no months", () => {
    const { container } = render(
      <MonthFilter months={[]} selected={[]} onToggle={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  // An unfiltered row IS all months, so there is nothing for an "All" chip to
  // say — and as the only lit chip on a board with no filters applied, it put
  // the page's heaviest ink on the absence of a choice.
  it("renders one chip per month and no All chip", () => {
    render(
      <MonthFilter
        months={["2026-08", "2026-09"]}
        selected={[]}
        onToggle={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: "Aug" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sep" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "All" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
    // Nothing selected means nothing pressed.
    for (const b of screen.getAllByRole("button")) {
      expect(b).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("toggles a month on click", () => {
    const onToggle = vi.fn();
    render(
      <MonthFilter
        months={["2026-08", "2026-09"]}
        selected={["2026-08"]}
        onToggle={onToggle}
      />
    );
    expect(screen.getByRole("button", { name: "Aug" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: "Sep" }));
    expect(onToggle).toHaveBeenCalledWith("2026-09");
  });
});
