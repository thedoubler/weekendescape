import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Home from "@/app/page";

describe("Home page", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders the controls", () => {
    render(<Home />);
    expect(
      screen.getByPlaceholderText(/home airport/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
  });

  it("searches and renders deals from the API", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        deals: [
          {
            cityTo: "Rome",
            countryTo: "Italy",
            flag: "🇮🇹",
            dateOut: "2026-09-05",
            dateBack: "2026-09-06",
            nights: 1,
            price: 55,
            currency: "EUR",
            deepLink: "https://kiwi.com/deep/rome",
          },
        ],
      }),
    } as Response);

    render(<Home />);
    fireEvent.change(screen.getByPlaceholderText(/home airport/i), {
      target: { value: "BCN" },
    });
    fireEvent.click(screen.getByRole("button", { name: /search/i }));

    await waitFor(() =>
      expect(screen.getByText("Rome")).toBeInTheDocument()
    );
    expect((global.fetch as any).mock.calls[0][0]).toContain("flyFrom=BCN");
  });
});
