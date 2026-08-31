import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  const vienna = {
    ok: true,
    json: async () => ({
      airports: [
        { code: "VIE", name: "Vienna International", city: "Vienna", country: "Austria" },
      ],
    }),
  } as Response;

  it("does not commit a guessed airport when focus simply leaves", async () => {
    // The bug this pins: typing a partial city name and pressing Escape closed
    // the sheet, and the blur behind it resolved "vien" to the top suggestion.
    // VIE went onto the board from a keystroke that means "abandon this", and
    // the receipt, the URL and the results then disagreed with each other.
    vi.useFakeTimers();
    vi.spyOn(global, "fetch").mockResolvedValue(vienna);
    const onSearch = vi.fn();

    render(<AirportInput value="" onSearch={onSearch} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "vien" } });
    await vi.advanceTimersByTimeAsync(300); // debounce + fetch
    fireEvent.keyDown(input, { key: "Escape" }); // dismisses the suggestion list
    fireEvent.keyDown(input, { key: "Escape" }); // now leaves the field
    fireEvent.blur(input);
    await vi.advanceTimersByTimeAsync(300); // past the blur commit window

    expect(onSearch).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("still commits an unambiguous code when focus leaves", async () => {
    // The other half of the rule: blur never GUESSES, but text that resolves
    // with no interpretation is not a guess, so tabbing away from a typed IATA
    // code keeps working.
    vi.useFakeTimers();
    vi.spyOn(global, "fetch").mockResolvedValue(vienna);
    const onSearch = vi.fn();

    render(<AirportInput value="" onSearch={onSearch} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "vie" } });
    fireEvent.blur(input);
    await vi.advanceTimersByTimeAsync(300);

    expect(onSearch).toHaveBeenCalledWith("VIE");
    vi.useRealTimers();
  });
});
