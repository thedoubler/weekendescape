import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AirportInput } from "@/components/AirportInput";

describe("AirportInput", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("suggests airports as you type and searches the chosen one", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        airports: [
          { code: "BCN", name: "Barcelona El Prat", city: "Barcelona", country: "Spain" },
        ],
      }),
    } as Response);
    const onSearch = vi.fn();

    render(<AirportInput value="" onSearch={onSearch} />);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "barce" },
    });

    const option = await screen.findByRole("option");
    expect(option).toHaveTextContent("BCN");
    expect(option).toHaveTextContent("Barcelona");
    expect(String((global.fetch as any).mock.calls[0][0])).toContain("term=barce");

    fireEvent.mouseDown(option);
    expect(onSearch).toHaveBeenCalledWith("BCN");
  });

  it("searches the typed code on Enter", () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ airports: [] }),
    } as Response);
    const onSearch = vi.fn();

    render(<AirportInput value="" onSearch={onSearch} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "mad" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSearch).toHaveBeenCalledWith("MAD");
  });
});
