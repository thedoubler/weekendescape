"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type { WeekendStyle } from "@/lib/weekend";
import type { Deal } from "@/lib/deals";
import {
  type SortKey,
  sortDeals,
  monthsOf,
  filterByMonths,
  priceRange,
  filterByMaxPrice,
} from "@/lib/sort";
import { continentsOf, filterByContinents } from "@/lib/continents";
import { loadHome, saveHome } from "@/lib/home-storage";
import { SegmentedControl } from "@/components/SegmentedControl";
import { AirportInput } from "@/components/AirportInput";
import { MonthFilter } from "@/components/MonthFilter";
import { ContinentFilter } from "@/components/ContinentFilter";
import { PriceFilter } from "@/components/PriceFilter";
import { DealList } from "@/components/DealList";

const STYLE_OPTIONS = [
  { value: "strict" as WeekendStyle, label: "Strict" },
  { value: "frimon" as WeekendStyle, label: "Fri–Mon" },
  { value: "loose" as WeekendStyle, label: "Loose" },
];
const MONTH_OPTIONS = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 6, label: "6" },
];
const SORT_OPTIONS = [
  { value: "soonest" as SortKey, label: "Soonest" },
  { value: "cheapest" as SortKey, label: "Cheapest" },
];
const STOP_OPTIONS = [
  { value: "any" as StopMode, label: "Any" },
  { value: "direct" as StopMode, label: "Direct only" },
];
type StopMode = "any" | "direct";

function Field({
  label,
  hint,
  align = "start",
  children,
}: {
  label: string;
  hint?: string;
  align?: "start" | "end";
  children: ReactNode;
}) {
  return (
    <div
      className={`flex flex-col ${align === "end" ? "items-end" : "items-start"}`}
    >
      <span className="mb-1 text-xs font-medium text-black/60 dark:text-white/60">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 text-xs text-black/40 dark:text-white/40">
          {hint}
        </span>
      )}
    </div>
  );
}

function RefineRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:flex-nowrap">
      <span className="w-20 shrink-0 text-sm text-black/50 dark:text-white/50">
        {label}
      </span>
      {children}
    </div>
  );
}

