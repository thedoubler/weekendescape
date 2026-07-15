import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DayBlocks } from "@/components/DayBlocks";
import type { DayCell } from "@/lib/format";

const cells: DayCell[] = [
  { weekday: "Sat", day: 8, month: "Aug", isWeekend: true, role: "depart" },
  { weekday: "Sun", day: 9, month: "Aug", isWeekend: true, role: "middle" },
  { weekday: "Mon", day: 10, month: "Aug", isWeekend: false, role: "return" },
];

describe("DayBlocks", () => {
  it("renders a cell per day with weekday, day number, and the month", () => {
    render(<DayBlocks cells={cells} />);
    expect(screen.getByText("Sat")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("Aug")).toBeInTheDocument();
  });

  it("marks departure and return days", () => {
    render(<DayBlocks cells={cells} />);
    expect(screen.getByLabelText("Departure")).toBeInTheDocument();
    expect(screen.getByLabelText("Return")).toBeInTheDocument();
  });
});
