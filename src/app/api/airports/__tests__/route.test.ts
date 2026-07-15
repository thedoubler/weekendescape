import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import axios from "axios";
import { GET } from "@/app/api/airports/route";

vi.mock("axios");

function req(qs: string) {
  return new NextRequest(`http://localhost/api/airports?${qs}`);
}

describe("GET /api/airports", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.TEQUILA_API_KEY = "test-key";
  });

  it("returns 400 when lat/lon are missing", async () => {
    const res = await GET(req("lat=41.4"));
    expect(res.status).toBe(400);
  });

  it("returns 500 when API key is missing", async () => {
    delete process.env.TEQUILA_API_KEY;
    const res = await GET(req("lat=41.4&lon=2.1"));
    expect(res.status).toBe(500);
  });

  it("maps Tequila radius results to airports (max 5)", async () => {
    (axios.get as any).mockResolvedValue({
      status: 200,
      data: {
        locations: [
          {
            code: "BCN",
            name: "Barcelona El Prat",
            city: { name: "Barcelona" },
            country: { name: "Spain" },
          },
          {
            code: "GRO",
            name: "Girona",
            city: { name: "Girona" },
            country: { name: "Spain" },
          },
        ],
      },
    });

    const res = await GET(req("lat=41.4&lon=2.1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.airports).toHaveLength(2);
    expect(body.airports[0]).toEqual({
      code: "BCN",
      name: "Barcelona El Prat",
      city: "Barcelona",
      country: "Spain",
    });

    const params = (axios.get as any).mock.calls[0][1].params;
    expect(params.lat).toBe("41.4");
    expect(params.lon).toBe("2.1");
    expect(params.location_types).toBe("airport");
  });

  it("searches by term via locations/query for autocomplete", async () => {
    (axios.get as any).mockResolvedValue({
      status: 200,
      data: {
        locations: [
          {
            code: "BCN",
            name: "Barcelona El Prat",
            city: { name: "Barcelona" },
            country: { name: "Spain" },
          },
        ],
      },
    });

    const res = await GET(req("term=barce"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.airports[0].code).toBe("BCN");

    const call = (axios.get as any).mock.calls[0];
    expect(call[0]).toContain("/locations/query");
    expect(call[1].params.term).toBe("barce");
  });

  it("returns 500 when Tequila call fails", async () => {
    (axios.get as any).mockRejectedValue(new Error("upstream down"));
    const res = await GET(req("lat=41.4&lon=2.1"));
    expect(res.status).toBe(500);
  });
});
