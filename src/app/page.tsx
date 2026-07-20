"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type { WeekendStyle } from "@/lib/weekend";
import { type Deal, isShortLayoverTrip } from "@/lib/deals";
import {
  type SortKey,
  sortDeals,
  monthsOf,
  filterByMonths,
  priceRange,
  filterByMaxPrice,
} from "@/lib/sort";
import {
  continentOf,
  continentsOf,
  filterByContinents,
} from "@/lib/continents";
import { monthShort } from "@/lib/format";
import { priceBuckets } from "@/lib/price";
import { loadHome, saveHome } from "@/lib/home-storage";
import { SegmentedControl } from "@/components/SegmentedControl";
import { AirportInput } from "@/components/AirportInput";
import { MonthFilter } from "@/components/MonthFilter";
import { ContinentFilter } from "@/components/ContinentFilter";
import { PriceFilter } from "@/components/PriceFilter";
import { FilterChip } from "@/components/FilterChip";
import { DealList } from "@/components/DealList";

const STYLE_OPTIONS = [
  { value: "strict" as WeekendStyle, label: "Fri–Sun" },
  { value: "frimon" as WeekendStyle, label: "Fri–Mon" },
  { value: "loose" as WeekendStyle, label: "Thu–Mon" },
];
const MONTH_OPTIONS = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 6, label: "6" },
];
const STOP_OPTIONS = [
  { value: "any" as StopMode, label: "Any" },
  { value: "direct" as StopMode, label: "Direct" },
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
  align?: "start" | "end" | "stretch";
  children: ReactNode;
}) {
  const alignClass =
    align === "end"
      ? "items-end"
      : align === "stretch"
        ? "items-stretch"
        : "items-start";
  return (
    <div className={`flex min-w-0 flex-col ${alignClass}`}>
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

// One tappable facet in the collapsed summary — the dotted underline signals it
// can be edited (Airbnb-style: each part of the query is its own edit target).
function FacetButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-mx-0.5 rounded px-1 underline decoration-dotted decoration-black/25 underline-offset-4 transition hover:bg-black/[0.06] hover:decoration-black/60 dark:decoration-white/25 dark:hover:bg-white/[0.10] dark:hover:decoration-white/60"
    >
      {children}
    </button>
  );
}

