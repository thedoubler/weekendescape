"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { WeekendStyle } from "@/lib/weekend";
import { type Deal, isShortStay, dealDomId } from "@/lib/deals";
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
import { loadHomes, saveHomes } from "@/lib/home-storage";
import { SegmentedControl } from "@/components/SegmentedControl";
import { SearchReceipt, type StopMode } from "@/components/SearchReceipt";
import { FacetTrigger } from "@/components/FacetTrigger";
import { OriginSheet } from "@/components/OriginSheet";
import { parseOrigins, serializeOrigins } from "@/lib/origins";
import { MonthFilter } from "@/components/MonthFilter";
import { ContinentFilter } from "@/components/ContinentFilter";
import { PriceFilter } from "@/components/PriceFilter";
import { DealList, SkeletonCard } from "@/components/DealList";
import { DealsMap } from "@/components/DealsMap";
import { RotatingWord } from "@/components/RotatingWord";
import OverflowDebug from "@/components/OverflowDebug";

// Fetch that aborts after `ms` so a stalled request (slow upstream, a dropped
// tunnel connection) fails into a retryable error instead of spinning forever.
async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}


// "just now" / "3 min ago" / "2 h ago" — for the price-freshness stamp.
function agoLabel(ts: number): string {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return `${h} h ago`;
}

