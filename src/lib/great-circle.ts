// Great-circle interpolation for the map's route arcs.
//
// A straight line drawn on a Mercator map is not the path a plane flies — the
// shortest route between two points on a sphere bows toward the pole. Sampling
// the true great circle is what makes BCN→London curve the way an atlas draws
// it, rather than looking like a ruler line.

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

// Angular distance between two [lon, lat] points, in radians.
export function angularDistance(
  [lon1, lat1]: [number, number],
  [lon2, lat2]: [number, number]
): number {
  const φ1 = lat1 * DEG, φ2 = lat2 * DEG;
  const Δφ = (lat2 - lat1) * DEG, Δλ = (lon2 - lon1) * DEG;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Points along the great circle from `from` to `to`, inclusive of both ends.
// Longitudes are unwrapped so a path crossing the antimeridian keeps running in
// the same direction instead of snapping back across the whole map.
export function greatCircle(
  from: [number, number],
  to: [number, number],
  steps = 48
): [number, number][] {
  const d = angularDistance(from, to);
  // Coincident (or near-coincident) endpoints: slerp divides by sin(d) ≈ 0.
  if (!isFinite(d) || d < 1e-9) return [from, to];

  const [lon1, lat1] = from;
  const [lon2, lat2] = to;
  const φ1 = lat1 * DEG, λ1 = lon1 * DEG;
  const φ2 = lat2 * DEG, λ2 = lon2 * DEG;
  const sinD = Math.sin(d);

  const out: [number, number][] = [];
  let prevLon: number | null = null;
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / sinD;
    const B = Math.sin(f * d) / sinD;
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    const lat = Math.atan2(z, Math.hypot(x, y)) * RAD;
    let lon = Math.atan2(y, x) * RAD;
    // Keep the line continuous across ±180 by carrying it past the wrap point.
    if (prevLon !== null) {
      while (lon - prevLon > 180) lon -= 360;
      while (lon - prevLon < -180) lon += 360;
    }
    prevLon = lon;
    out.push([lon, lat]);
  }
  return out;
}
