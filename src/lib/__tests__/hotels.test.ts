import { describe, it, expect } from "vitest";
import { hotelUrl } from "@/lib/hotels";
import type { Deal } from "@/lib/deals";

const deal = {
  cityTo: "Barcelona",
  countryTo: "Spain",
  outArrive: "2026-09-19T22:10:00.000Z",
  backDepart: "2026-09-20T18:00:00.000Z",
} as Deal;

describe("hotelUrl", () => {
  it("deep-links a Booking.com search for the city and weekend dates", () => {
    const url = new URL(hotelUrl(deal));
    expect(url.hostname).toBe("www.booking.com");
    expect(url.pathname).toBe("/searchresults.html");
    expect(url.searchParams.get("ss")).toBe("Barcelona, Spain");
    expect(url.searchParams.get("checkin")).toBe("2026-09-19");
    expect(url.searchParams.get("checkout")).toBe("2026-09-20");
    expect(url.searchParams.get("group_adults")).toBe("1");
  });
});
