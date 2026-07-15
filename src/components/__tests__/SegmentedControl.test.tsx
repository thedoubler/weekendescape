import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SegmentedControl } from "@/components/SegmentedControl";

describe("SegmentedControl", () => {
  const options = [
    { value: "a", label: "Alpha" },
    { value: "b", label: "Beta" },
  ];

  it("marks the selected option as pressed", () => {
    render(
      <SegmentedControl
        options={options}
        value="b"
        onChange={() => {}}
        ariaLabel="Test"
      />
    );
    expect(screen.getByRole("button", { name: "Beta" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Alpha" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("calls onChange with the clicked value", () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        options={options}
        value="a"
        onChange={onChange}
        ariaLabel="Test"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Beta" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});
