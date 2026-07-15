# Weekend Escape Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve Weekend Escape into an instant, richer app: auto-search on load, flight times + real time-at-destination, a weekend day-blocks strip, pill controls, a month filter, and sort by soonest/cheapest.

**Architecture:** Enrich the `Deal` model with the four flight times the Tequila response already carries and a computed `stayMinutes`; add pure `format` (labels/duration/day-blocks) and `sort` (sort/months/filter) helpers; rebuild the UI with a reusable `SegmentedControl`, `DayBlocks`, a `MonthFilter`, and an expandable hybrid `DealCard`; make the page auto-search via geolocation on mount with client-side sort/filter. The `/api/weekends` route keeps its params unchanged.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Vitest + @testing-library/react (jsdom).

## Global Constraints

- Project root: `/Users/raul/Projects/samples/weekendescape`; source under `src/`; import alias `@/*` → `src/`.
- Kiwi Tequila `local_*` timestamps are local wall-clock — parse the string's own fields, never `new Date(iso)` (which applies the machine timezone). Do NOT convert timezones.
- Weekend styles: `strict | frimon | loose`. Timeline months: `1 | 2 | 3 | 6` (default 3). Default sort: `soonest`.
- Month filter is multi-select, client-side, default none-selected = all months.
- Sorting and month-filtering are client-side only and MUST NOT trigger a refetch.
- Test framework: Vitest. Run one file with `npx vitest run <path>`; full suite `npm test`; build `npm run build`.
- Commit after every task with a `feat:`/`test:`/`refactor:` message.
- Canonical enriched `Deal` shape (used verbatim across tasks):
  ```
  { cityTo, countryTo, flag, outDepart, outArrive, backDepart, backArrive,
    stayMinutes, nights, price, currency, deepLink }
  ```

---

### Task 1: Enrich the Deal model with flight times

**Files:**
- Modify: `src/lib/deals.ts`
- Test: `src/lib/__tests__/deals.test.ts` (rewrite the normalizeDeals cases)
- Modify: `src/app/api/weekends/__tests__/route.test.ts` (add `local_arrival` to the mock legs so the enriched normalizer keeps the deal)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `interface Deal { cityTo: string; countryTo: string; flag: string; outDepart: string; outArrive: string; backDepart: string; backArrive: string; stayMinutes: number; nights: number; price: number; currency: string; deepLink: string }`
  - `function flagEmoji(countryCode: string): string` (unchanged)
  - `function normalizeDeals(raw: unknown, currency: string): Deal[]` — extracts `local_departure`/`local_arrival` from the outbound leg (`return===0` or `route[0]`) and inbound leg (`return===1`); computes `stayMinutes = naiveMinutes(backDepart) − naiveMinutes(outArrive)`; skips items missing city/price/deepLink or any of the four times; returns sorted ascending by price.

- [ ] **Step 1: Rewrite the failing test `src/lib/__tests__/deals.test.ts`**

Replace the entire `describe("normalizeDeals", ...)` block (keep the `flagEmoji` describe as-is) with:

```ts
describe("normalizeDeals", () => {
  const raw = {
    data: [
      {
        cityTo: "Lisbon",
        countryTo: { code: "PT", name: "Portugal" },
        price: 89,
        deep_link: "https://kiwi.com/deep/lisbon",
        nightsInDest: 2,
        route: [
          {
            local_departure: "2026-08-21T18:00:00.000Z",
            local_arrival: "2026-08-21T20:00:00.000Z",
            return: 0,
          },
          {
            local_departure: "2026-08-23T20:00:00.000Z",
            local_arrival: "2026-08-23T22:00:00.000Z",
            return: 1,
          },
        ],
      },
      {
        cityTo: "Ibiza",
        countryTo: { code: "ES", name: "Spain" },
        price: 37,
        deep_link: "https://kiwi.com/deep/ibiza",
        nightsInDest: 2,
        route: [
          {
            local_departure: "2026-08-08T21:05:00.000Z",
            local_arrival: "2026-08-08T22:10:00.000Z",
            return: 0,
          },
          {
            local_departure: "2026-08-10T22:45:00.000Z",
            local_arrival: "2026-08-10T23:45:00.000Z",
            return: 1,
          },
        ],
      },
    ],
  };

  it("extracts all four flight times and computes stayMinutes, sorted by price", () => {
    const deals = normalizeDeals(raw, "EUR");
    expect(deals).toHaveLength(2);
    expect(deals[0]).toEqual({
      cityTo: "Ibiza",
      countryTo: "Spain",
      flag: "🇪🇸",
      outDepart: "2026-08-08T21:05:00.000Z",
      outArrive: "2026-08-08T22:10:00.000Z",
      backDepart: "2026-08-10T22:45:00.000Z",
      backArrive: "2026-08-10T23:45:00.000Z",
      stayMinutes: 2915,
      nights: 2,
      price: 37,
      currency: "EUR",
      deepLink: "https://kiwi.com/deep/ibiza",
    });
    expect(deals[1].cityTo).toBe("Lisbon");
  });

  it("returns an empty array when data is missing", () => {
    expect(normalizeDeals({}, "EUR")).toEqual([]);
    expect(normalizeDeals(null, "EUR")).toEqual([]);
  });

  it("skips items missing a leg time", () => {
    const bad = {
      data: [
        {
          cityTo: "Nowhere",
          countryTo: { code: "XX", name: "" },
          price: 10,
          deep_link: "x",
          route: [{ local_departure: "2026-08-08T21:05:00.000Z", return: 0 }],
        },
      ],
    };
    expect(normalizeDeals(bad, "EUR")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/deals.test.ts`
