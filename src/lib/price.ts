// Round to a human "nice" number, finer at the low end (where cheap flights
// cluster) and coarser as the price grows.
function roundNice(x: number): number {
  if (x <= 100) return Math.round(x / 10) * 10;
  if (x <= 300) return Math.round(x / 25) * 25;
  if (x <= 1000) return Math.round(x / 50) * 50;
  return Math.round(x / 100) * 100;
}

// Distribution-aware max-price thresholds. Because most weekend escapes are
// cheap and a few long-hauls stretch the range, linear min→max buckets would
// jump 500/1000/1500 and skip the useful low band. Percentiles of the actual
// prices put the thresholds where the deals really are — mostly under a few
// hundred — and the pricey tail falls under "Any".
export function priceBuckets(prices: number[]): number[] {
  if (prices.length < 4) return [];
  const sorted = [...prices].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (max <= min) return [];
  const out: number[] = [];
  for (const p of [0.2, 0.4, 0.6, 0.8]) {
    const t = roundNice(sorted[Math.floor(p * (sorted.length - 1))]);
    if (t > min && t < max && !out.includes(t)) out.push(t);
  }
  return out;
}
