import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const TEQUILA_BASE_URL = "https://tequila-api.kiwi.com";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");

    if (!lat || !lon) {
      return NextResponse.json(
        { error: "Missing required parameters: lat, lon" },
        { status: 400 }
      );
    }

    const apiKey = process.env.TEQUILA_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Tequila API key not configured" },
        { status: 500 }
      );
    }

    const response = await axios.get(`${TEQUILA_BASE_URL}/locations/radius`, {
      headers: { apikey: apiKey },
      params: {
        lat,
        lon,
        radius: 250,
        locale: "en-US",
        location_types: "airport",
        limit: 5,
        active_only: true,
      },
    });

    const locations = Array.isArray(response.data?.locations)
      ? response.data.locations
      : [];
    const airports = locations.slice(0, 5).map((a: any) => ({
      code: a.code,
      name: a.name,
      city: a.city?.name ?? a.city_name ?? "",
      country: a.country?.name ?? a.country_name ?? "",
    }));

    return NextResponse.json({ airports });
  } catch (error) {
    console.error("Airport search error:", error);
    return NextResponse.json(
      { error: "Failed to search airports" },
      { status: 500 }
    );
  }
}
