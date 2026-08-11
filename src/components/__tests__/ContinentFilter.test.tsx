import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContinentFilter } from "@/components/ContinentFilter";

describe("ContinentFilter", () => {
  it("renders nothing when fewer than two continents are present", () => {
    const { container } = render(
      <ContinentFilter
        continents={["Europe"]}
        selected={[]}
        onToggle={() => {}}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  // See MonthFilter: no "All" chip, and nothing pressed when nothing is chosen.
  it("renders one chip per continent and no All chip", () => {
    render(
      <ContinentFilter
        continents={["Europe", "Asia"]}
        selected={[]}
        onToggle={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: "Europe" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "All" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("toggles a continent on click", () => {
    const onToggle = vi.fn();
    render(
      <ContinentFilter
        continents={["Europe", "Asia"]}
        selected={["Europe"]}
        onToggle={onToggle}
      />
    );
    expect(screen.getByRole("button", { name: "Europe" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: "Asia" }));
    expect(onToggle).toHaveBeenCalledWith("Asia");
  });
});
