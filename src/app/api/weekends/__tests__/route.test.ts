import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import axios from "axios";
import { GET } from "@/app/api/weekends/route";

vi.mock("axios");

function req(qs: string) {
  return new NextRequest(`http://localhost/api/weekends?${qs}`);
}

describe("GET /api/weekends", () => {
  beforeEach(() => {
    vi.resetAllMocks();
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

  it("calls Tequila with mapped params and returns normalized deals", async () => {
    (axios.get as any).mockResolvedValue({
      status: 200,
      data: {
        data: [
          {
            cityTo: "Rome",
            countryTo: { code: "IT", name: "Italy" },
            price: 55,
            deep_link: "https://kiwi.com/deep/rome",
            nightsInDest: 1,
            route: [
              { local_departure: "2026-09-05T07:30:00.000Z", return: 0 },
              { local_departure: "2026-09-06T21:00:00.000Z", return: 1 },
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
    expect(params.fly_days).toBe("6");
    expect(params.ret_fly_days).toBe("0");
    expect(params.nights_in_dst_from).toBe(1);
    expect(params.nights_in_dst_to).toBe(1);
    expect(params.one_for_city).toBe(1);
    expect(params.sort).toBe("price");
    expect(params.curr).toBe("EUR");
    expect(params.price_to).toBe(200);
  });

  it("returns 500 when Tequila call fails", async () => {
    (axios.get as any).mockRejectedValue(new Error("upstream down"));
    const res = await GET(req("flyFrom=BCN"));
    expect(res.status).toBe(500);
  });
});
