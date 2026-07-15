import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MonthFilter } from "@/components/MonthFilter";

describe("MonthFilter", () => {
  it("renders nothing when there are no months", () => {
    const { container } = render(
      <MonthFilter months={[]} selected={[]} onToggle={() => {}} onClear={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("labels months and marks All pressed when nothing is selected", () => {
    render(
      <MonthFilter
        months={["2026-08", "2026-09"]}
        selected={[]}
        onToggle={() => {}}
        onClear={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: "Aug" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sep" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("toggles a month on click", () => {
    const onToggle = vi.fn();
    render(
      <MonthFilter
        months={["2026-08", "2026-09"]}
        selected={["2026-08"]}
        onToggle={onToggle}
        onClear={() => {}}
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
