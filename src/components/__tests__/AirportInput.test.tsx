import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
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

  it("never searches a code the autocomplete has not confirmed", () => {
    // The XXX bug: any three letters used to fire a search as a trusted
    // IATA code. The airports table is server-only, so the client cannot
    // tell MAD from keyboard mash — the autocomplete is the validator, and
    // an unconfirmed code must stay in the field.
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ airports: [] }),
    } as Response);
    const onSearch = vi.fn();

    render(<AirportInput value="" onSearch={onSearch} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "xxx" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.change(input, { target: { value: "mad" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSearch).not.toHaveBeenCalled();
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

  it("commits a typed code once the autocomplete has confirmed it", async () => {
    // The fast-typist path survives, one beat later: the code fires as soon
    // as the suggestions contain it — confirmation, not blind trust.
    vi.useFakeTimers();
    vi.spyOn(global, "fetch").mockResolvedValue(vienna);
    const onSearch = vi.fn();

    render(<AirportInput value="" onSearch={onSearch} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "vie" } });
    // Let the debounced suggestions fetch land first (act: the resolution
    // sets React state)…
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    // …then committing resolves against the confirmed list.
    fireEvent.keyDown(input, { key: "Enter" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(onSearch).toHaveBeenCalledWith("VIE");
    vi.useRealTimers();
  });
});