export default function Home() {
  const [home, setHome] = useState("");
  const [style, setStyle] = useState<WeekendStyle>("frimon");
  const [months, setMonths] = useState(3);
  const [stopMode, setStopMode] = useState<StopMode>("any");
  const [sort, setSort] = useState<SortKey>("soonest");
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedContinents, setSelectedContinents] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState(0);
  const [rawDeals, setRawDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const bootstrapped = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const styleRef = useRef(style);
  styleRef.current = style;
  const monthsRef = useRef(months);
  monthsRef.current = months;
  const stopModeRef = useRef(stopMode);
  stopModeRef.current = stopMode;

  async function runSearch(code: string) {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setHome(c);
    saveHome(c);
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const qs = new URLSearchParams({
        flyFrom: c,
        style: styleRef.current,
        months: String(monthsRef.current),
      });
      if (stopModeRef.current === "direct") qs.set("direct", "1");
      const res = await fetch(`/api/weekends?${qs.toString()}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Search failed");
      setRawDeals(body.deals ?? []);
      setSelectedMonths([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
      setRawDeals([]);
    } finally {
      setLoading(false);
    }
  }

  function detectLocation() {
    const fallback = () => {
      const saved = loadHome();
      if (saved) runSearch(saved);
      else inputRef.current?.focus();
    };
    if (!navigator.geolocation) {
      fallback();
      return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const res = await fetch(
          `/api/airports?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`
        );
        const body = res.ok ? await res.json() : null;
        const code = body?.airports?.[0]?.code;
        if (code) runSearch(code);
        else fallback();
      } catch {
        fallback();
      }
    }, fallback);
  }

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    detectLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!bootstrapped.current || !home) return;
    runSearch(home);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, months, stopMode]);

  const available = useMemo(() => monthsOf(rawDeals), [rawDeals]);
  const availableContinents = useMemo(
    () => continentsOf(rawDeals),
    [rawDeals]
  );
  const bounds = useMemo(() => priceRange(rawDeals), [rawDeals]);
  // Reset the price cap to "show everything" whenever a new search lands.
  useEffect(() => {
    setMaxPrice(bounds.max);
  }, [bounds.max]);
  const cap = maxPrice > 0 ? maxPrice : bounds.max;
  const visible = useMemo(
    () =>
      sortDeals(
        filterByMaxPrice(
          filterByContinents(
            filterByMonths(rawDeals, selectedMonths),
            selectedContinents
          ),
          cap
        ),
        sort
      ),
    [rawDeals, selectedMonths, selectedContinents, cap, sort]
  );

  function toggleMonth(m: string) {
    setSelectedMonths((cur) =>
      cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]
    );
  }

  function toggleContinent(c: string) {
    setSelectedContinents((cur) =>
      cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]
    );
  }

  const hasRefinements =
    available.length > 0 ||
    availableContinents.length > 1 ||
    bounds.max > bounds.min;

  return (
    <main className="max-w-2xl mx-auto p-6 flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Weekend Escape</h1>
        <p className="opacity-70">
          The cheapest weekend getaways from your home airport.
        </p>
      </header>

      {/* Search — defines the trip; changing these runs a new search */}
      <section className="flex flex-col gap-4 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <Field label="Flying from">
          <div className="flex flex-wrap items-center gap-2">
            <AirportInput
              value={home}
              onSearch={runSearch}
              inputRef={inputRef}
            />
            <button
              type="button"
              onClick={detectLocation}
              className="rounded-lg border border-black/10 px-3 py-2 text-sm text-black/70 hover:bg-black/5 dark:border-white/15 dark:text-white/70 dark:hover:bg-white/10"
            >
              📍 Use my location
            </button>
          </div>
        </Field>

        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <Field label="Weekend" hint="Strict = Fri–Sun · Loose = Thu–Mon">
            <SegmentedControl
              options={STYLE_OPTIONS}
              value={style}
              onChange={setStyle}
              ariaLabel="Weekend style"
            />
          </Field>
          <Field label="Search the next" hint="months ahead">
            <SegmentedControl
              options={MONTH_OPTIONS}
              value={months}
              onChange={setMonths}
              ariaLabel="Timeline"
            />
          </Field>
          <Field label="Flights" hint="Allow layovers or not">
            <SegmentedControl
              options={STOP_OPTIONS}
              value={stopMode}
              onChange={setStopMode}
              ariaLabel="Stops"
            />
          </Field>
        </div>
      </section>

      {/* Results header + sort */}
      {searched && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <span className="text-base font-medium">
            {loading
              ? "Searching…"
              : error
                ? "Couldn’t load results"
                : `${visible.length} weekend escape${
                    visible.length === 1 ? "" : "s"
                  }`}
          </span>
          <Field label="Sort by" align="end">
            <SegmentedControl
              options={SORT_OPTIONS}
              value={sort}
              onChange={setSort}
              ariaLabel="Sort"
            />
          </Field>
        </div>
      )}

      {/* Refine — instant filters on the loaded results */}
      {searched && hasRefinements && (
        <div className="flex flex-col gap-3 rounded-xl border border-black/10 p-4 dark:border-white/10">
          <span className="text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
            Refine
          </span>
          {available.length > 0 && (
            <RefineRow label="Month">
              <MonthFilter
                months={available}
                selected={selectedMonths}
                onToggle={toggleMonth}
                onClear={() => setSelectedMonths([])}
              />
            </RefineRow>
          )}
          {availableContinents.length > 1 && (
            <RefineRow label="Region">
              <ContinentFilter
                continents={availableContinents}
                selected={selectedContinents}
                onToggle={toggleContinent}
                onClear={() => setSelectedContinents([])}
              />
            </RefineRow>
          )}
          {bounds.max > bounds.min && (
            <RefineRow label="Max price">
              <PriceFilter
                min={bounds.min}
                max={bounds.max}
                value={cap}
                currency={rawDeals[0]?.currency ?? "EUR"}
                onChange={setMaxPrice}
              />
            </RefineRow>
          )}
        </div>
      )}

      {searched && (
        <DealList
          deals={visible}
          loading={loading}
          error={error}
          cheapest={{ style, months, direct: stopMode === "direct" }}
          emptyMessage={
            selectedMonths.length > 0 ||
            selectedContinents.length > 0 ||
            cap < bounds.max
              ? "No escapes match these filters — try widening them."
              : undefined
          }
        />
      )}
    </main>
  );
}
