import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DayBlocks } from "@/components/DayBlocks";
import type { DayCell } from "@/lib/format";

const cells: DayCell[] = [
  { weekday: "Sat", day: 8, isWeekend: true, role: "depart" },
  { weekday: "Sun", day: 9, isWeekend: true, role: "middle" },
  { weekday: "Mon", day: 10, isWeekend: false, role: "return" },
];

describe("DayBlocks", () => {
  it("renders a cell per day with weekday and day number", () => {
    render(<DayBlocks cells={cells} />);
    expect(screen.getByText("Sat")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("marks departure and return days", () => {
    render(<DayBlocks cells={cells} />);
    expect(screen.getByLabelText("Departure")).toBeInTheDocument();
    expect(screen.getByLabelText("Return")).toBeInTheDocument();
  });
});