Expected: FAIL (result objects still have `dateOut`/`dateBack`, no `outDepart`/`stayMinutes`).

- [ ] **Step 3: Rewrite `src/lib/deals.ts`**

```ts
export interface Deal {
  cityTo: string;
  countryTo: string;
  flag: string;
  outDepart: string;
  outArrive: string;
  backDepart: string;
  backArrive: string;
  stayMinutes: number;
  nights: number;
  price: number;
  currency: string;
  deepLink: string;
}

export function flagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "🏳️";
  const A = 0x1f1e6;
  const base = "A".charCodeAt(0);
  const upper = countryCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return "🏳️";
  return Array.from(upper)
    .map((c) => String.fromCodePoint(A + c.charCodeAt(0) - base))
    .join("");
}

interface RouteLeg {
  local_departure?: string;
  local_arrival?: string;
  return?: number;
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

function isoOrNull(iso: string | undefined): string | null {
  return iso && typeof iso === "string" && ISO_RE.test(iso) ? iso : null;
}

function naiveMinutes(iso: string): number {
  const m = ISO_RE.exec(iso)!;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60000;
}

export function normalizeDeals(raw: unknown, currency: string): Deal[] {
  const data =
    raw && typeof raw === "object" && Array.isArray((raw as any).data)
      ? ((raw as any).data as any[])
      : [];

  const deals: Deal[] = [];
  for (const item of data) {
    const route: RouteLeg[] = Array.isArray(item?.route) ? item.route : [];
    const outLeg = route.find((l) => l?.return === 0) ?? route[0];
    const backLeg = route.find((l) => l?.return === 1);

    const outDepart = isoOrNull(outLeg?.local_departure);
    const outArrive = isoOrNull(outLeg?.local_arrival);
    const backDepart = isoOrNull(backLeg?.local_departure);
    const backArrive = isoOrNull(backLeg?.local_arrival);

    const cityTo = item?.cityTo;
    const price = item?.price;
    const deepLink = item?.deep_link;

    if (
      !cityTo ||
      typeof price !== "number" ||
      !deepLink ||
      !outDepart ||
      !outArrive ||
      !backDepart ||
      !backArrive
    ) {
      continue;
    }

    deals.push({
      cityTo,
      countryTo: item?.countryTo?.name ?? "",
      flag: flagEmoji(item?.countryTo?.code ?? ""),
      outDepart,
      outArrive,
      backDepart,
      backArrive,
      stayMinutes: naiveMinutes(backDepart) - naiveMinutes(outArrive),
      nights: typeof item?.nightsInDest === "number" ? item.nightsInDest : 0,
      price,
      currency,
      deepLink,
    });
  }

  return deals.sort((a, b) => a.price - b.price);
}
```

- [ ] **Step 4: Update the weekends route test mock legs**

In `src/app/api/weekends/__tests__/route.test.ts`, in the `route:` array of the mocked Rome deal, add `local_arrival` to each leg so the enriched normalizer keeps it:

