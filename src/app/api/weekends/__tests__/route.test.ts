import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import axios from "axios";
import { GET } from "@/app/api/weekends/route";
import { clearApiCache } from "@/lib/api-cache";

vi.mock("axios");

vi.mock("@/lib/holidays", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/holidays")>();
  return {
    ...actual,
    fetchHolidays: vi.fn(async (cc: string) =>
      cc === "ES"
        ? [{ date: "2026-09-04", name: "Home Holiday" }]
        : [{ date: "2026-09-05", name: "Dest Holiday" }]
    ),
  };
});

function req(qs: string) {
  return new NextRequest(`http://localhost/api/weekends?${qs}`);
}

describe("GET /api/weekends", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // The route caches upstream responses at module scope; clear it so cases
    // with identical params don't reuse each other's mocked results.
    clearApiCache();
    process.env.TEQUILA_API_KEY = "test-key";
    process.env.WEEKEND_CURRENCY = "EUR";
  });

  it("returns 400 when flyFrom is missing", async () => {
    const res = await GET(req("style=frimon"));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid style", async () => {
    const res = await GET(req("flyFrom=BCN&style=nope"));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid months", async () => {
    const res = await GET(req("flyFrom=BCN&months=5"));
    expect(res.status).toBe(400);
  });

  it("returns 500 when API key is missing", async () => {
    delete process.env.TEQUILA_API_KEY;
    const res = await GET(req("flyFrom=BCN"));
    expect(res.status).toBe(500);
  });

  it("returns 400 on invalid maxPrice", async () => {
    const res = await GET(req("flyFrom=BCN&maxPrice=abc"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid maxPrice");
  });

  it("calls Tequila with mapped params and returns normalized deals", async () => {
    (axios.get as any).mockResolvedValue({
      status: 200,
      data: {
        data: [
          {
            cityTo: "Rome",
            flyFrom: "BCN",
            flyTo: "FCO",
            countryFrom: { code: "ES", name: "Spain" },
            countryTo: { code: "IT", name: "Italy" },
            price: 55,
            deep_link: "https://kiwi.com/deep/rome",
            nightsInDest: 1,
            route: [
              {
                local_departure: "2026-09-05T07:30:00.000Z",
                local_arrival: "2026-09-05T09:00:00.000Z",
                return: 0,
              },
              {
                local_departure: "2026-09-06T21:00:00.000Z",
                local_arrival: "2026-09-06T22:30:00.000Z",
                return: 1,
              },
            ],
          },
        ],
      },
    });

    const res = await GET(req("flyFrom=BCN&style=strict&months=3&maxPrice=200"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deals).toHaveLength(1);
    expect(body.deals[0].cityTo).toBe("Rome");

    const params = (axios.get as any).mock.calls[0][1].params;
    expect(params.fly_from).toBe("BCN");
    expect(params.flight_type).toBe("round");
    expect(params.fly_days).toBe("5");
    expect(params.ret_fly_days).toBe("0");
    expect(params.nights_in_dst_from).toBe(1);
    expect(params.nights_in_dst_to).toBe(2);
    expect(params.one_for_city).toBe(1);
    expect(params.adults).toBe(1); // defaults to a single traveller
    expect(params.sort).toBe("price");
    expect(params.curr).toBe("EUR");
    expect(params.price_to).toBe(200);
    expect(params.ret_from_diff_airport).toBe(false);
    expect(params.ret_to_diff_airport).toBe(false);
  });

  it("with flyTo, searches all options for that city and returns the cheapest", async () => {
    (axios.get as any).mockResolvedValue({
      status: 200,
      data: {
        data: [
          {
            cityTo: "Ibiza",
            flyFrom: "BCN",
            flyTo: "IBZ",
            countryFrom: { code: "ES", name: "Spain" },
            countryTo: { code: "ES", name: "Spain" },
            price: 41,
            deep_link: "https://kiwi.com/deep/ibiza-41",
            nightsInDest: 3,
            route: [
              { local_departure: "2026-08-14T21:00:00.000Z", local_arrival: "2026-08-14T22:05:00.000Z", return: 0 },
              { local_departure: "2026-08-17T23:35:00.000Z", local_arrival: "2026-08-18T00:40:00.000Z", return: 1 },
            ],
          },
          {
            cityTo: "Ibiza",
            flyFrom: "BCN",
            flyTo: "IBZ",
            countryFrom: { code: "ES", name: "Spain" },
            countryTo: { code: "ES", name: "Spain" },
            price: 36,
            deep_link: "https://kiwi.com/deep/ibiza-36",
            nightsInDest: 2,
            route: [
              { local_departure: "2026-08-01T21:05:00.000Z", local_arrival: "2026-08-01T22:10:00.000Z", return: 0 },
              { local_departure: "2026-08-03T23:35:00.000Z", local_arrival: "2026-08-04T00:40:00.000Z", return: 1 },
            ],
          },
        ],
      },
    });

    const res = await GET(req("flyFrom=BCN&flyTo=IBZ&style=frimon&months=3"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deals).toHaveLength(1);
    expect(body.deals[0].price).toBe(36);

    const params = (axios.get as any).mock.calls[0][1].params;
    expect(params.fly_to).toBe("IBZ");
    expect(params.one_for_city).toBe(0);
  });

  it("restricts to direct flights when direct=1", async () => {
    (axios.get as any).mockResolvedValue({ status: 200, data: { data: [] } });
    await GET(req("flyFrom=BCN&direct=1"));
    expect((axios.get as any).mock.calls[0][1].params.max_stopovers).toBe(0);
  });

  it("omits max_stopovers when not direct", async () => {
    (axios.get as any).mockResolvedValue({ status: 200, data: { data: [] } });
    await GET(req("flyFrom=BCN"));
    expect(
      "max_stopovers" in (axios.get as any).mock.calls[0][1].params
    ).toBe(false);
  });

  it("enriches deals with holiday info", async () => {
    (axios.get as any).mockResolvedValue({
      status: 200,
      data: {
        data: [
          {
            cityTo: "Rome",
            flyFrom: "BCN",
            flyTo: "FCO",
            countryFrom: { code: "ES", name: "Spain" },
            countryTo: { code: "IT", name: "Italy" },
            price: 55,
            deep_link: "https://kiwi.com/deep/rome",
            nightsInDest: 1,
            route: [
              { local_departure: "2026-09-04T07:30:00.000Z", local_arrival: "2026-09-04T09:00:00.000Z", return: 0 },
              { local_departure: "2026-09-06T21:00:00.000Z", local_arrival: "2026-09-06T22:30:00.000Z", return: 1 },
            ],
          },
        ],
      },
    });

    // Default (no bridge flag): destination holidays are always annotated, but
    // home-holiday / PTO fields stay off (that's opt-in bridge mode).
    const plain = await GET(req("flyFrom=BCN&style=frimon&months=3"));
    expect(plain.status).toBe(200);
    const plainBody = await plain.json();
    expect(plainBody.deals[0].destHoliday).toEqual({ date: "2026-09-05", name: "Dest Holiday" });
    expect(plainBody.deals[0].homeHoliday).toBeUndefined();
    expect(plainBody.deals[0].ptoDays).toBeUndefined();

    // Bridge mode: the home (ES) holiday lands on the Friday workday (0 days off),
    // and the distinct destination (IT) holiday on Sat 09-05 is detected in-span —
    // proving home vs. dest calendars aren't swapped.
    const res = await GET(req("flyFrom=BCN&style=frimon&months=3&bridges=1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deals[0].ptoDays).toBe(0);
    expect(body.deals[0].homeHoliday).toEqual({ date: "2026-09-04", name: "Home Holiday" });
    expect(body.deals[0].destHoliday).toEqual({ date: "2026-09-05", name: "Dest Holiday" });
  });

  it("returns 500 when Tequila call fails", async () => {
    (axios.get as any).mockRejectedValue(new Error("upstream down"));
    const res = await GET(req("flyFrom=BCN"));
    expect(res.status).toBe(500);
  });

  it("maps a Tequila 422 to an actionable 422", async () => {
    (axios.isAxiosError as any) = vi.fn(() => true);
    (axios.get as any).mockRejectedValue({ response: { status: 422 } });
    const res = await GET(req("flyFrom=ZZZ"));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/ZZZ/);
  });

  it("caches identical searches, hitting Tequila once", async () => {
    (axios.get as any).mockResolvedValue({ status: 200, data: { data: [] } });
    await GET(req("flyFrom=BCN&style=loose&months=2"));
    await GET(req("flyFrom=BCN&style=loose&months=2"));
    expect((axios.get as any).mock.calls).toHaveLength(1);
  });
});
