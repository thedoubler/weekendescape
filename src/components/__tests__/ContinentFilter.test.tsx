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
        onClear={() => {}}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("marks All continents pressed when nothing is selected", () => {
    render(
      <ContinentFilter
        continents={["Europe", "Asia"]}
        selected={[]}
        onToggle={() => {}}
        onClear={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: "Europe" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("toggles a continent on click", () => {
    const onToggle = vi.fn();
    render(
      <ContinentFilter
        continents={["Europe", "Asia"]}
        selected={["Europe"]}
        onToggle={onToggle}
        onClear={() => {}}
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
