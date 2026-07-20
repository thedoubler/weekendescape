import { describe, it, expect } from "vitest";
import {
  airportCoords,
  pickMode,
  codeInfo,
  targetDayKeys,
  climatologyRange,
  summarizeForecast,
  summarizeTypical,
} from "@/lib/weather";

describe("airportCoords", () => {
  it("resolves a known IATA code (case-insensitive)", () => {
    const opo = airportCoords("opo");
    expect(opo).not.toBeNull();
    expect(opo![0]).toBeCloseTo(41.248, 1);
    expect(opo![1]).toBeCloseTo(-8.681, 1);
  });

  it("returns null for unknown or empty codes", () => {
    expect(airportCoords("ZZZ")).toBeNull();
    expect(airportCoords("")).toBeNull();
  });
});

describe("pickMode", () => {
  const today = new Date("2026-07-20T12:00:00Z");

  it("uses the forecast for near-term trips", () => {
    expect(pickMode("2026-07-25", today)).toBe("forecast");
    expect(pickMode("2026-08-03", today)).toBe("forecast"); // 14 days out
  });

  it("falls back to climatology beyond the horizon", () => {
    expect(pickMode("2026-08-04", today)).toBe("typical"); // 15 days out
    expect(pickMode("2026-09-20", today)).toBe("typical");
  });

  it("treats malformed input as typical", () => {
    expect(pickMode("not-a-date", today)).toBe("typical");
  });
});

describe("codeInfo", () => {
  it("maps WMO codes to buckets", () => {
    expect(codeInfo(0).label).toBe("Clear");
    expect(codeInfo(2).label).toBe("Partly cloudy");
    expect(codeInfo(3).label).toBe("Cloudy");
    expect(codeInfo(63).label).toBe("Rain");
    expect(codeInfo(75).label).toBe("Snow");
    expect(codeInfo(95).label).toBe("Storms");
  });
});

describe("targetDayKeys", () => {
  it("returns MM-DD keys across the trip window", () => {
    expect(targetDayKeys("2026-09-12", "2026-09-14")).toEqual([
      "09-12",
      "09-13",
      "09-14",
    ]);
  });

  it("rejects reversed or over-long ranges", () => {
    expect(targetDayKeys("2026-09-14", "2026-09-12")).toEqual([]);
    expect(targetDayKeys("2026-01-01", "2026-03-01")).toEqual([]);
  });
});

describe("climatologyRange", () => {
  it("spans the past N years for the same calendar window", () => {
    const r = climatologyRange("2026-09-12", "2026-09-14");
    expect(r).not.toBeNull();
    expect(r!.startDate).toBe("2021-09-12");
    expect(r!.endDate).toBe("2025-09-14");
    expect(r!.years).toBe(5);
    expect(r!.targetKeys).toEqual(["09-12", "09-13", "09-14"]);
  });
});

describe("summarizeForecast", () => {
  it("averages highs/lows and picks the most severe code", () => {
    const r = summarizeForecast({
      temperature_2m_max: [24, 26, 22],
      temperature_2m_min: [14, 16, 12],
      weathercode: [1, 61, 2],
      precipitation_probability_mean: [10, 60, 20],
    });
    expect(r).toEqual({
      mode: "forecast",
      highC: 24,
      lowC: 14,
      emoji: "🌧️",
      condition: "Rain",
      precipChance: 30,
    });
  });

  it("skips days with null temperatures", () => {
    const r = summarizeForecast({
      temperature_2m_max: [20, null],
      temperature_2m_min: [10, 8],
      weathercode: [0],
      precipitation_probability_mean: [],
    });
    expect(r!.highC).toBe(20);
    expect(r!.lowC).toBe(10);
    expect(r!.precipChance).toBeUndefined();
  });

  it("returns null with no usable data", () => {
    expect(
      summarizeForecast({ temperature_2m_max: [], temperature_2m_min: [] })
    ).toBeNull();
  });
});

describe("summarizeTypical", () => {
  const daily = {
    time: [
      "2023-09-12",
      "2023-09-13",
      "2023-09-20", // outside the window, ignored
      "2024-09-12",
      "2024-09-13",
    ],
    temperature_2m_max: [24, 26, 40, 22, 20],
    temperature_2m_min: [14, 16, 30, 12, 10],
    precipitation_sum: [0, 5, 0, 2, 0],
  };

  it("averages only rows inside the trip window and flags wetness", () => {
    const r = summarizeTypical(daily, ["09-12", "09-13"], 5);
    expect(r!.mode).toBe("typical");
    expect(r!.highC).toBe(23); // mean(24,26,22,20)=23
    expect(r!.lowC).toBe(13); // mean(14,16,12,10)=13
    expect(r!.years).toBe(5);
    // 2 of 4 sampled days wet -> 0.5 fraction -> "Often wet"
    expect(r!.condition).toBe("Often wet");
    expect(r!.emoji).toBe("🌧️");
  });

  it("labels a dry window as usually dry", () => {
    const r = summarizeTypical(
      {
        time: ["2023-06-01", "2024-06-01"],
        temperature_2m_max: [28, 30],
        temperature_2m_min: [18, 20],
        precipitation_sum: [0, 0],
      },
      ["06-01"],
      5
    );
    expect(r!.condition).toBe("Usually dry");
    expect(r!.emoji).toBe("☀️");
  });

  it("returns null when nothing matches the window", () => {
    expect(summarizeTypical(daily, ["12-25"], 5)).toBeNull();
  });
});