```ts
route: [
  {
    local_departure: "2026-09-05T07:30:00.000Z",
    local_arrival: "2026-09-05T09:00:00.000Z",
    return: 0,
  },
  {
    local_departure: "2026-09-06T21:00:00.000Z",
    local_arrival: "2026-09-06T22:30:00.000Z",
    return: 1,
  },
],
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/deals.test.ts src/app/api/weekends/__tests__/route.test.ts`
Expected: PASS (deals: 5 tests; weekends route: 6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/deals.ts src/lib/__tests__/deals.test.ts src/app/api/weekends/__tests__/route.test.ts
git commit -m "feat: enrich Deal with flight times and stay duration"
```

---

### Task 2: Format helpers (labels, duration, day-blocks)

**Files:**
- Create: `src/lib/format.ts`
- Test: `src/lib/__tests__/format.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface DayCell { weekday: string; day: number; isWeekend: boolean; role: "depart" | "return" | "middle" }`
  - `function dayLabel(iso: string): string` → `"Sat 8"`
  - `function timeLabel(iso: string): string` → `"22:10"`
  - `function durationLabel(minutes: number): string` → `"2d 1h"` / `"18h"` / `"45m"` / `"0m"`
  - `function dayBlocks(outDepart: string, backArrive: string): DayCell[]`

- [ ] **Step 1: Write the failing test `src/lib/__tests__/format.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { dayLabel, timeLabel, durationLabel, dayBlocks } from "@/lib/format";

describe("dayLabel", () => {
  it("formats weekday and day-of-month from local wall-clock", () => {
    expect(dayLabel("2026-08-08T21:05:00.000Z")).toBe("Sat 8");
    expect(dayLabel("2026-08-10T22:45:00.000Z")).toBe("Mon 10");
  });
  it("returns empty string on bad input", () => {
    expect(dayLabel("nope")).toBe("");
  });
});

describe("timeLabel", () => {
  it("reads the wall-clock HH:MM verbatim (no timezone shift)", () => {
    expect(timeLabel("2026-08-08T22:10:00.000Z")).toBe("22:10");
    expect(timeLabel("2026-08-08T07:05:00.000Z")).toBe("07:05");
  });
});

describe("durationLabel", () => {
  it("formats days/hours/minutes, dropping zero units", () => {
    expect(durationLabel(2915)).toBe("2d"); // 2d 0h 35m -> minutes dropped when days present
    expect(durationLabel(2945)).toBe("2d 1h");
    expect(durationLabel(1080)).toBe("18h");
    expect(durationLabel(45)).toBe("45m");
    expect(durationLabel(0)).toBe("0m");
  });
});

describe("dayBlocks", () => {
  it("builds one cell per day, accents the weekend, tags depart/return", () => {
    const cells = dayBlocks(
      "2026-08-08T21:05:00.000Z",
      "2026-08-10T23:45:00.000Z"
    );
    expect(cells).toEqual([
      { weekday: "Sat", day: 8, isWeekend: true, role: "depart" },
      { weekday: "Sun", day: 9, isWeekend: true, role: "middle" },
      { weekday: "Mon", day: 10, isWeekend: false, role: "return" },
    ]);
  });
  it("returns empty on bad input", () => {
    expect(dayBlocks("x", "y")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/format.test.ts`
Expected: FAIL (cannot find module `@/lib/format`).

- [ ] **Step 3: Write `src/lib/format.ts`**

```ts
export interface DayCell {
  weekday: string;
  day: number;
  isWeekend: boolean;
  role: "depart" | "return" | "middle";
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

interface Parts {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
}

function parts(iso: string): Parts | null {
  const m = ISO_RE.exec(iso);
  if (!m) return null;
  return { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5] };
}

export function dayLabel(iso: string): string {
  const p = parts(iso);
  if (!p) return "";
  const wd = new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay();
  return `${WD[wd]} ${p.d}`;
}

export function timeLabel(iso: string): string {
  const p = parts(iso);
  if (!p) return "";
  return `${String(p.h).padStart(2, "0")}:${String(p.mi).padStart(2, "0")}`;
}

export function durationLabel(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return "0m";
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = Math.round(minutes % 60);
  const out: string[] = [];
  if (d) out.push(`${d}d`);
  if (h) out.push(`${h}h`);
  if (m && !d) out.push(`${m}m`);
  return out.length ? out.join(" ") : "0m";
}

export function dayBlocks(outDepart: string, backArrive: string): DayCell[] {
  const a = parts(outDepart);
  const b = parts(backArrive);
  if (!a || !b) return [];
  const DAY = 86400000;
  const start = Date.UTC(a.y, a.mo - 1, a.d);
  const end = Date.UTC(b.y, b.mo - 1, b.d);
  const n = Math.round((end - start) / DAY);
  if (n < 0 || n > 30) return [];
  const cells: DayCell[] = [];
  for (let i = 0; i <= n; i++) {
    const dt = new Date(start + i * DAY);
    const wd = dt.getUTCDay();
    cells.push({
      weekday: WD[wd],
      day: dt.getUTCDate(),
      isWeekend: wd === 0 || wd === 6,
      role: i === 0 ? "depart" : i === n ? "return" : "middle",
    });
  }
  return cells;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/format.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/__tests__/format.test.ts
git commit -m "feat: add date/time/duration/day-block format helpers"
```

---

### Task 3: Sort and month-filter helpers

**Files:**
- Create: `src/lib/sort.ts`
- Test: `src/lib/__tests__/sort.test.ts`

**Interfaces:**
- Consumes: `Deal` from `@/lib/deals`.
- Produces:
  - `type SortKey = "soonest" | "cheapest"`
  - `function sortDeals(deals: Deal[], key: SortKey): Deal[]` — `soonest`: by `outDepart` asc, tie-break `price` asc; `cheapest`: by `price` asc, tie-break `outDepart` asc. Returns a new array.
  - `function monthsOf(deals: Deal[]): string[]` — distinct `YYYY-MM` of `outDepart`, ascending.
  - `function filterByMonths(deals: Deal[], months: string[]): Deal[]` — empty `months` → all; else keep deals whose `outDepart.slice(0,7)` is in `months`.

- [ ] **Step 1: Write the failing test `src/lib/__tests__/sort.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { sortDeals, monthsOf, filterByMonths } from "@/lib/sort";
import type { Deal } from "@/lib/deals";

function d(cityTo: string, outDepart: string, price: number): Deal {
  return {
    cityTo,
    countryTo: "",
    flag: "🏳️",
    outDepart,
    outArrive: outDepart,
    backDepart: outDepart,
    backArrive: outDepart,
    stayMinutes: 0,
    nights: 1,
    price,
    currency: "EUR",
    deepLink: "x",
  };
}

const deals = [
  d("Rome", "2026-09-05T07:00:00.000Z", 55),
  d("Ibiza", "2026-08-08T21:00:00.000Z", 37),
  d("Paris", "2026-08-22T06:00:00.000Z", 37),
];

describe("sortDeals", () => {
  it("soonest orders by departure, tie-break price", () => {
    expect(sortDeals(deals, "soonest").map((x) => x.cityTo)).toEqual([
      "Ibiza",
      "Paris",
      "Rome",
    ]);
  });
  it("cheapest orders by price, tie-break departure", () => {
    expect(sortDeals(deals, "cheapest").map((x) => x.cityTo)).toEqual([
      "Ibiza",
      "Paris",
      "Rome",
    ]);
  });
  it("does not mutate the input", () => {
    const copy = [...deals];
    sortDeals(deals, "cheapest");
    expect(deals).toEqual(copy);
  });
});

describe("monthsOf", () => {
  it("returns distinct months ascending", () => {
    expect(monthsOf(deals)).toEqual(["2026-08", "2026-09"]);
  });
});

describe("filterByMonths", () => {
  it("empty selection returns all", () => {
    expect(filterByMonths(deals, [])).toHaveLength(3);
  });
  it("keeps only deals departing in selected months", () => {
    expect(filterByMonths(deals, ["2026-09"]).map((x) => x.cityTo)).toEqual([
      "Rome",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/sort.test.ts`
Expected: FAIL (cannot find module `@/lib/sort`).

- [ ] **Step 3: Write `src/lib/sort.ts`**

```ts
import type { Deal } from "@/lib/deals";

export type SortKey = "soonest" | "cheapest";

export function sortDeals(deals: Deal[], key: SortKey): Deal[] {
  const arr = [...deals];
  if (key === "cheapest") {
    arr.sort(
      (a, b) => a.price - b.price || a.outDepart.localeCompare(b.outDepart)
    );
  } else {
    arr.sort(
      (a, b) => a.outDepart.localeCompare(b.outDepart) || a.price - b.price
    );
  }
  return arr;
}

export function monthsOf(deals: Deal[]): string[] {
  const set = new Set<string>();
  for (const deal of deals) set.add(deal.outDepart.slice(0, 7));
  return [...set].sort();
}

export function filterByMonths(deals: Deal[], months: string[]): Deal[] {
  if (months.length === 0) return deals;
  const set = new Set(months);
  return deals.filter((deal) => set.has(deal.outDepart.slice(0, 7)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/sort.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sort.ts src/lib/__tests__/sort.test.ts
git commit -m "feat: add deal sort and month-filter helpers"
```

---

### Task 4: SegmentedControl (pill group) component

**Files:**
- Create: `src/components/SegmentedControl.tsx`
- Test: `src/components/__tests__/SegmentedControl.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface SegOption<T extends string | number> { value: T; label: string }`
  - `function SegmentedControl<T extends string | number>(props: { options: SegOption<T>[]; value: T; onChange: (v: T) => void; ariaLabel: string }): JSX.Element` — a row of pill buttons; the selected one has `aria-pressed="true"`; clicking a pill calls `onChange` with its value.

- [ ] **Step 1: Write the failing test `src/components/__tests__/SegmentedControl.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SegmentedControl } from "@/components/SegmentedControl";

describe("SegmentedControl", () => {
  const options = [
    { value: "a", label: "Alpha" },
    { value: "b", label: "Beta" },
  ];

  it("marks the selected option as pressed", () => {
    render(
      <SegmentedControl
        options={options}
        value="b"
        onChange={() => {}}
        ariaLabel="Test"
      />
    );
    expect(screen.getByRole("button", { name: "Beta" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Alpha" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("calls onChange with the clicked value", () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        options={options}
        value="a"
        onChange={onChange}
        ariaLabel="Test"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Beta" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/SegmentedControl.test.tsx`
Expected: FAIL (cannot find module `@/components/SegmentedControl`).

- [ ] **Step 3: Write `src/components/SegmentedControl.tsx`**

```tsx
export interface SegOption<T extends string | number> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex gap-1 rounded-full border border-black/10 dark:border-white/15 p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`rounded-full px-3 py-1 text-sm transition ${
              active
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/SegmentedControl.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/SegmentedControl.tsx src/components/__tests__/SegmentedControl.test.tsx
git commit -m "feat: add SegmentedControl pill component"
```

---

### Task 5: DayBlocks component

**Files:**
- Create: `src/components/DayBlocks.tsx`
- Test: `src/components/__tests__/DayBlocks.test.tsx`

**Interfaces:**
- Consumes: `DayCell` from `@/lib/format`.
- Produces: `function DayBlocks({ cells }: { cells: DayCell[] }): JSX.Element` — a horizontal strip; weekend cells get an accent class; the `depart` cell contains an element with `aria-label="Departure"` and the `return` cell one with `aria-label="Return"`.

- [ ] **Step 1: Write the failing test `src/components/__tests__/DayBlocks.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DayBlocks } from "@/components/DayBlocks";
import type { DayCell } from "@/lib/format";

const cells: DayCell[] = [
  { weekday: "Sat", day: 8, isWeekend: true, role: "depart" },
  { weekday: "Sun", day: 9, isWeekend: true, role: "middle" },
  { weekday: "Mon", day: 10, isWeekend: false, role: "return" },
];

describe("DayBlocks", () => {
  it("renders a cell per day with weekday and day number", () => {
    render(<DayBlocks cells={cells} />);
    expect(screen.getByText("Sat")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("marks departure and return days", () => {
    render(<DayBlocks cells={cells} />);
    expect(screen.getByLabelText("Departure")).toBeInTheDocument();
    expect(screen.getByLabelText("Return")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/DayBlocks.test.tsx`
Expected: FAIL (cannot find module `@/components/DayBlocks`).

- [ ] **Step 3: Write `src/components/DayBlocks.tsx`**

```tsx
import type { DayCell } from "@/lib/format";

export function DayBlocks({ cells }: { cells: DayCell[] }) {
  return (
    <div className="flex gap-1" role="list" aria-label="Trip days">
      {cells.map((c, i) => (
        <div
          key={i}
          role="listitem"
          className={`flex-1 rounded-md px-1 py-1 text-center text-xs ${
            c.isWeekend
              ? "bg-orange-200 text-orange-900 dark:bg-orange-300/30 dark:text-orange-100"
              : "bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60"
          }`}
        >
          <div>{c.weekday}</div>
          <div className="font-medium">{c.day}</div>
          {c.role === "depart" && <div aria-label="Departure">🛫</div>}
          {c.role === "return" && <div aria-label="Return">🛬</div>}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/DayBlocks.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/DayBlocks.tsx src/components/__tests__/DayBlocks.test.tsx
git commit -m "feat: add DayBlocks weekend-strip component"
```

---

### Task 6: Rebuild DealCard as an expandable hybrid card

**Files:**
- Modify: `src/components/DealCard.tsx` (full rewrite)
- Test: `src/components/__tests__/DealCard.test.tsx` (rewrite)

**Interfaces:**
- Consumes: `Deal` (`@/lib/deals`), `dayLabel`/`timeLabel`/`durationLabel`/`dayBlocks` (`@/lib/format`), `DayBlocks` (`@/components/DayBlocks`).
- Produces: `function DealCard({ deal }: { deal: Deal }): JSX.Element` — collapsed by default showing flag/city/country, the day-blocks strip, a one-line time summary, price, and a Book link (`aria-label={`Book ${deal.cityTo}`}`); a toggle button (`aria-expanded`) reveals two explicit flight lines and a time-at-destination pill.

- [ ] **Step 1: Rewrite the failing test `src/components/__tests__/DealCard.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DealCard } from "@/components/DealCard";
import type { Deal } from "@/lib/deals";

const deal: Deal = {
  cityTo: "Ibiza",
  countryTo: "Spain",
  flag: "🇪🇸",
  outDepart: "2026-08-08T21:05:00.000Z",
  outArrive: "2026-08-08T22:10:00.000Z",
  backDepart: "2026-08-10T22:45:00.000Z",
  backArrive: "2026-08-10T23:45:00.000Z",
  stayMinutes: 2915,
  nights: 2,
  price: 37,
  currency: "EUR",
  deepLink: "https://kiwi.com/deep/ibiza",
};

describe("DealCard", () => {
  it("renders city, price, times and a booking link when collapsed", () => {
    render(<DealCard deal={deal} />);
    expect(screen.getByText("Ibiza")).toBeInTheDocument();
    expect(screen.getByText(/37/)).toBeInTheDocument();
    expect(screen.getByText(/22:10/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /book ibiza/i });
    expect(link).toHaveAttribute("href", "https://kiwi.com/deep/ibiza");
  });

  it("hides the flight detail until expanded", () => {
    render(<DealCard deal={deal} />);
    expect(screen.queryByText(/outbound/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByText(/outbound/i)).toBeInTheDocument();
    expect(screen.getByText(/return/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/DealCard.test.tsx`
Expected: FAIL (old DealCard uses `deal.dateOut`; new fields/behavior absent).

- [ ] **Step 3: Rewrite `src/components/DealCard.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { Deal } from "@/lib/deals";
import { dayLabel, timeLabel, durationLabel, dayBlocks } from "@/lib/format";
import { DayBlocks } from "@/components/DayBlocks";

export function DealCard({ deal }: { deal: Deal }) {
  const [open, setOpen] = useState(false);
  const cells = dayBlocks(deal.outDepart, deal.backArrive);
  const stay = durationLabel(deal.stayMinutes);

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex-1 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden>
              {deal.flag}
            </span>
            <span className="font-medium">{deal.cityTo}</span>
            <span className="text-sm opacity-60">{deal.countryTo}</span>
          </div>
          <div className="mt-2">
            <DayBlocks cells={cells} />
          </div>
          <div className="mt-2 text-sm opacity-70">
            Out {dayLabel(deal.outDepart)} {timeLabel(deal.outDepart)} → land{" "}
            {timeLabel(deal.outArrive)} · back {dayLabel(deal.backDepart)}{" "}
            {timeLabel(deal.backDepart)} · {stay} there
          </div>
        </button>
        <div className="text-right shrink-0">
          <div className="text-lg font-semibold">
            {deal.price} {deal.currency}
          </div>
          <a
            href={deal.deepLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Book ${deal.cityTo}`}
            className="text-sm underline"
          >
            Book
          </a>
        </div>
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-1 border-t border-black/10 pt-3 text-sm dark:border-white/10">
          <div>
            Outbound · {dayLabel(deal.outDepart)} {timeLabel(deal.outDepart)} →{" "}
            {deal.cityTo} {timeLabel(deal.outArrive)}
          </div>
          <div>
            Return · {dayLabel(deal.backDepart)} {timeLabel(deal.backDepart)} →
            home {timeLabel(deal.backArrive)}
          </div>
          <div>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-900 dark:bg-green-300/20 dark:text-green-100">
              ≈ {stay} in {deal.cityTo}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/DealCard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/DealCard.tsx src/components/__tests__/DealCard.test.tsx
git commit -m "feat: rebuild DealCard as expandable hybrid card"
```

---

### Task 7: MonthFilter component

**Files:**
- Create: `src/components/MonthFilter.tsx`
- Test: `src/components/__tests__/MonthFilter.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `function MonthFilter(props: { months: string[]; selected: string[]; onToggle: (m: string) => void; onClear: () => void }): JSX.Element | null` — returns `null` when `months` is empty; otherwise an "All" pill (pressed when `selected` is empty, clears on click) plus one pill per `YYYY-MM` labeled with its short month name (`"Aug"`), pressed when in `selected`, calling `onToggle(ym)` on click.

- [ ] **Step 1: Write the failing test `src/components/__tests__/MonthFilter.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MonthFilter } from "@/components/MonthFilter";

describe("MonthFilter", () => {
  it("renders nothing when there are no months", () => {
    const { container } = render(
      <MonthFilter months={[]} selected={[]} onToggle={() => {}} onClear={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("labels months and marks All pressed when nothing is selected", () => {
    render(
      <MonthFilter
        months={["2026-08", "2026-09"]}
        selected={[]}
        onToggle={() => {}}
        onClear={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: "Aug" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sep" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("toggles a month on click", () => {
    const onToggle = vi.fn();
    render(
      <MonthFilter
        months={["2026-08", "2026-09"]}
        selected={["2026-08"]}
        onToggle={onToggle}
        onClear={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: "Aug" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: "Sep" }));
    expect(onToggle).toHaveBeenCalledWith("2026-09");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/MonthFilter.test.tsx`
Expected: FAIL (cannot find module `@/components/MonthFilter`).

- [ ] **Step 3: Write `src/components/MonthFilter.tsx`**

```tsx
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function monthName(ym: string): string {
  const m = Number(ym.slice(5, 7));
  return MONTH_NAMES[m - 1] ?? ym;
}

function pillClass(active: boolean): string {
  return `rounded-full px-3 py-1 text-sm transition ${
    active
      ? "bg-black text-white dark:bg-white dark:text-black"
      : "text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10 border border-black/10 dark:border-white/15"
  }`;
}

export function MonthFilter({
  months,
  selected,
  onToggle,
  onClear,
}: {
  months: string[];
  selected: string[];
  onToggle: (m: string) => void;
  onClear: () => void;
}) {
  if (months.length === 0) return null;
  const sel = new Set(selected);
  return (
    <div role="group" aria-label="Month filter" className="flex flex-wrap gap-1">
      <button
        type="button"
        aria-pressed={selected.length === 0}
        onClick={onClear}
        className={pillClass(selected.length === 0)}
      >
        All
      </button>
      {months.map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={sel.has(m)}
          onClick={() => onToggle(m)}
          className={pillClass(sel.has(m))}
        >
          {monthName(m)}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/MonthFilter.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/MonthFilter.tsx src/components/__tests__/MonthFilter.test.tsx
git commit -m "feat: add MonthFilter pill component"
```

---

### Task 8: DealList empty-message prop

**Files:**
- Modify: `src/components/DealList.tsx`
- Test: `src/components/__tests__/DealList.test.tsx` (extend)

**Interfaces:**
- Consumes: `Deal` (`@/lib/deals`), `DealCard`.
- Produces: `function DealList(props: { deals: Deal[]; loading: boolean; error: string | null; emptyMessage?: string }): JSX.Element` — same loading/error behavior; when `deals` is empty it renders `emptyMessage` if provided, else the default copy. Card `key` uses `deal.outDepart`.

- [ ] **Step 1: Extend the failing test `src/components/__tests__/DealList.test.tsx`**

Add this test inside the existing `describe("DealList", ...)` block:

```tsx
  it("shows a custom empty message when provided", () => {
    render(
      <DealList
        deals={[]}
        loading={false}
        error={null}
        emptyMessage="No deals in the selected months"
      />
    );
    expect(
      screen.getByText("No deals in the selected months")
    ).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/DealList.test.tsx`
Expected: FAIL (the custom message is not rendered).

- [ ] **Step 3: Rewrite `src/components/DealList.tsx`**

```tsx
import type { Deal } from "@/lib/deals";
import { DealCard } from "@/components/DealCard";

export function DealList({
  deals,
  loading,
  error,
  emptyMessage,
}: {
  deals: Deal[];
  loading: boolean;
  error: string | null;
  emptyMessage?: string;
}) {
  if (loading) return <p className="opacity-70">Searching for escapes…</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (deals.length === 0)
    return (
      <p className="opacity-70">
        {emptyMessage ??
          "No weekend escapes found — try the Loose style or a longer timeline."}
      </p>
    );

  return (
    <div className="flex flex-col gap-3">
      {deals.map((deal, i) => (
        <DealCard key={`${deal.cityTo}-${deal.outDepart}-${i}`} deal={deal} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/DealList.test.tsx`
Expected: PASS (existing tests + the new one).

- [ ] **Step 5: Commit**

```bash
git add src/components/DealList.tsx src/components/__tests__/DealList.test.tsx
git commit -m "feat: support a custom empty message in DealList"
```

---

### Task 9: Rebuild the home page — auto-search, pills, filter, sort

**Files:**
- Modify: `src/app/page.tsx` (full rewrite)
- Test: `src/app/__tests__/page.test.tsx` (rewrite)

**Interfaces:**
- Consumes: `WeekendStyle` (`@/lib/weekend`), `Deal` (`@/lib/deals`), `SortKey`/`sortDeals`/`monthsOf`/`filterByMonths` (`@/lib/sort`), `loadHome`/`saveHome` (`@/lib/home-storage`), `SegmentedControl` (`@/components/SegmentedControl`), `MonthFilter` (`@/components/MonthFilter`), `DealList` (`@/components/DealList`).
- Produces: the default-exported `Home` client component: on mount geolocates → `/api/airports` → sets home → searches; falls back to a saved home airport when geolocation is denied/unavailable; pill controls for style/timeline/sort; a month filter; results derived client-side (`filterByMonths` → `sortDeals`) with no refetch on sort/month change.

- [ ] **Step 1: Rewrite the failing test `src/app/__tests__/page.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Home from "@/app/page";

const ibiza = {
  cityTo: "Ibiza",
  countryTo: "Spain",
  flag: "🇪🇸",
  outDepart: "2026-08-08T21:05:00.000Z",
  outArrive: "2026-08-08T22:10:00.000Z",
  backDepart: "2026-08-10T22:45:00.000Z",
  backArrive: "2026-08-10T23:45:00.000Z",
  stayMinutes: 2915,
  nights: 2,
  price: 37,
  currency: "EUR",
  deepLink: "https://kiwi.com/deep/ibiza",
};
const rome = {
  ...ibiza,
  cityTo: "Rome",
  countryTo: "Italy",
  flag: "🇮🇹",
  outDepart: "2026-09-05T07:00:00.000Z",
  outArrive: "2026-09-05T09:00:00.000Z",
  backDepart: "2026-09-06T20:00:00.000Z",
  backArrive: "2026-09-06T22:00:00.000Z",
  price: 25,
  deepLink: "https://kiwi.com/deep/rome",
};

function mockFetch() {
  return vi.fn(async (url: string) => {
    if (url.includes("/api/airports")) {
      return {
        ok: true,
        json: async () => ({ airports: [{ code: "BCN" }] }),
      } as Response;
    }
    return {
      ok: true,
      json: async () => ({ deals: [ibiza, rome] }),
    } as Response;
  });
}

function grantGeolocation(lat = 41.4, lon = 2.1) {
  Object.defineProperty(global.navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (success: (p: any) => void) =>
        success({ coords: { latitude: lat, longitude: lon } }),
    },
  });
}

function denyGeolocation() {
  Object.defineProperty(global.navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (_s: unknown, error: (e: any) => void) =>
        error({ code: 1 }),
    },
  });
}

describe("Home page", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("auto-searches via geolocation on mount and renders deals", async () => {
    grantGeolocation();
    const fetchMock = mockFetch();
    vi.spyOn(global, "fetch").mockImplementation(fetchMock as any);

    render(<Home />);

    await waitFor(() => expect(screen.getByText("Ibiza")).toBeInTheDocument());
    const airportsCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("/api/airports")
    );
    const weekendsCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("/api/weekends")
    );
    expect(airportsCalls.length).toBe(1);
    expect(weekendsCalls.length).toBe(1);
    expect(String(weekendsCalls[0][0])).toContain("flyFrom=BCN");
  });

  it("re-sorts client-side without a new weekends fetch", async () => {
    grantGeolocation();
    const fetchMock = mockFetch();
    vi.spyOn(global, "fetch").mockImplementation(fetchMock as any);

    render(<Home />);
    await waitFor(() => expect(screen.getByText("Ibiza")).toBeInTheDocument());

    const before = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("/api/weekends")
    ).length;
    fireEvent.click(screen.getByRole("button", { name: /cheapest/i }));
    const after = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("/api/weekends")
    ).length;
    expect(after).toBe(before);
  });

  it("falls back to the saved home airport when geolocation is denied", async () => {
    localStorage.setItem("weekendescape:home", "MAD");
    denyGeolocation();
    const fetchMock = mockFetch();
    vi.spyOn(global, "fetch").mockImplementation(fetchMock as any);

    render(<Home />);
    await waitFor(() => expect(screen.getByText("Ibiza")).toBeInTheDocument());
    const weekendsCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("/api/weekends")
    );
    expect(weekendsCalls.length).toBe(1);
    expect(String(weekendsCalls[0][0])).toContain("flyFrom=MAD");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/__tests__/page.test.tsx`
Expected: FAIL (page still has Search button / dropdowns, no auto-search).

- [ ] **Step 3: Rewrite `src/app/page.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WeekendStyle } from "@/lib/weekend";
import type { Deal } from "@/lib/deals";
import { type SortKey, sortDeals, monthsOf, filterByMonths } from "@/lib/sort";
import { loadHome, saveHome } from "@/lib/home-storage";
import { SegmentedControl } from "@/components/SegmentedControl";
import { MonthFilter } from "@/components/MonthFilter";
import { DealList } from "@/components/DealList";

const STYLE_OPTIONS = [
  { value: "strict" as WeekendStyle, label: "Strict" },
  { value: "frimon" as WeekendStyle, label: "Fri–Mon" },
  { value: "loose" as WeekendStyle, label: "Loose" },
];
const MONTH_OPTIONS = [
  { value: 1, label: "1m" },
  { value: 2, label: "2m" },
  { value: 3, label: "3m" },
  { value: 6, label: "6m" },
];
const SORT_OPTIONS = [
  { value: "soonest" as SortKey, label: "Soonest" },
  { value: "cheapest" as SortKey, label: "Cheapest" },
];

export default function Home() {
  const [home, setHome] = useState("");
  const [style, setStyle] = useState<WeekendStyle>("frimon");
  const [months, setMonths] = useState(3);
  const [sort, setSort] = useState<SortKey>("soonest");
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [rawDeals, setRawDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const bootstrapped = useRef(false);

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
        style,
        months: String(months),
      });
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

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    const fallback = () => {
      const saved = loadHome();
      if (saved) runSearch(saved);
    };

    if (!navigator.geolocation) {
      fallback();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
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
      },
      fallback
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!bootstrapped.current || !home) return;
    runSearch(home);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, months]);

  const available = useMemo(() => monthsOf(rawDeals), [rawDeals]);
  const visible = useMemo(
    () => sortDeals(filterByMonths(rawDeals, selectedMonths), sort),
    [rawDeals, selectedMonths, sort]
  );

  function toggleMonth(m: string) {
    setSelectedMonths((cur) =>
      cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]
    );
  }

  return (
    <main className="max-w-2xl mx-auto p-6 flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold">Weekend Escape</h1>
        <p className="opacity-70">The cheapest weekend getaways from home.</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={home}
          onChange={(e) => setHome(e.target.value)}
          onBlur={() => runSearch(home)}
          onKeyDown={(e) => {
            if (e.key === "Enter") runSearch(home);
          }}
          placeholder="Home airport (e.g. BCN)"
          className="w-40 rounded-lg border border-black/15 dark:border-white/15 px-3 py-2 bg-transparent"
        />
        <SegmentedControl
          options={STYLE_OPTIONS}
          value={style}
          onChange={setStyle}
          ariaLabel="Weekend style"
        />
        <SegmentedControl
          options={MONTH_OPTIONS}
          value={months}
          onChange={setMonths}
          ariaLabel="Timeline"
        />
        <SegmentedControl
          options={SORT_OPTIONS}
          value={sort}
          onChange={setSort}
          ariaLabel="Sort"
        />
      </div>

      {available.length > 0 && (
        <MonthFilter
          months={available}
          selected={selectedMonths}
          onToggle={toggleMonth}
          onClear={() => setSelectedMonths([])}
        />
      )}

      {searched && (
        <DealList
          deals={visible}
          loading={loading}
          error={error}
          emptyMessage={
            selectedMonths.length > 0
              ? "No deals in the selected months."
              : undefined
          }
        />
      )}
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/__tests__/page.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full suite and build**

Run: `npm test && npm run build`
Expected: all tests pass; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/app/__tests__/page.test.tsx
git commit -m "feat: auto-search home page with pills, month filter, and sort"
```

---

## Notes for the implementer

- Tasks 1–3 are pure logic (deterministic, no network). Tasks 4–8 are components under jsdom. Task 9 wires everything with mocked geolocation + fetch.
- The `Deal` shape change in Task 1 is why the weekends route test mock gains `local_arrival` (Step 4) — without it the enriched normalizer would skip the deal and that route test would fail.
- Do NOT use `new Date(iso)` on the Kiwi timestamps anywhere — parse the string fields (as `format.ts` and `deals.ts` do) so times stay wall-clock.
- Manual check after Task 9 (needs the live key already in `.env.local`): `npm run dev`, open the app — it should geolocate, auto-list deals with day-blocks, expand on click, filter by month, and toggle sort without a network refetch.
```
