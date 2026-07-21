import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DealList } from "@/components/DealList";

describe("DealList", () => {
  it("shows a loading state (skeleton placeholders)", () => {
    render(<DealList deals={[]} loading={true} error={null} />);
    expect(screen.getByLabelText(/searching/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/searching/i)).toHaveAttribute(
      "aria-busy",
      "true"
    );
  });

  it("shows an error", () => {
    render(<DealList deals={[]} loading={false} error="boom" />);
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("shows the empty state", () => {
    render(<DealList deals={[]} loading={false} error={null} />);
    expect(screen.getByText(/no weekend escapes found/i)).toBeInTheDocument();
  });

  it("shows a custom empty message when provided", () => {
    render(
      <DealList
        deals={[]}
        loading={false}
        error={null}
        emptyMessage="No deals in the selected months"
      />
    );
    expect(
      screen.getByText("No deals in the selected months")
    ).toBeInTheDocument();
  });
});
