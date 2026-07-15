"use client";

import { useEffect, useState } from "react";
import type { Deal } from "@/lib/deals";
import type { WeekendStyle } from "@/lib/weekend";
import { loadHome, saveHome } from "@/lib/home-storage";
import { DealList } from "@/components/DealList";

const STYLES: { value: WeekendStyle; label: string }[] = [
  { value: "strict", label: "Strict (Sat–Sun)" },
  { value: "frimon", label: "Fri–Mon" },
  { value: "loose", label: "Loose (Thu–Sun)" },
];
const MONTHS = [1, 2, 3, 6];

export default function Home() {
  const [home, setHome] = useState("");
  const [style, setStyle] = useState<WeekendStyle>("frimon");
  const [months, setMonths] = useState(3);
  const [maxPrice, setMaxPrice] = useState("");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const saved = loadHome();
    if (saved) setHome(saved);
  }, []);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation unavailable — enter your airport manually.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `/api/airports?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`
          );
          const body = await res.json();
          if (body.airports?.[0]?.code) setHome(body.airports[0].code);
        } catch {
          setError("Couldn't resolve nearby airports — enter one manually.");
        }
      },
      () => setError("Location denied — enter your airport manually.")
    );
  }

  async function search() {
    const code = home.trim().toUpperCase();
    if (!code) {
      setError("Enter your home airport first.");
      return;
    }
    saveHome(code);
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const qs = new URLSearchParams({
        flyFrom: code,
        style,
        months: String(months),
      });
      if (maxPrice.trim()) qs.set("maxPrice", maxPrice.trim());
      const res = await fetch(`/api/weekends?${qs.toString()}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Search failed");
      setDeals(body.deals ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-6 flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Weekend Escape</h1>
        <p className="opacity-70">The cheapest weekend getaways from home.</p>
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            value={home}
            onChange={(e) => setHome(e.target.value)}
            placeholder="Home airport (e.g. BCN)"
            className="flex-1 rounded-lg border border-black/15 dark:border-white/15 px-3 py-2 bg-transparent"
          />
          <button
            onClick={useMyLocation}
            className="rounded-lg border border-black/15 dark:border-white/15 px-3 py-2"
          >
            📍 Use my location
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Weekend style"
            value={style}
            onChange={(e) => setStyle(e.target.value as WeekendStyle)}
            className="rounded-lg border border-black/15 dark:border-white/15 px-3 py-2 bg-transparent"
          >
            {STYLES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Timeline"
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="rounded-lg border border-black/15 dark:border-white/15 px-3 py-2 bg-transparent"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                Next {m} {m === 1 ? "month" : "months"}
              </option>
            ))}
          </select>

          <input
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Max €"
            inputMode="numeric"
            className="w-24 rounded-lg border border-black/15 dark:border-white/15 px-3 py-2 bg-transparent"
          />

          <button
            onClick={search}
            className="rounded-lg bg-black text-white dark:bg-white dark:text-black px-4 py-2 font-medium"
          >
            Search
          </button>
        </div>
      </section>

      {searched && <DealList deals={deals} loading={loading} error={error} />}
      {!searched && error && <p className="text-red-500">{error}</p>}
    </main>
  );
}