export default function Home() {
  const [home, setHome] = useState("");
  const [style, setStyle] = useState<WeekendStyle>("frimon");
  const [months, setMonths] = useState(3);
  const [stopMode, setStopMode] = useState<StopMode>("any");
  const [sort, setSort] = useState<SortKey>("cheapest");
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedContinents, setSelectedContinents] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState(0);
  const [rawDeals, setRawDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [showRefine, setShowRefine] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const bootstrapped = useRef(false);
  const didAutoCollapse = useRef(false);
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
      // Collapse the search panel once, after the first successful search, so
      // results are visible right away. Later edits keep it open.
      if (!didAutoCollapse.current) {
        didAutoCollapse.current = true;
        setCollapsed(true);
      }
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

  // Show a "back to controls" pill once the user scrolls deep into the list, so
  // sort/refine stay reachable without scrolling to the top (our month dividers
  // are already sticky, so we avoid a second sticky bar that would overlap them).
  useEffect(() => {
    const onScroll = () => setShowJump(window.scrollY > 700);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
  const filtered = useMemo(
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
  // Layover trips with under a day at the destination are hidden by default.
  const hiddenCount = useMemo(
    () => filtered.filter(isShortLayoverTrip).length,
    [filtered]
  );
  const visible = showHidden
    ? filtered
    : filtered.filter((d) => !isShortLayoverTrip(d));

  // Per-option counts for the Refine pills, over the base universe the user can
  // actually see (respecting the short-stay toggle) but ignoring month/region/
  // price selections — so each pill shows how many trips it would surface.
  const countable = useMemo(
    () =>
      showHidden ? rawDeals : rawDeals.filter((d) => !isShortLayoverTrip(d)),
    [rawDeals, showHidden]
  );
  const monthCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of countable) {
      const k = d.outDepart.slice(0, 7);
      m[k] = (m[k] ?? 0) + 1;
    }
    return m;
  }, [countable]);
  const continentCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of countable) {
      const c = continentOf(d.countryToCode);
      if (c) m[c] = (m[c] ?? 0) + 1;
    }
    return m;
  }, [countable]);
  const currency = rawDeals[0]?.currency ?? "EUR";
  const priceBucketList = useMemo(
    () => priceBuckets(rawDeals.map((d) => d.price)),
    [rawDeals]
  );

  function clearAll() {
    setSelectedMonths([]);
    setSelectedContinents([]);
    setMaxPrice(bounds.max);
  }

  const editSearch = () => setCollapsed(false);
  const editFrom = () => {
    setCollapsed(false);
    setTimeout(() => inputRef.current?.focus(), 60);
  };

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
    priceBucketList.length > 0 ||
    hiddenCount > 0;
  const activeFilters =
    selectedMonths.length +
    selectedContinents.length +
    (cap < bounds.max ? 1 : 0);
  const styleLabel =
    STYLE_OPTIONS.find((o) => o.value === style)?.label ?? style;

  return (
    <main className="max-w-2xl mx-auto w-full min-w-0 p-6 flex flex-col gap-6">
      <header className="flex items-center gap-2.5 border-b border-black/[0.07] pb-4 dark:border-white/10">
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black text-base text-white dark:bg-white dark:text-black"
        >
          ✦
        </span>
        <div className="leading-tight">
          <h1 className="text-lg font-semibold tracking-tight">
            Weekend Escape
          </h1>
          <p className="text-[13px] text-black/50 dark:text-white/50">
            Cheapest weekend getaways from home
          </p>
        </div>
      </header>

      {collapsed ? (
        /* Compact summary once searched — each facet is individually tappable */
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/[0.07] bg-black/[0.015] px-4 py-3 dark:border-white/10 dark:bg-white/[0.02]">
          <div className="min-w-0">
            <div className="text-xs text-black/45 dark:text-white/45">
              Weekend getaways from
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 font-medium">
              <FacetButton onClick={editFrom}>{home}</FacetButton>
              <span className="text-black/25 dark:text-white/25">·</span>
              <FacetButton onClick={editSearch}>{styleLabel}</FacetButton>
              <span className="text-black/25 dark:text-white/25">·</span>
              <FacetButton onClick={editSearch}>
                next {months} month{months === 1 ? "" : "s"}
              </FacetButton>
              <span className="text-black/25 dark:text-white/25">·</span>
              <FacetButton onClick={editSearch}>
                {stopMode === "direct" ? "Direct" : "Any stops"}
              </FacetButton>
            </div>
          </div>
          <button
            type="button"
            onClick={editSearch}
            className="shrink-0 rounded-lg border border-black/15 px-3 py-1.5 text-sm text-black/70 transition hover:bg-black/[0.04] dark:border-white/20 dark:text-white/70 dark:hover:bg-white/[0.06]"
          >
            Edit
          </button>
        </div>
      ) : (
        /* Full search — defines the trip; changing these runs a new search */
        <section className="flex flex-col gap-5 rounded-2xl border border-black/[0.07] bg-black/[0.015] p-5 dark:border-white/10 dark:bg-white/[0.02]">
          {/* Origin — the primary input, given room to breathe */}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-black/60 dark:text-white/60">
                Flying from
              </span>
              <button
                type="button"
                onClick={detectLocation}
                className="text-xs text-black/55 underline-offset-2 transition hover:text-black hover:underline dark:text-white/55 dark:hover:text-white"
              >
                📍 Find my airport
              </button>
            </div>
            <AirportInput
              value={home}
              onSearch={runSearch}
              inputRef={inputRef}
            />
          </div>

          <div className="h-px bg-black/[0.06] dark:bg-white/[0.08]" />

          {/* When & how — refinements to the trip */}
          <div className="flex flex-wrap gap-x-8 gap-y-5">
            <Field label="Weekend length">
              <SegmentedControl
                options={STYLE_OPTIONS}
                value={style}
                onChange={setStyle}
                ariaLabel="Weekend length"
              />
            </Field>
            <Field label="Months ahead">
              <SegmentedControl
                options={MONTH_OPTIONS}
                value={months}
                onChange={setMonths}
                ariaLabel="Timeline"
              />
            </Field>
            <Field label="Stops" hint="Direct = nonstop only">
              <SegmentedControl
                options={STOP_OPTIONS}
                value={stopMode}
                onChange={setStopMode}
                ariaLabel="Stops"
              />
            </Field>
          </div>

          {searched && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 dark:bg-white dark:text-black"
              >
                Done
              </button>
            </div>
          )}
        </section>
      )}

      {/* Results header — primary: what you're seeing + how it's ordered */}
      {searched && (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <span className="text-lg font-semibold tracking-tight">
              {loading
                ? "Searching…"
                : error
                  ? "Couldn’t load results"
                  : `${visible.length} weekend escape${
                      visible.length === 1 ? "" : "s"
                    }`}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-black/45 dark:text-white/45">
                Sort
              </span>
              <SegmentedControl
                options={[
                  { value: "soonest" as SortKey, label: "Soonest" },
                  { value: "cheapest" as SortKey, label: "Cheapest" },
                ]}
                value={sort}
                onChange={setSort}
                ariaLabel="Sort"
              />
              {!loading && !error && hasRefinements && (
                <button
                  type="button"
                  onClick={() => setShowRefine((v) => !v)}
                  aria-expanded={showRefine}
                  className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-black/15 px-3 py-1 text-sm text-black/70 hover:bg-black/5 dark:border-white/15 dark:text-white/70 dark:hover:bg-white/10"
                >
                  Refine
                  {activeFilters > 0 && (
                    <span className="rounded-full bg-black px-1.5 text-xs text-white dark:bg-white dark:text-black">
                      {activeFilters}
                    </span>
                  )}
                  <span aria-hidden>{showRefine ? "▴" : "▾"}</span>
                </button>
              )}
            </div>
          </div>
          {/* Secondary: active filters as removable chips, so filter state
              stays visible while the Refine panel is closed. */}
          {!loading && !error && hasRefinements && activeFilters > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {selectedMonths.map((m) => (
                <FilterChip
                  key={m}
                  label={monthShort(m)}
                  onRemove={() => toggleMonth(m)}
                />
              ))}
              {selectedContinents.map((c) => (
                <FilterChip
                  key={c}
                  label={c}
                  onRemove={() => toggleContinent(c)}
                />
              ))}
              {cap < bounds.max && (
                <FilterChip
                  label={`≤ ${cap} ${currency}`}
                  onRemove={() => setMaxPrice(bounds.max)}
                />
              )}
              <button
                type="button"
                onClick={clearAll}
                className="ml-0.5 text-sm text-black/50 underline underline-offset-2 hover:text-black/80 dark:text-white/50 dark:hover:text-white/80"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}

      {/* Refine — instant client-side filters; same visual language as the
          trip panel, but these narrow the loaded results without re-searching. */}
      {searched && showRefine && hasRefinements && (
        <div className="flex flex-col gap-5 rounded-2xl border border-black/[0.07] bg-black/[0.015] p-5 dark:border-white/10 dark:bg-white/[0.02]">
          <p className="text-xs text-black/45 dark:text-white/45">
            Narrows the results below instantly — no new search.
          </p>
          {available.length > 0 && (
            <Field label="Month" align="stretch">
              <MonthFilter
                months={available}
                selected={selectedMonths}
                counts={monthCounts}
                onToggle={toggleMonth}
                onClear={() => setSelectedMonths([])}
              />
            </Field>
          )}
          {availableContinents.length > 1 && (
            <Field label="Region" align="stretch">
              <ContinentFilter
                continents={availableContinents}
                selected={selectedContinents}
                counts={continentCounts}
                onToggle={toggleContinent}
                onClear={() => setSelectedContinents([])}
              />
            </Field>
          )}
          {priceBucketList.length > 0 && (
            <Field label="Max price" align="stretch">
              <PriceFilter
                buckets={priceBucketList}
                max={bounds.max}
                value={cap}
                currency={currency}
                onChange={setMaxPrice}
              />
            </Field>
          )}
          {hiddenCount > 0 && (
            <Field label="Short-stay trips" align="stretch">
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!showHidden}
                  onChange={() => setShowHidden((v) => !v)}
                  className="mt-0.5 accent-black dark:accent-white"
                />
                <span className="text-black/70 dark:text-white/70">
                  Hide {hiddenCount} trip{hiddenCount === 1 ? "" : "s"} with a
                  layover and under a day at the destination — more travel than
                  time there.
                </span>
              </label>
            </Field>
          )}
        </div>
      )}

      {searched && (
        <DealList
          deals={visible}
          loading={loading}
          error={error}
          groupByMonth={sort === "soonest"}
          cheapest={{ style, months, direct: stopMode === "direct" }}
          onClearFilters={activeFilters > 0 ? clearAll : undefined}
          emptyMessage={
            selectedMonths.length > 0 ||
            selectedContinents.length > 0 ||
            cap < bounds.max
              ? "No escapes match these filters — try widening them."
              : undefined
          }
        />
      )}

      {searched && showJump && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full bg-black px-4 py-2 text-sm font-medium text-white shadow-lg transition hover:opacity-90 dark:bg-white dark:text-black"
        >
          ↑ Sort &amp; filter
        </button>
      )}
    </main>
  );
}