export default function Home() {
  // One to three home airports. `home` stays as the primary for the many places
  // that only need one (map centring, "cheapest weekend" lookups).
  const [origins, setOrigins] = useState<string[]>([]);
  const home = origins[0] ?? "";
  const [style, setStyle] = useState<WeekendStyle>("strict");
  // The search window is fixed at the widest tier. It was a 1/2/3/6 control
  // until it was measured: 6 months costs +45ms over 3 (same upstream call,
  // wider dates), so choosing anything less only ever returned a thinner
  // board. The month chips below filter what came back, instantly and free.
  const MONTHS_WINDOW = 6;
  const [months] = useState(MONTHS_WINDOW);
  const [stopMode, setStopMode] = useState<StopMode>("direct");
  const [adults, setAdults] = useState(1);
  // Opt-in "bridge days" mode — off by default (a plain search). When on, the
  // API runs the holiday-anchored searches and returns only long-weekend escapes.
  const [bridges, setBridges] = useState(false);
  const [sort, setSort] = useState<SortKey>("cheapest");
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedContinents, setSelectedContinents] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState(0);
  const [rawDeals, setRawDeals] = useState<Deal[]>([]);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  // Origin coordinates ship once per response (the airport table is server-only,
  // so the client can't resolve them itself).
  const [originPoints, setOriginPoints] = useState<
    { code: string; coords: [number, number] | null }[]
  >([]);
  const [showMap, setShowMap] = useState(false);
  // Destination the pointer is over in the list; the map lifts its arc out of
  // the fan. Only meaningful while the map is open, and only on pointer/focus
  // devices — a tap never sets it.
  const [hoveredTo, setHoveredTo] = useState<string | null>(null);
  // The parameters the CURRENT results were actually fetched with. The form
  // state changes the instant a user taps a chip, but the deals on screen are
  // still the previous search's — so labels, the URL and the cheapest-weekend
  // lookup must all read from here, never from the live form. Otherwise tapping
  // "2 adults" relabels every card and prints a per-person price for a fare
  // that was quoted for one.
  const [applied, setApplied] = useState<{
    origins: string[];
    style: WeekendStyle;
    months: number;
    direct: boolean;
    adults: number;
    bridges: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const loadingMore = false;
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  // First load only: while we detect location + run the initial search, show a
  // quiet spinner instead of the empty form.
  const [booting, setBooting] = useState(true);
  // Which facet's chips are showing. One at a time: two open rows is most of
  // the height the trigger row was introduced to reclaim.
  const [openFacet, setOpenFacet] = useState<"month" | "region" | "price" | null>(
    null
  );
  // The origin sheet, and the airports it held when it opened — dismissal is
  // the commit, so it needs a before-image to compare against.
  const [sheetOpen, setSheetOpen] = useState(false);
  const originsAtOpen = useRef<string[] | null>(null);
  // The control bar's real height. The list's month dividers pin directly
  // beneath it, and the bar changes height for several reasons: it wraps to
  // two lines on a phone, it grows when a facet is opened, and the trigger set
  // itself changes with the board.
  //
  // Measured in an effect after every render rather than with a
  // ResizeObserver. Every one of those height changes is caused by a React
  // render, so an effect catches them all — and it removes a dependency that
  // could not be verified in this environment at all (an RO attached to this
  // node did not fire once while its height went 53 -> 91). A resize listener
  // covers the one case with no render behind it.
  const barRef = useRef<HTMLDivElement>(null);
  const [barH, setBarH] = useState(0);
  // How far the bar has to reach on each side to span the viewport. Measured,
  // not `calc((100vw - 100%) / 2)`: 100vw counts the scrollbar, so that made
  // the document 15px wider than the viewport and the page scrollable
  // sideways — a real overflow, clipped by body's overflow-x-hidden and
  // therefore invisible until measured.
  const [bleed, setBleed] = useState(0);
  useEffect(() => {
    const measure = () => {
      const node = barRef.current;
      const h = node?.getBoundingClientRect().height ?? 0;
      // Only ever writes on a real change, so this cannot loop.
      setBarH((prev) => (Math.abs(prev - h) < 0.5 ? prev : h));
      // How far the bar's own left edge sits from the window's. That IS the
      // margin it needs, and it needs no arithmetic about the column: measuring
      // the inner row instead was 24px out, because the bar's natural width is
      // main's CONTENT box while the row carries its own padding.
      const main = node?.closest("main");
      if (main) {
        const cs = getComputedStyle(main);
        const g = Math.max(
          0,
          Math.round(main.getBoundingClientRect().left + parseFloat(cs.paddingLeft))
        );
        setBleed((prev) => (prev === g ? prev : g));
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });
  const bootstrapped = useRef(false);
  // Mirror the current filter values into refs so runSearch (called from effects
  // and callbacks) always reads the latest, without being a dependency.
  const styleRef = useRef(style);
  const monthsRef = useRef(months);
  const stopModeRef = useRef(stopMode);
  const adultsRef = useRef(adults);
  const bridgesRef = useRef(bridges);
  useEffect(() => {
    styleRef.current = style;
    monthsRef.current = months;
    stopModeRef.current = stopMode;
    adultsRef.current = adults;
    bridgesRef.current = bridges;
  });

  // `overrides` exists for callers that set state and search in the SAME
  // handler — the bridge switch does. The refs below are updated in an effect,
  // so at that moment they still hold the PREVIOUS value, and searching from
  // them runs the search the user just turned off. (The receipt's facets are
  // safe without it: they commit on a later event, by which time the effect has
  // run. Passing what the caller already knows costs nothing and removes the
  // ordering question entirely.) Verified by reverting: the bridge regression
  // test fails when `overrides.bridges` is dropped.
  async function runSearch(
    codes: string | string[],
    overrides?: Partial<{
      style: WeekendStyle;
      direct: boolean;
      adults: number;
      bridges: boolean;
    }>
  ) {
    const list = parseOrigins(
      Array.isArray(codes) ? codes.join(",") : codes
    );
    if (list.length === 0) return;
    const params = {
      style: overrides?.style ?? styleRef.current,
      months: monthsRef.current,
      direct: overrides?.direct ?? stopModeRef.current === "direct",
      adults: overrides?.adults ?? adultsRef.current,
      bridges: overrides?.bridges ?? bridgesRef.current,
    };
    setOrigins(list);
    saveHomes(list);
    setLoading(true);
    setError(null);
    setSearched(true);
    setBooting(false);
    try {
      const qs = new URLSearchParams({
        flyFrom: serializeOrigins(list),
        style: params.style,
        months: String(params.months),
        adults: String(params.adults),
      });
      if (params.direct) qs.set("direct", "1");
      if (params.bridges) qs.set("bridges", "1");
      const res = await fetchWithTimeout(`/api/weekends?${qs.toString()}`, 20000);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Search failed");
      setRawDeals(body.deals ?? []);
      setFetchedAt(body.fetchedAt ?? Date.now());
      setOriginPoints(body.origins ?? []);
      setApplied({ origins: list, ...params });
      setSelectedMonths([]);
    } catch (e) {
      const timedOut = e instanceof DOMException && e.name === "AbortError";
      setError(
        timedOut
          ? "Search timed out — check your connection and try again."
          : e instanceof Error
            ? e.message
            : "Search failed"
      );
      setRawDeals([]);
    } finally {
      setLoading(false);
    }
  }

  function detectLocation() {
    const fallback = () => {
      const saved = loadHomes();
      if (saved.length) runSearch(saved);
      else {
        // No location and nothing saved. There is no longer an inline field to
        // reveal — the origin lives in a sheet — so open it, which is also the
        // only thing this visitor can usefully do.
        setBooting(false);
        openOriginSheet();
      }
    };
    if (!navigator.geolocation) {
      fallback();
      return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const res = await fetchWithTimeout(
          `/api/airports?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`,
          8000
        );
        const body = res.ok ? await res.json() : null;
        const code = body?.airports?.[0]?.code;
        if (code) runSearch(code);
        else fallback();
      } catch {
        fallback();
      }
    }, fallback, { timeout: 8000 });
  }

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    // A shared/bookmarked link (?from=BCN&style=..&months=..&direct=1) wins over
    // geolocation so the board reproduces exactly.
    const p = new URLSearchParams(window.location.search);
    const from = serializeOrigins(parseOrigins(p.get("from")));
    if (from) {
      const s = p.get("style");
      const m = Number(p.get("months"));
      const style0: WeekendStyle = (["strict", "frimon", "loose"] as const).includes(
        s as WeekendStyle
      )
        ? (s as WeekendStyle)
        : "strict";
      const months0 = [1, 2, 3, 6].includes(m) ? m : 3;
      // Direct is the default now; an explicit direct=0 opts back into stops.
      const stop0: StopMode = p.get("direct") === "0" ? "any" : "direct";
      const a = Number(p.get("adults"));
      const adults0 = [1, 2, 3, 4].includes(a) ? a : 1;
      const bridges0 = p.get("bridges") === "1";
      // Seed refs synchronously so the immediate search uses the URL values
      // (state setters haven't flushed yet). Only guard the param-change effect
      // if a non-default value actually changed.
      styleRef.current = style0;
      monthsRef.current = months0;
      stopModeRef.current = stop0;
      adultsRef.current = adults0;
      bridgesRef.current = bridges0;
      // Deliberately an effect. `/` is prerendered as static content, so this
      // component renders on the server at build time — reading
      // window.location from a render-phase state initialiser would throw
      // there. Seeding from the URL can only happen after mount. Runs once,
      // guarded by `bootstrapped`.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStyle(style0);
      setStopMode(stop0);
      setAdults(adults0);
      setBridges(bridges0);
      runSearch(from);
    } else {
      detectLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Changing the trip options no longer auto-searches — the Search button in the
  // panel is the single trigger, so a network round-trip is always intentional.

  // A stable dependency for the URL sync: `origins` is a fresh array on every
  // render, but its serialised form only changes when the airports do.
  const originsParam = serializeOrigins(applied?.origins ?? []);

  // Keep the URL in sync with the active search so it's shareable/bookmarkable.
  useEffect(() => {
    if (!searched || !originsParam) return;
    const p = new URLSearchParams();
    if (!applied) return;
    p.set("from", originsParam);
    if (applied.style !== "strict") p.set("style", applied.style);
    if (applied.months !== 3) p.set("months", String(applied.months));
    if (!applied.direct) p.set("direct", "0");
    if (applied.adults !== 1) p.set("adults", String(applied.adults));
    if (applied.bridges) p.set("bridges", "1");
    const qs = p.toString();
    // Preserve history.state rather than passing null: Next keeps router
    // internals in there, and wiping them on every filter change breaks
    // back/forward (and would destroy any state marker a future modal adds).
    window.history.replaceState(
      window.history.state,
      "",
      qs ? `?${qs}` : window.location.pathname
    );
  }, [originsParam, applied, searched]);

  const available = useMemo(() => monthsOf(rawDeals), [rawDeals]);
  const availableContinents = useMemo(
    () => continentsOf(rawDeals),
    [rawDeals]
  );
  const bounds = useMemo(() => priceRange(rawDeals), [rawDeals]);
  // Reset the price cap to "show everything" whenever a new search lands. Done
  // during render rather than in an effect so the new cap applies in this same
  // pass — an effect commits (and paints) one frame carrying the previous
  // search's cap before correcting itself.
  const [capBounds, setCapBounds] = useState(bounds.max);
  if (capBounds !== bounds.max) {
    setCapBounds(bounds.max);
    setMaxPrice(bounds.max);
  }
  const cap = maxPrice > 0 ? maxPrice : bounds.max;
  const filtered = useMemo(() => {
    let out = filterByMonths(rawDeals, selectedMonths);
    out = filterByContinents(out, selectedContinents);
    out = filterByMaxPrice(out, cap);
    return sortDeals(out, sort);
  }, [rawDeals, selectedMonths, selectedContinents, cap, sort]);
  // Layover trips with under a day at the destination are hidden by default.
  const hiddenCount = useMemo(
    () => filtered.filter(isShortStay).length,
    [filtered]
  );
  // Memoised: this array is a dependency of the map's marker/framing effects, so
  // a new identity on every render made opening Refine (or crossing the scroll
  // threshold) re-frame the map.
  const visible = useMemo(
    () => (showHidden ? filtered : filtered.filter((d) => !isShortStay(d))),
    [showHidden, filtered]
  );
  // The denominator for "N of M": the board before month/region/price, but
  // after the short-stay rule — otherwise a filtered count could exceed a
  // total the user was never shown.
  const total = useMemo(
    () => (showHidden ? rawDeals : rawDeals.filter((d) => !isShortStay(d))).length,
    [showHidden, rawDeals]
  );

  // Tapping a pin jumps the list to that destination's cheapest weekend and
  // opens it. The seq counter makes repeat taps on the same pin re-trigger.
  const [focusDeal, setFocusDeal] = useState<{ id: string; seq: number } | null>(
    null
  );
  const focusDestination = useCallback(
    (flyTo: string) => {
      const target = visible
        .filter((d) => d.flyTo === flyTo)
        .reduce<Deal | null>(
          (best, d) => (!best || d.price < best.price ? d : best),
          null
        );
      if (!target) return;
      const id = dealDomId(target);
      setFocusDeal((prev) => ({ id, seq: (prev?.seq ?? 0) + 1 }));
      // The card is already rendered, so this can run immediately; rAF just lets
      // the expand commit first so we centre on the final height.
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({
          block: "center",
          behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
        });
      });
    },
    [visible]
  );

  // Per-option counts for the Refine pills, over the base universe the user can
  // actually see (respecting the short-stay toggle) but ignoring month/region/
  // price selections — so each pill shows how many trips it would surface.
  const countable = useMemo(
    () =>
      showHidden ? rawDeals : rawDeals.filter((d) => !isShortStay(d)),
    [rawDeals, showHidden]
  );
  const continentCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of countable) {
      const c = continentOf(d.countryToCode);
      if (c) m[c] = (m[c] ?? 0) + 1;
    }
    return m;
  }, [countable]);
  const currency = rawDeals[0]?.currency ?? "EUR";

  function clearAll() {
    setSelectedMonths([]);
    setSelectedContinents([]);
    setMaxPrice(bounds.max);
    setShowHidden(false);
  }

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

  const priceBucketList = useMemo(
    () => priceBuckets(countable.map((d) => d.price)),
    [countable]
  );

  const hasRefinements =
    available.length > 0 ||
    availableContinents.length > 1 ||
    priceBucketList.length > 0 ||
    hiddenCount > 0;

  const activeFilters =
    selectedMonths.length +
    selectedContinents.length +
    (cap < bounds.max ? 1 : 0);
  // Commit-on-dismiss for the receipt facets. `patch` carries the value the
  // popover was closed on, because state set moments ago has not reached the
  // refs runSearch would otherwise read.
  function commitReceipt(patch: {
    style?: WeekendStyle;
    stopMode?: StopMode;
    adults?: number;
  }) {
    if (!home.trim()) return;
    runSearch(origins, {
      style: patch.style,
      direct: patch.stopMode ? patch.stopMode === "direct" : undefined,
      adults: patch.adults,
    });
  }

  function toggleBridges() {
    const next = !bridges;
    setBridges(next);
    if (home.trim()) runSearch(origins, { bridges: next });
  }

  // The sheet edits `origins` live (chips appear as you add them), so the
  // before-image has to be taken when it opens.
  function openOriginSheet() {
    originsAtOpen.current = origins;
    setSheetOpen(true);
  }

  function closeOriginSheet() {
    setSheetOpen(false);
    const before = originsAtOpen.current;
    originsAtOpen.current = null;
    if (!before) return;
    if ([...before].sort().join() === [...origins].sort().join()) return;
    if (origins.length === 0) {
      // Emptied and dismissed: put back what was searched rather than leaving
      // the board showing results for an airport the receipt no longer names.
      setOrigins(before);
      return;
    }
    runSearch(origins);
  }

  // Widen the search window a tier and fold the wider results into the list in
  // place — no skeleton takeover, no scroll jump — so it reads as "load more".


  return (
    <main
      className="max-w-3xl mx-auto w-full min-w-0 p-4 sm:p-6 flex flex-col gap-4"
      // The list's month dividers are sticky at the top as well. This is what
      // keeps the two from stacking on the same line: they pin below the bar
      // while it exists, and at the viewport top when it doesn't.
      style={
        {
          "--list-sticky-top": `${Math.round(barH)}px`,
        } as React.CSSProperties
      }
    >
      <header className="border-b border-black/[0.07] pb-4 dark:border-white/10">
        {/* One line: wordmark and descriptor share a baseline, so the header is
            a single object rather than a stacked block. Wraps only if there is
            genuinely no room. */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 leading-tight">
          <h1 className="text-[26px] leading-[0.95] tracking-[-0.02em] sm:text-[32px]">
            {/* The wordmark IS the trip: a dotted flight path runs the whole
                width of the name and lands on a solid dot — the motif draws the
                product's own meaning instead of decorating around it. */}
            <span className="relative inline-block font-semibold">
              {/* The name is a portmanteau — s[ho]rt[liday] — where the
                  coloured letters spell "holiday" and "ho" is shared by both
                  words. Deliberately orange-600, not the brand #f97316: that
                  hue is 2.8:1 on white and fails even the 3:1 large-text bar,
                  whereas orange-600 clears it while still reading as the accent.
                  Dark mode flips to orange-400, which needs the lighter value
                  against a near-black ground. */}
              {/* The reveal: both orange runs start at the body colour and
                  warm into the accent a beat apart, so "ho…liday" surfaces out
                  of "short" rather than being coloured from the first frame.
                  Colour only — no movement, no reflow, so the CLS budget stays
                  zero and reduced-motion simply gets the finished state. */}
              <span aria-hidden>
                s
                <span className="wordmark-hi">ho</span>
                rt
                <span className="wordmark-hi wordmark-hi-2">liday</span>
              </span>
              {/* The word intact for assistive tech and for copy-paste. */}
              <span className="sr-only">shortliday</span>
            </span>
          </h1>
          {/* A hairline rule instead of a bullet: it sets on the baseline and
              reads as a lockup, not as punctuation. */}
          <p className="flex items-baseline gap-3 text-sm whitespace-nowrap text-black/65 dark:text-white/60">
            <span
              aria-hidden
              className="hidden h-3 w-px translate-y-[2px] bg-black/15 sm:block dark:bg-white/20"
            />
            <span className="italic">for the{" "}
            <RotatingWord
              words={[
                "spontaneous",
                "weekenders",
                "restless",
                "last-minute",
                "curious",
                "escape artists",
              ]}
              className="font-medium text-black/85 not-italic dark:text-white/90"
            />
            </span>
          </p>
        </div>
      </header>

      {/* Outside the panel on purpose. Inside it, this disappeared the moment
          the panel began collapsing by default — and it is the only sentence
          on the page that says what the product is. One line is the whole cost
          to a returning visitor. */}
      {!booting && (
        <p className="-mt-1 max-w-[72ch] text-[15px] leading-snug text-black/55 dark:text-white/55">
          {/* Two sentences, not one em-dashed run-on: the first is the claim,
              the second is what to do about it. The claim carries the weight —
              it is the only line on the page that says what this is, and it was
              set in the same muted grey as the instruction after it. */}
          <span className="font-medium text-black dark:text-white">
            The cheapest weekend you can fly to
          </span>{" "}
          — round-trips from your home airport, ranked by price.{" "}
          <span className="whitespace-nowrap">
            Tap a deal for the full cost.
          </span>
        </p>
      )}

      {booting ? (
        /* First load: explain the tool + what's happening (we're detecting the
           nearest airport, which may prompt for location), then the same
           skeletons as a search for one consistent loading state. */
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-black/[0.07] bg-black/[0.015] p-4 text-sm dark:border-white/10 dark:bg-white/[0.02]">
            <p className="text-black/70 dark:text-white/70">
              The cheapest round-trip{" "}
              <span className="font-medium">weekend flights</span> from your home
              airport — tap a deal to book on Kiwi. Prices are live estimates.
            </p>
            <p className="mt-1.5 text-black/55 dark:text-white/60">
              📍 Finding your nearest airport… we only use your location for
              this. Prefer not to share it? Decline and you can type it in
              instead.
            </p>
          </div>
          <div
            className="flex flex-col gap-3"
            aria-busy="true"
            aria-label="Finding weekend escapes"
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      ) : (
      <div className="flex flex-col gap-4 animate-fade-in">
      {/* The whole search, as one line of prose. It replaces a panel of six
          labelled controls, a commit bar and the dirty state that drove it.
          The rule it establishes and the filters below obey: THE RECEIPT
          RELOADS, THE FILTERS ARE FREE. Every facet here costs an upstream
          call — marked by the dotted underline and the ↻ — and everything in
          Refine is an Array.filter over deals already in memory. Months live
          down there, with the free things, because that is what they now are:
          the window is pinned at six, so choosing a month never re-searches. */}
      <SearchReceipt
        origins={origins}
        values={{ style, stopMode, adults }}
        bridges={bridges}
        onChange={(patch) => {
          if (patch.style !== undefined) setStyle(patch.style);
          if (patch.stopMode !== undefined) setStopMode(patch.stopMode);
          if (patch.adults !== undefined) setAdults(patch.adults);
        }}
        onCommit={commitReceipt}
        onEditOrigins={openOriginSheet}
        onToggleBridges={toggleBridges}
      />

      {/* Results header and filter controls, one block under one hairline.
          They used to be two: the count/Sort/Map row, then the facet triggers
          on a line of their own. That left 414px of dead space to the right of
          "Price 4" and a half-empty row above it — two ragged lines where the
          content fits comfortably on one. Measured: triggers 306px + Sort/Map
          267px = 573px in a 720px box. */}
      {searched && (
        /* A Fragment, not a wrapper div. `position: sticky` pins only within
           its own PARENT's box, so while the bar sat inside a short wrapper it
           scrolled away the moment that wrapper did — pinned for about 40px,
           which looks exactly like not working. As a direct child of <main>,
           which spans the whole page, it pins for the whole page. */
        <>
          {/* Only the freshness stamp is left up here. The count moved into
              the bar below, because the bar is pinned and a count you cannot
              see while scrolling a filtered board is a count that is not
              doing its job. */}
          {!loading && !error && fetchedAt && visible.length > 0 && (
            <div className="flex items-baseline gap-2.5">
              <span className="text-[11px] text-black/55 dark:text-white/60">
                Checked {agoLabel(fetchedAt)}
              </span>
            </div>
          )}

          {/* THE CONTROL BAR, and the only persistent chrome on the page.
              What you are looking at and everything that changes it, on one
              pinned line: the count and the filters on the left, the ordering
              and the map on the right.

              It replaced two workarounds. A conditional bar used to appear on
              a filtered board once the filters scrolled away, printing the
              count and the active filters as removable chips — but the
              triggers show their own state now ("✓ Europe"), so that was the
              same facts twice. And a floating "↑ Sort & filter" pill existed
              purely to scroll you back to controls you could not reach; there
              is nothing to scroll back to when the controls never leave.

              The cost is honest and permanent: this is chrome on an
              unfiltered board too, where the old conditional bar was free. It
              buys one-tap filtering and re-sorting at any depth on a board
              that runs to ~3,700px, and it reclaims most of its own height
              from the two things it deletes.

              Full-bleed via negative margins so the blur spans the gutter
              rather than stopping at the text column. */}
          <div
            id="refine-panel"
            ref={barRef}
            // Full-bleed. At 1280 the column is 768px, so a bar that stopped
            // at its edge read as a floating strip with a hard vertical cut
            // and the page showing past it.
            //
            // Properly frosted rather than nearly-opaque: bg-background/90 over
            // a 4px blur let card text read straight through, which is most of
            // what made it look unfinished. /70 over a 24px blur is glass.
            style={{ marginInline: `-${bleed}px` }}
            className="sticky top-0 z-30 border-b border-black/[0.07] bg-background/70 backdrop-blur-xl dark:border-white/10"
          >
            {/* The bar bleeds; its CONTENTS stay on the column. */}
            <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-6">
            {/* Not the 18px heading it was — in a pinned 52px bar the count is
                a label on the board, not a title for the page. */}
            <span className="shrink-0 text-[15px] font-semibold tracking-tight tabular-nums">
              {loading
                ? "Searching…"
                : error
                  ? "Couldn’t load"
                  : (() => {
                      // Reads `applied`, never live form state: the deals on
                      // screen were fetched with the PREVIOUS settings, and
                      // reading the live values once relabelled 57 weekend
                      // results as "bridge escapes" before any search ran.
                      const isBridges = applied ? applied.bridges : bridges;
                      const noun = isBridges
                        ? `long weekend${visible.length === 1 ? "" : "s"}`
                        : `flight${visible.length === 1 ? "" : "s"}`;
                      return activeFilters > 0
                        ? `${visible.length} of ${total} ${noun}`
                        : `${visible.length} ${noun}`;
                    })()}
            </span>
            {/* Rides with the count now rather than with the stamp above: at
                depth, undoing three filters would otherwise mean opening three
                triggers. */}
            {!loading && !error && activeFilters > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="shrink-0 text-[11px] text-black/55 underline underline-offset-2 hover:text-black dark:text-white/60 dark:hover:text-white"
              >
                Clear all
              </button>
            )}
            {searched && hasRefinements && (
              /* Insurance, not the normal case: the widest state — all three
                 set, each multi-select — measured 325px in a 350px column. */
              <div className="-mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {available.length > 0 && (
                  <FacetTrigger
                    label="Month"
                    placeholder="Any month"
                    controls="refine-month"
                    value={
                      selectedMonths.length === 1
                        ? monthShort(selectedMonths[0])
                        : selectedMonths.length > 1
                          ? `${monthShort(selectedMonths[0])} +${selectedMonths.length - 1}`
                          : null
                    }
                    open={openFacet === "month"}
                    onClick={() =>
                      setOpenFacet((f) => (f === "month" ? null : "month"))
                    }
                  />
                )}
                {availableContinents.length > 1 && (
                  <FacetTrigger
                    label="Region"
                    // Not "Any region": this product's question is "where can
                    // I go", and the unfiltered answer to that is anywhere.
                    placeholder="Anywhere"
                    controls="refine-region"
                    value={
                      selectedContinents.length === 1
                        ? selectedContinents[0]
                        : selectedContinents.length > 1
                          ? `${selectedContinents[0]} +${selectedContinents.length - 1}`
                          : null
                    }
                    open={openFacet === "region"}
                    onClick={() =>
                      setOpenFacet((f) => (f === "region" ? null : "region"))
                    }
                  />
                )}
                {priceBucketList.length > 0 && (
                  <FacetTrigger
                    label="Price"
                    placeholder="Any price"
                    controls="refine-price"
                    value={cap < bounds.max ? `≤ ${cap}` : null}
                    open={openFacet === "price"}
                    onClick={() =>
                      setOpenFacet((f) => (f === "price" ? null : "price"))
                    }
                  />
                )}
              </div>
            )}

            {/* ml-auto rather than justify-between: with no filters on the
                board the left side is empty, and justify-between would park
                these hard left. */}
            {/* The word "Sort" used to label this. It cost 25px + its gap, and
                the row needed 748 of a 768px box — so it was the difference
                between one line and two. A two-segment Soonest/Cheapest control
                does not need telling you it sorts. */}
            <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
              <SegmentedControl
                options={[
                  { value: "soonest" as SortKey, label: "Soonest" },
                  { value: "cheapest" as SortKey, label: "Cheapest" },
                ]}
                value={sort}
                onChange={setSort}
                ariaLabel="Sort"
              />
              {!loading && !error && visible.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowMap((v) => !v)}
                  aria-expanded={showMap}
                  aria-controls="results-map"
                  className="relative inline-flex h-9 items-center gap-1.5 rounded-full border border-black/15 px-3.5 text-sm text-black/70 transition duration-200 before:absolute before:inset-x-0 before:-inset-y-2 before:content-[''] hover:bg-black/5 dark:border-white/15 dark:text-white/70 dark:hover:bg-white/10"
                >
                  Map
                  <span aria-hidden>{showMap ? "▴" : "▾"}</span>
                </button>
              )}
            </div>

            {/* Inside the sticky container on purpose: the chips pin with the
                bar, so opening a facet 2,000px down drops its values over the
                board instead of somewhere off screen. basis-full puts them on
                their own line under the triggers. */}
            {hasRefinements && openFacet === "month" && (
              <div id="refine-month" className="animate-fade-in basis-full">
                <MonthFilter
                  months={available}
                  selected={selectedMonths}
                  onToggle={toggleMonth}
                />
              </div>
            )}
            {hasRefinements && openFacet === "region" && (
              <div id="refine-region" className="animate-fade-in basis-full">
                <ContinentFilter
                  continents={availableContinents}
                  selected={selectedContinents}
                  counts={continentCounts}
                  onToggle={toggleContinent}
                />
              </div>
            )}
            {hasRefinements && openFacet === "price" && (
              <div id="refine-price" className="animate-fade-in basis-full">
                <PriceFilter
                  buckets={priceBucketList}
                  max={bounds.max}
                  value={cap}
                  currency={currency}
                  onChange={setMaxPrice}
                />
              </div>
            )}
            </div>
          </div>

          {hiddenCount > 0 && (
            /* Not a facet — a rule about what counts as a trip. It reads as a
               sentence you agree with rather than a value you pick. */
            <label className="flex cursor-pointer items-start gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={!showHidden}
                onChange={() => setShowHidden((v) => !v)}
                className="mt-0.5 accent-black dark:accent-white"
              />
              <span className="text-black/55 dark:text-white/55">
                Hide {hiddenCount} trip{hiddenCount === 1 ? "" : "s"} with under
                a day at the destination — more travel than time there.
              </span>
            </label>
          )}
        </>
      )}

      {/* Renders `visible` — the same array DealList gets — so every filter
          chip and price cap repaints the pins. The map deliberately does not
          filter anything itself: that would create filter state with no chip
          representing it. */}
      {searched && showMap && (
        <div id="results-map" className="flex flex-col gap-1.5">
          <DealsMap
            deals={visible}
            origins={originPoints}
            onSelect={focusDestination}
            highlight={hoveredTo}
            // Fullscreen hides the Refine panel behind the dialog, so the one
            // filter people actually reach for on a map goes onto the map.
            controls={
              available.length > 1 ? (
                <MonthFilter
                  months={available}
                  selected={selectedMonths}
                  onToggle={toggleMonth}
                />
              ) : undefined
            }
          />
          <p className="text-[11px] text-black/55 dark:text-white/55">
            Pins mark the arrival airport, which isn’t always the city centre.
          </p>
        </div>
      )}

      {searched && (
        <DealList
          deals={visible}
          focusId={focusDeal?.id}
          focusSeq={focusDeal?.seq}
          showOrigin={origins.length > 1}
          loading={loading}
          error={error}
          groupByMonth={sort === "soonest"}
          cheapest={
            applied
              ? {
                  style: applied.style,
                  months: applied.months,
                  direct: applied.direct,
                  adults: applied.adults,
                }
              : undefined
          }
          splitShape={
            (applied ? applied.bridges : bridges)
              ? undefined
              : (applied?.style ?? style)
          }
          onClearFilters={activeFilters > 0 ? clearAll : undefined}
          // Only while the map is on screen: otherwise every card in a 60-row
          // list would set state on mouse-move for nothing to look at.
          onHover={showMap ? setHoveredTo : undefined}
          emptyMessage={
            selectedMonths.length > 0 ||
            selectedContinents.length > 0 ||
            cap < bounds.max
              ? "No escapes match these filters — try widening them."
              : rawDeals.length === 0
                ? bridges
                  ? `No bridge-day escapes from ${home || "that airport"} in this window — try a longer window, or turn off "Hunt for bridge days".`
                  : `No weekend routes found from ${home || "that airport"} — try a longer window or a different airport.`
                : undefined
          }
        />
      )}

      {/* End-of-list escape hatch: widen the search window without re-opening
          Edit. Keeps the current trip options; the client filters carry over. */}
      {searched && !loading && !error && loadingMore && (
        <div
          className="flex flex-col gap-3"
          aria-busy="true"
          aria-label="Loading more escapes"
        >
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}
      {/* Terminal state at the widest window, so the list has a definite bottom. */}
      {searched && !loading && !error && !loadingMore && visible.length > 0 && (
        <p className="pt-1 pb-2 text-center text-xs text-black/55 dark:text-white/60">
          That’s every weekend in the next {applied?.months ?? months} months.
        </p>
      )}
      </div>
      )}

      {/* One disclosure for the whole site rather than a line under each widget.
          Every outbound booking link here is affiliate — Kiwi, Booking.com and
          GetYourGuide — so stating it once, where it can't be mistaken for part
          of a card, is both more honest and less noisy. */}
      <footer className="mt-2 flex flex-col gap-2 border-t border-black/10 pt-4 text-xs leading-relaxed text-black/45 dark:border-white/10 dark:text-white/45">
        <p>
          Flights, stays and activities are booked on Kiwi.com, Booking.com and
          GetYourGuide. We may earn a commission from those bookings, at no extra
          cost to you. Prices and availability are set by them, not by us.
        </p>
        {/* Its own row: inline at the end of a four-line paragraph, the one
            navigable thing in the footer was the hardest part of it to find. */}
        <a
          href="/about"
          className="w-fit underline underline-offset-2 transition hover:text-black/70 dark:hover:text-white/70"
        >
          About, privacy &amp; contact
        </a>
      </footer>

      {/* Inert unless ?debug=overflow is in the URL. */}
      {/* Mounted unconditionally — a modal <dialog> is in the top layer, so
          where it sits in the tree is irrelevant, and keeping it outside the
          booting branch means the geolocation fallback can open it before the
          board exists. */}
      <OriginSheet
        open={sheetOpen}
        origins={origins}
        onChange={setOrigins}
        onDetect={() => {
          setSheetOpen(false);
          originsAtOpen.current = null;
          detectLocation();
        }}
        onClose={closeOriginSheet}
      />

      <OverflowDebug />
    </main>
  );
}
