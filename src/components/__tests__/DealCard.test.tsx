import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DealCard } from "@/components/DealCard";
import type { Deal } from "@/lib/deals";

const base: Deal = {
  cityTo: "Ibiza",
  cityFrom: "Barcelona",
  countryTo: "Spain",
  flag: "🇪🇸",
  flyFrom: "BCN",
  flyTo: "IBZ",
  countryFrom: "Spain",
  segments: [],
  countryFromCode: "ES",
  countryToCode: "ES",
  outDepart: "2026-08-08T21:05:00.000Z",
  outArrive: "2026-08-08T22:10:00.000Z",
  backDepart: "2026-08-10T18:00:00.000Z",
  backArrive: "2026-08-10T19:35:00.000Z",
  stayMinutes: 2915,
  nights: 2,
  outStops: 0,
  backStops: 0,
  outLayovers: [],
  backLayovers: [],
  price: 37,
  currency: "EUR",
  deepLink: "https://kiwi.com/deep/ibiza",
};

describe("DealCard", () => {
  // The header must print when you TRAVEL, not when you are at the
  // destination. It used to call weekendRange(outArrive, backDepart), which on
  // an overnight leg is a different day: the real Istanbul card read
  // "Sat 7 – Sun 8 Nov" for a flight leaving Cluj on Fri 6 Nov at 21:25, and
  // the digit 6 appeared nowhere on the collapsed card — so the board was
  // telling people to book the wrong day off. Measured on the live board at
  // the time: departure day wrong on 1/14 direct results, 17/69 with stops.
  it("dates the trip from departure, not from arrival at the destination", () => {
    const redEye: Deal = {
      ...base,
      cityTo: "Istanbul",
      flyTo: "IST",
      // Leaves Friday night, lands Saturday.
      outDepart: "2026-11-06T21:25:00.000Z",
      outArrive: "2026-11-07T00:10:00.000Z",
      // Flies back Sunday evening, lands after midnight on Monday.
      backDepart: "2026-11-08T22:15:00.000Z",
      backArrive: "2026-11-09T01:30:00.000Z",
    };
    const { container } = render(<DealCard deal={redEye} />);
    // The exact range is no longer the VISIBLE header — it is announced to
    // assistive tech instead, while the strip below carries the days visually.
    // What must never appear, in either place, is the arrival-day reading.
    const sr = container.querySelector(".sr-only");
    expect(sr?.textContent).toContain("Fri 6 – Mon 9 Nov");
    expect(container.textContent).not.toContain("Sat 7 – Sun 8 Nov");
  });


  it("shows the origin chip, price, times and a booking link", () => {
    render(<DealCard deal={base} />);
    expect(screen.getByText("Ibiza")).toBeInTheDocument();
    // Weekend dates anchor the card; the constant origin route is not repeated.
    expect(screen.getByText(/Sat 8 – Mon 10 Aug/)).toBeInTheDocument();
    expect(screen.queryByText("BCN → IBZ")).not.toBeInTheDocument();
    expect(screen.getByText(/37/)).toBeInTheDocument();
    expect(screen.getByText("22:10")).toBeInTheDocument();
    expect(screen.getByText("18:00")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /book ibiza/i })
    ).toHaveAttribute("href", "https://kiwi.com/deep/ibiza");
  });

  it("expands to flight lines with airport codes", () => {
    render(<DealCard deal={base} />);
    expect(screen.queryByText(/outbound/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /show details for/i }));
    expect(screen.getByText(/outbound/i)).toBeInTheDocument();
    expect(screen.getByText(/return/i)).toBeInTheDocument();
  });

  it("shows the time at the destination", () => {
    render(<DealCard deal={base} />);
    // arrive → return departure = 2915 min ≈ 2 days at the destination
    expect(screen.getByText(
        (_t, n) =>
          n?.tagName === "SPAN" && n.textContent?.trim() === "2d to explore"
      )).toBeInTheDocument();
  });

  it("labels a direct trip and shows layover detail on expand", () => {
    render(<DealCard deal={base} />);
    expect(screen.getByText("Direct")).toBeInTheDocument();

    const layover: Deal = {
      ...base,
      outStops: 1,
      backStops: 1,
      outLayovers: [{ at: "MAD", minutes: 185 }],
      backLayovers: [{ at: "MAD", minutes: 100 }],
    };
    render(<DealCard deal={layover} />);
    expect(screen.getByText("1 stop each way")).toBeInTheDocument();
    // Each card now has three controls that open it; target the explicit one
    // on the second card.
    fireEvent.click(screen.getAllByRole("button", { name: /show details for/i })[1]);
    // layover airport + duration appears on the outbound and return lines
    expect(screen.getByText(/1 stop, MAD \(3h 5m\)/)).toBeInTheDocument();
    expect(screen.getByText(/1 stop, MAD \(1h 40m\)/)).toBeInTheDocument();
  });

  it("names home holidays as yours and destination holidays as local", () => {
    const withHols: Deal = {
      ...base,
      ptoDays: 0,
      homeHoliday: { date: "2026-08-07", name: "Assumption" },
      homeHolidays: [
        { date: "2026-08-07", name: "Assumption" },
        { date: "2026-08-10", name: "National Day" },
      ],
      destHoliday: { date: "2026-08-08", name: "Ferragosto" },
    };
    render(<DealCard deal={withHols} />);
    // Home holidays (0 days off) → the amber bridge note: the claim and its
    // cost in leave on one line, the holidays that justify it on the next.
    // Asserts the FACTS (both holidays named, the date shown, "no day off"),
    // not the exact sentence, so wording can be tuned without a false failure.
    expect(screen.getByText(/Long weekend/i)).toBeInTheDocument();
    expect(screen.getByText(/no day off/i)).toBeInTheDocument();
    const note = screen.getByText(/Assumption/i);
    expect(note.textContent).toMatch(/National Day/i);
    expect(note.textContent).toMatch(/is a holiday/i);
    // Collapsed, the destination holiday is only the subtle day-cell pin,
    // announced via aria-label — no "Local holiday" text until expanded.
    expect(
      screen.getByLabelText(/Sat 8,.*local holiday in Ibiza: Ferragosto/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Local holiday/i)
    ).not.toBeInTheDocument();
    // The named destination-holiday line shows only in the expanded panel, and
    // frames the holiday as a caveat (shops may be shut) rather than a perk.
    fireEvent.click(screen.getByRole("button", { name: /show details for/i }));
    expect(screen.getByText(/a public holiday in Ibiza/i)).toBeInTheDocument();
    expect(screen.getByText(/opening hours may differ/i)).toBeInTheDocument();
    // The name is a link out to a search for the holiday, city and year — we
    // only know its name, so we hand the "is anything open?" question off.
    const link = screen.getByRole("link", { name: /Ferragosto in Ibiza/i });
    expect(link).toHaveAttribute("target", "_blank");
    const q = decodeURIComponent(
      new URL(link.getAttribute("href")!).searchParams.get("q") ?? ""
    );
    expect(q).toBe("Ferragosto Ibiza 8 August 2026");
  });
});

describe("DealCard — regional holidays", () => {
  // Regression guard. This hedge was added once and then silently dropped by a
  // later edit to the same block, because nothing tested it. Nager marks 22 of
  // 32 Spanish and 10 of 19 German entries `global:false`, so asserting one as
  // a holiday "in {city}" is false for most cities in that country.
  const withHoliday = (national: boolean | undefined): Deal => ({
    ...base,
    cityTo: "Zurich",
    countryTo: "Switzerland",
    destHoliday: { date: "2026-11-01", name: "All Saints' Day", national },
  });

  it("hedges a regional holiday to the country, not the city", () => {
    render(<DealCard deal={withHoliday(false)} />);
    fireEvent.click(screen.getByRole("button", { name: /show details for/i }));
    expect(
      screen.getByText(/a public holiday in parts of Switzerland/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/a public holiday in Zurich/i)).not.toBeInTheDocument();
  });

  it("names the city for a genuinely national holiday", () => {
    render(<DealCard deal={withHoliday(true)} />);
    fireEvent.click(screen.getAllByRole("button", { name: /show details for/i })[0]);
    expect(screen.getByText(/a public holiday in Zurich/i)).toBeInTheDocument();
  });
});

