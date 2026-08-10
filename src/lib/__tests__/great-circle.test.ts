import { describe, it, expect } from "vitest";
import { greatCircle, angularDistance } from "@/lib/great-circle";

// [lon, lat]
const BCN: [number, number] = [2.078, 41.297];
const LTN: [number, number] = [-0.368, 51.875];
const NYC: [number, number] = [-73.78, 40.64];
const TOKYO: [number, number] = [139.78, 35.55];

const EARTH_KM = 6371;
const km = (a: [number, number], b: [number, number]) =>
  angularDistance(a, b) * EARTH_KM;

describe("angularDistance", () => {
  it("matches known route distances", () => {
    // BCN→London ≈ 1,150 km; BCN→JFK ≈ 6,150 km.
    expect(km(BCN, LTN)).toBeGreaterThan(1050);
    expect(km(BCN, LTN)).toBeLessThan(1250);
    expect(km(BCN, NYC)).toBeGreaterThan(5900);
    expect(km(BCN, NYC)).toBeLessThan(6400);
  });

  it("is zero for identical points", () => {
    expect(km(BCN, BCN)).toBeCloseTo(0, 6);
  });
});

describe("greatCircle", () => {
  it("starts and ends exactly on the endpoints", () => {
    const path = greatCircle(BCN, LTN, 24);
    expect(path[0][0]).toBeCloseTo(BCN[0], 4);
    expect(path[0][1]).toBeCloseTo(BCN[1], 4);
    expect(path[path.length - 1][0]).toBeCloseTo(LTN[0], 4);
    expect(path[path.length - 1][1]).toBeCloseTo(LTN[1], 4);
  });

  it("returns steps + 1 points", () => {
    expect(greatCircle(BCN, NYC, 32)).toHaveLength(33);
  });

  it("bows away from the straight lon/lat line", () => {
    // The whole point of the arc: on a long route the great circle is
    // noticeably north of naive linear interpolation. If this ever fails the
    // arcs have silently degraded into ruler lines.
    const path = greatCircle(BCN, NYC, 32);
    const mid = path[16];
    const naiveLat = (BCN[1] + NYC[1]) / 2;
    expect(mid[1]).toBeGreaterThan(naiveLat + 1);
  });

  it("stays continuous across the antimeridian", () => {
    // BCN→Tokyo runs east over Asia. Longitudes must advance smoothly rather
    // than jumping ±360, which would draw a line straight back across the map.
    const path = greatCircle(BCN, TOKYO, 48);
    for (let i = 1; i < path.length; i++) {
      expect(Math.abs(path[i][0] - path[i - 1][0])).toBeLessThan(180);
    }
  });

  it("degrades safely when both ends are the same airport", () => {
    // sin(d) would be 0 here — the slerp must not produce NaN.
    const path = greatCircle(BCN, BCN, 16);
    expect(path.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(
      true
    );
  });

  it("produces finite coordinates for antipodal-ish points", () => {
    const path = greatCircle([0, 0], [179.9, 0.1], 24);
    expect(path.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(
      true
    );
  });
});
