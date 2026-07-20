import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DayBlocks } from "@/components/DayBlocks";
import type { DayCell } from "@/lib/format";

const cells: DayCell[] = [
  { weekday: "Sat", day: 8, month: "Aug", date: "2026-08-08", isWeekend: true, role: "arrive", fillStart: 0.35, fillEnd: 1 },
  { weekday: "Sun", day: 9, month: "Aug", date: "2026-08-09", isWeekend: true, role: "middle", fillStart: 0, fillEnd: 1 },
  { weekday: "Mon", day: 10, month: "Aug", date: "2026-08-10", isWeekend: false, role: "leave", fillStart: 0, fillEnd: 0.8 },
];

describe("DayBlocks", () => {
  it("renders the month, day cells, and arrival/departure times", () => {
    render(
      <DayBlocks
        cells={cells}
        arrival={{ time: "08:20", night: false, plusOne: false }}
        departure={{ time: "19:05", night: false }}
      />
    );
    expect(screen.getByText("Aug")).toBeInTheDocument();
    expect(screen.getByText("Sat")).toBeInTheDocument();
    expect(screen.getByText("08:20")).toBeInTheDocument();
    expect(screen.getByText("19:05")).toBeInTheDocument();
    expect(screen.getByText(/full day/i)).toBeInTheDocument();
  });

  it("announces a destination holiday on the matching day via aria-label", () => {
    render(
      <DayBlocks
        cells={cells}
        arrival={{ time: "08:20", night: false, plusOne: false }}
        departure={{ time: "19:05", night: false }}
        holiday={{ date: "2026-08-09", name: "Ferragosto" }}
      />
    );
    expect(
      screen.getByLabelText(/Sun 9,.*public holiday: Ferragosto/i)
    ).toBeInTheDocument();
    // Days without the holiday don't get the note.
    expect(
      screen.getByLabelText(/^Sat 8, \d+% of the day usable$/i)
    ).toBeInTheDocument();
  });

  it("marks a red-eye with +1 and night glyphs", () => {
    render(
      <DayBlocks
        cells={cells}
        arrival={{ time: "23:40", night: true, plusOne: true }}
        departure={{ time: "06:00", night: true }}
      />
    );
    expect(screen.getByText(/\+1/)).toBeInTheDocument();
    expect(screen.getAllByLabelText("Night flight")).toHaveLength(2);
  });
});
