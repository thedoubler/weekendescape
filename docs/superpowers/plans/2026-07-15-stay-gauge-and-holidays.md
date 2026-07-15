# Stay Gauge, Arrival Clarity & Holidays Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show how much usable time a traveller actually gets (a per-day "stay gauge"), mark red-eye/late flights, show the origin airport, and badge home-country (PTO-saving) and destination public holidays.

**Architecture:** Enrich each deal with airport + country codes; rework `dayBlocks` to model the destination stay (`outArrive`→`backDepart`) with a usable-fraction gauge per day plus red-eye helpers; enrich the `/api/weekends` route with holiday data (Nager.Date, cached) and lock the round-trip to the same airports; render the gauge, origin chip, red-eye markers, and holiday badges in the card.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind v4, Vitest + @testing-library/react (jsdom). External: Nager.Date public-holiday API (no key).

## Global Constraints

- Project root `/Users/raul/Projects/samples/weekendescape`; source under `src/`; alias `@/*`→`src/`.
- Kiwi `local_*` timestamps are local wall-clock: parse the string's own fields, never `new Date(iso)`.
- Gauge day span = `outArrive`→`backDepart` (time actually at the destination).
- Night/awkward hour = local hour `>= 22 || < 7`. `+1` only when a flight leg's arrival date > its departure date.
- Holidays: home country (PTO framing) AND destination country (context), fetched from `https://date.nager.at/api/v3/publicholidays/{year}/{CC}`, `next: { revalidate: 86400 }`, 404/error → `[]`. Holiday enrichment must never fail the search.
- New accent: amber for holiday badges only; red-eye uses an ink moon glyph (no new warning color).
- Test framework: Vitest. One file: `npx vitest run <path>`. Full suite `npm test`; build `npm run build`.
- Commit after each task. Full build/suite goes green at the final task (intermediate tasks may leave unrelated component/tests temporarily failing — run only the files each task touches until the last task).
- Canonical enriched `Deal` (used verbatim across tasks):
  ```
  { cityTo, countryTo, flag, flyFrom, flyTo, countryFromCode, countryToCode,
    outDepart, outArrive, backDepart, backArrive, stayMinutes, nights, price,
    currency, deepLink, ptoDays?, homeHoliday?, destHoliday? }
  ```

---

### Task 1: Add airport + country codes to the Deal model

**Files:**
- Modify: `src/lib/deals.ts`
- Test: `src/lib/__tests__/deals.test.ts`
- Modify: `src/app/api/weekends/__tests__/route.test.ts` (add codes to the mock item)
- Modify: `src/lib/__tests__/sort.test.ts` (add codes to the `d()` fixture helper)

**Interfaces:**
- Produces:
  - `interface HolidayRef { date: string; name: string }`
  - `Deal` gains `flyFrom: string; flyTo: string; countryFromCode: string; countryToCode: string;` and optional `ptoDays?: number; homeHoliday?: HolidayRef | null; destHoliday?: HolidayRef | null;`
  - `normalizeDeals` extracts `flyFrom`/`flyTo` (item.flyFrom/flyTo) and `countryFromCode`/`countryToCode` (item.countryFrom.code / item.countryTo.code); skips items missing `flyFrom` or `flyTo`.

- [ ] **Step 1: Update the failing test `src/lib/__tests__/deals.test.ts`**

Replace the two mock items' objects to include codes, and update the expected object. In the `raw` fixture, add to the **Ibiza** item (and analogously give Lisbon codes): `flyFrom`, `flyTo`, `countryFrom`. Set the whole `describe("normalizeDeals", ...)` body to:

```ts
describe("normalizeDeals", () => {
  const raw = {
    data: [
      {
        cityTo: "Lisbon",
        flyFrom: "BCN",
        flyTo: "LIS",
        countryFrom: { code: "ES", name: "Spain" },
        countryTo: { code: "PT", name: "Portugal" },
        price: 89,
        deep_link: "https://kiwi.com/deep/lisbon",
        nightsInDest: 2,
        route: [
          { local_departure: "2026-08-21T18:00:00.000Z", local_arrival: "2026-08-21T20:00:00.000Z", return: 0 },
          { local_departure: "2026-08-23T20:00:00.000Z", local_arrival: "2026-08-23T22:00:00.000Z", return: 1 },
        ],
      },
      {
        cityTo: "Ibiza",
        flyFrom: "BCN",
        flyTo: "IBZ",
        countryFrom: { code: "ES", name: "Spain" },
        countryTo: { code: "ES", name: "Spain" },
        price: 37,
        deep_link: "https://kiwi.com/deep/ibiza",
        nightsInDest: 2,
        route: [
          { local_departure: "2026-08-08T21:05:00.000Z", local_arrival: "2026-08-08T22:10:00.000Z", return: 0 },
          { local_departure: "2026-08-10T22:45:00.000Z", local_arrival: "2026-08-10T23:45:00.000Z", return: 1 },
        ],
      },
    ],
  };

  it("extracts airport + country codes and all four times, sorted by price", () => {
    const deals = normalizeDeals(raw, "EUR");
    expect(deals).toHaveLength(2);
    expect(deals[0]).toEqual({
      cityTo: "Ibiza",
      countryTo: "Spain",
      flag: "🇪🇸",
      flyFrom: "BCN",
      flyTo: "IBZ",
      countryFromCode: "ES",
      countryToCode: "ES",
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
    expect(deals[1].flyTo).toBe("LIS");
  });

  it("returns an empty array when data is missing", () => {
    expect(normalizeDeals({}, "EUR")).toEqual([]);
    expect(normalizeDeals(null, "EUR")).toEqual([]);
  });

  it("skips items missing airport codes", () => {
    const bad = {
      data: [
        {
          cityTo: "Nowhere",
          countryTo: { code: "XX", name: "" },
          price: 10,
          deep_link: "x",
          route: [
            { local_departure: "2026-08-08T21:05:00.000Z", local_arrival: "2026-08-08T22:10:00.000Z", return: 0 },
            { local_departure: "2026-08-10T22:45:00.000Z", local_arrival: "2026-08-10T23:45:00.000Z", return: 1 },
          ],
        },
      ],
    };
    expect(normalizeDeals(bad, "EUR")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/deals.test.ts`
Expected: FAIL (result lacks `flyFrom`/`flyTo`/country codes).

- [ ] **Step 3: Edit `src/lib/deals.ts`**

Add the `HolidayRef` export and the new fields to `Deal`, and extract them in `normalizeDeals`. Replace the interface block:

```ts
export interface HolidayRef {
  date: string;
  name: string;
}

export interface Deal {
  cityTo: string;
  countryTo: string;
  flag: string;
  flyFrom: string;
  flyTo: string;
  countryFromCode: string;
  countryToCode: string;
  outDepart: string;
  outArrive: string;
  backDepart: string;
  backArrive: string;
  stayMinutes: number;
  nights: number;
  price: number;
  currency: string;
  deepLink: string;
  ptoDays?: number;
  homeHoliday?: HolidayRef | null;
  destHoliday?: HolidayRef | null;
}
```

In `normalizeDeals`, after `const deepLink = item?.deep_link;`, add:

```ts
    const flyFrom = item?.flyFrom;
    const flyTo = item?.flyTo;
```

Extend the skip condition to also require them:

```ts
    if (
      !cityTo ||
      typeof price !== "number" ||
      !deepLink ||
      !flyFrom ||
      !flyTo ||
      !outDepart ||
      !outArrive ||
      !backDepart ||
      !backArrive
    ) {
      continue;
    }
```

And in the pushed object, add after `flag: ...`:

```ts
      flyFrom,
      flyTo,
      countryFromCode: item?.countryFrom?.code ?? "",
      countryToCode: item?.countryTo?.code ?? "",
```

- [ ] **Step 4: Update `src/app/api/weekends/__tests__/route.test.ts` mock item**

In the mocked Rome deal object (inside `axios.get` mockResolvedValue), add these fields alongside `cityTo`:

```ts
        flyFrom: "BCN",
        flyTo: "FCO",
        countryFrom: { code: "ES", name: "Spain" },
```

(`countryTo: { code: "IT", name: "Italy" }` is already present.)

- [ ] **Step 5: Update the `d()` fixture helper in `src/lib/__tests__/sort.test.ts`**

In the `d(...)` helper's returned object, add these fields (any placeholder codes are fine — sort logic ignores them):

```ts
    flyFrom: "BCN",
    flyTo: "XXX",
    countryFromCode: "ES",
    countryToCode: "XX",
```

- [ ] **Step 6: Run the affected tests**

Run: `npx vitest run src/lib/__tests__/deals.test.ts src/lib/__tests__/sort.test.ts src/app/api/weekends/__tests__/route.test.ts`
Expected: PASS (deals 5, sort 6, weekends route 6).

- [ ] **Step 7: Commit**

```bash
git add src/lib/deals.ts src/lib/__tests__/deals.test.ts src/lib/__tests__/sort.test.ts src/app/api/weekends/__tests__/route.test.ts
git commit -m "feat: add airport and country codes to the Deal model"
```

---

### Task 2: Stay-gauge + red-eye helpers

**Files:**
- Modify: `src/lib/format.ts`
- Test: `src/lib/__tests__/format.test.ts`

**Interfaces:**
- Produces:
  - `DayCell` gains `role: "arrive" | "leave" | "middle" | "solo"; fillStart: number; fillEnd: number;` (keeps `weekday, day, month, isWeekend`).
  - `dayBlocks(outArrive: string, backDepart: string): DayCell[]` — one cell per day of the destination stay; `fillStart`/`fillEnd` are the usable fraction (0..1) of that day.
  - `crossesMidnight(depIso: string, arrIso: string): boolean` — arrival calendar day after departure's.
  - `isNightHour(iso: string): boolean` — local hour `>= 22 || < 7`.
  - `dayLabel`/`timeLabel`/`durationLabel`/`daysUntil` unchanged.

- [ ] **Step 1: Update the failing test `src/lib/__tests__/format.test.ts`**

Replace the whole `describe("dayBlocks", ...)` block and add two describes:

```ts
describe("dayBlocks", () => {
  it("models the stay with a usable-time gauge per day", () => {
    const cells = dayBlocks(
      "2026-08-08T08:20:00.000Z", // land Sat 08:20
      "2026-08-10T19:05:00.000Z"  // leave Mon 19:05
    );
    expect(cells).toHaveLength(3);
    expect(cells[0]).toMatchObject({ weekday: "Sat", day: 8, month: "Aug", isWeekend: true, role: "arrive" });
    expect(cells[0].fillStart).toBeCloseTo(8.3333 / 24, 3);
    expect(cells[0].fillEnd).toBe(1);
    expect(cells[1]).toMatchObject({ day: 9, role: "middle", fillStart: 0, fillEnd: 1 });
    expect(cells[2]).toMatchObject({ weekday: "Mon", day: 10, role: "leave", fillStart: 0 });
    expect(cells[2].fillEnd).toBeCloseTo(19.0833 / 24, 3);
  });

  it("shows sliver gauges for a red-eye stay", () => {
    const cells = dayBlocks(
      "2026-08-08T23:40:00.000Z", // land Sat 23:40
      "2026-08-10T06:00:00.000Z"  // leave Mon 06:00
    );
    expect(cells[0].fillStart).toBeCloseTo(23.6667 / 24, 3); // tiny usable slice
    expect(cells[2].fillEnd).toBeCloseTo(6 / 24, 3);
  });

  it("produces one solo cell for a same-day stay", () => {
    const cells = dayBlocks("2026-08-08T09:00:00.000Z", "2026-08-08T20:00:00.000Z");
    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({ role: "solo" });
    expect(cells[0].fillStart).toBeCloseTo(9 / 24, 3);
    expect(cells[0].fillEnd).toBeCloseTo(20 / 24, 3);
  });

  it("returns empty on bad input", () => {
    expect(dayBlocks("x", "y")).toEqual([]);
  });
});

describe("crossesMidnight", () => {
  it("is true when arrival is on a later calendar day", () => {
    expect(crossesMidnight("2026-08-08T23:30:00.000Z", "2026-08-09T01:00:00.000Z")).toBe(true);
    expect(crossesMidnight("2026-08-08T21:05:00.000Z", "2026-08-08T22:10:00.000Z")).toBe(false);
  });
});

describe("isNightHour", () => {
  it("flags late-night and early-morning local hours", () => {
    expect(isNightHour("2026-08-08T23:40:00.000Z")).toBe(true);
    expect(isNightHour("2026-08-08T06:00:00.000Z")).toBe(true);
    expect(isNightHour("2026-08-08T08:20:00.000Z")).toBe(false);
    expect(isNightHour("2026-08-08T19:05:00.000Z")).toBe(false);
  });
});
```

Also update the import line at the top of the file to include the new names:

```ts
import {
  dayLabel,
  timeLabel,
  durationLabel,
  daysUntil,
  dayBlocks,
  crossesMidnight,
  isNightHour,
} from "@/lib/format";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/format.test.ts`
Expected: FAIL (`crossesMidnight`/`isNightHour` undefined; new `dayBlocks` shape).

- [ ] **Step 3: Edit `src/lib/format.ts`**

Replace the `DayCell` interface and the `dayBlocks` function, and add the two helpers. First the interface:

```ts
export interface DayCell {
  weekday: string;
  day: number;
  month: string;
  isWeekend: boolean;
  role: "arrive" | "leave" | "middle" | "solo";
  fillStart: number;
  fillEnd: number;
}
```

Add near the other helpers:

```ts
function hourFrac(p: { h: number; mi: number }): number {
  return (p.h + p.mi / 60) / 24;
}

export function crossesMidnight(depIso: string, arrIso: string): boolean {
  const d = parts(depIso);
  const a = parts(arrIso);
  if (!d || !a) return false;
  return Date.UTC(a.y, a.mo - 1, a.d) > Date.UTC(d.y, d.mo - 1, d.d);
}

export function isNightHour(iso: string): boolean {
  const p = parts(iso);
  if (!p) return false;
  return p.h >= 22 || p.h < 7;
}
```

Replace `dayBlocks` with:

```ts
export function dayBlocks(outArrive: string, backDepart: string): DayCell[] {
  const a = parts(outArrive);
  const b = parts(backDepart);
  if (!a || !b) return [];
  const DAY = 86400000;
  const start = Date.UTC(a.y, a.mo - 1, a.d);
  const end = Date.UTC(b.y, b.mo - 1, b.d);
  const n = Math.round((end - start) / DAY);
  if (n < 0 || n > 30) return [];
  const aFrac = hourFrac(a);
  const bFrac = hourFrac(b);
  const cells: DayCell[] = [];
  for (let i = 0; i <= n; i++) {
    const dt = new Date(start + i * DAY);
    const wd = dt.getUTCDay();
    let role: DayCell["role"];
    let fillStart = 0;
    let fillEnd = 1;
    if (n === 0) {
      role = "solo";
      fillStart = aFrac;
      fillEnd = bFrac;
    } else if (i === 0) {
      role = "arrive";
      fillStart = aFrac;
      fillEnd = 1;
    } else if (i === n) {
      role = "leave";
      fillStart = 0;
      fillEnd = bFrac;
    } else {
      role = "middle";
    }
    cells.push({
      weekday: WD[wd],
      day: dt.getUTCDate(),
      month: MO[dt.getUTCMonth()],
      isWeekend: wd === 0 || wd === 6,
      role,
      fillStart,
      fillEnd,
    });
  }
  return cells;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/format.test.ts`
Expected: PASS (dayBlocks 4, crossesMidnight 1, isNightHour 1, plus the untouched dayLabel/timeLabel/durationLabel/daysUntil describes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/__tests__/format.test.ts
git commit -m "feat: rework dayBlocks into a stay gauge + add red-eye helpers"
```

---

### Task 3: Holiday helpers (`holidays.ts`)

**Files:**
- Create: `src/lib/holidays.ts`
- Test: `src/lib/__tests__/holidays.test.ts`

**Interfaces:**
- Consumes: `HolidayRef` is not imported here (uses a local `Holiday` shape `{ date, name }`).
- Produces:
  - `interface Holiday { date: string; name: string }`
  - `async function fetchHolidays(countryCode: string, year: number): Promise<Holiday[]>`
  - `function tripWorkdays(outArrive: string, backDepart: string): string[]` — distinct `YYYY-MM-DD` for each Mon–Fri in the inclusive span.
  - `interface DealHolidayInfo { ptoDays: number; homeHoliday: Holiday | null; destHoliday: Holiday | null }`
  - `function annotate(outArrive: string, backDepart: string, homeHolidays: Holiday[], destHolidays: Holiday[]): DealHolidayInfo`

- [ ] **Step 1: Write the failing test `src/lib/__tests__/holidays.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchHolidays, tripWorkdays, annotate } from "@/lib/holidays";

describe("fetchHolidays", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("maps Nager JSON to {date, name} using localName", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        { date: "2026-08-15", localName: "Ferragosto", name: "Assumption Day" },
      ],
    } as Response);
    expect(await fetchHolidays("it", 2026)).toEqual([
      { date: "2026-08-15", name: "Ferragosto" },
    ]);
  });

  it("returns [] on a 404 or error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await fetchHolidays("zz", 2026)).toEqual([]);
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network"));
    expect(await fetchHolidays("es", 2026)).toEqual([]);
  });
});

describe("tripWorkdays", () => {
  it("returns Mon-Fri days in the inclusive span", () => {
    // Fri 2026-08-07 .. Mon 2026-08-10 -> Fri + Mon (Sat/Sun excluded)
    expect(
      tripWorkdays("2026-08-07T20:00:00.000Z", "2026-08-10T06:00:00.000Z")
    ).toEqual(["2026-08-07", "2026-08-10"]);
  });
});

describe("annotate", () => {
  const outArrive = "2026-08-07T20:00:00.000Z"; // Fri
  const backDepart = "2026-08-10T06:00:00.000Z"; // Mon

  it("counts PTO and picks the home holiday that lands on a workday", () => {
    const home = [
      { date: "2026-08-07", name: "Friday Holiday" },
      { date: "2026-08-10", name: "Monday Holiday" },
    ];
    const info = annotate(outArrive, backDepart, home, []);
    expect(info.ptoDays).toBe(0);
    expect(info.homeHoliday).toEqual({ date: "2026-08-07", name: "Friday Holiday" });
    expect(info.destHoliday).toBeNull();
  });

  it("detects a destination holiday anywhere in the span (incl weekend)", () => {
    const dest = [{ date: "2026-08-08", name: "Ferragosto" }]; // Saturday
    const info = annotate(outArrive, backDepart, [], dest);
    expect(info.ptoDays).toBe(2); // Fri + Mon, neither is a home holiday
    expect(info.homeHoliday).toBeNull();
    expect(info.destHoliday).toEqual({ date: "2026-08-08", name: "Ferragosto" });
  });

  it("returns nulls when there are no matching holidays", () => {
    const info = annotate(outArrive, backDepart, [], []);
    expect(info).toEqual({ ptoDays: 2, homeHoliday: null, destHoliday: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/holidays.test.ts`
Expected: FAIL (cannot find module `@/lib/holidays`).

- [ ] **Step 3: Write `src/lib/holidays.ts`**

```ts
export interface Holiday {
  date: string;
  name: string;
}

export interface DealHolidayInfo {
  ptoDays: number;
  homeHoliday: Holiday | null;
  destHoliday: Holiday | null;
}

export async function fetchHolidays(
  countryCode: string,
  year: number
): Promise<Holiday[]> {
  try {
    const res = await fetch(
      `https://date.nager.at/api/v3/publicholidays/${year}/${countryCode.toUpperCase()}`,
      { next: { revalidate: 86400 } } as RequestInit
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .map((h: { date?: string; localName?: string; name?: string }) => ({
        date: h.date ?? "",
        name: h.localName || h.name || "",
      }))
      .filter((h: Holiday) => /^\d{4}-\d{2}-\d{2}$/.test(h.date));
  } catch {
    return [];
  }
}

function allDates(outArrive: string, backDepart: string): string[] {
  const a = outArrive.slice(0, 10);
  const b = backDepart.slice(0, 10);
  const pa = /^(\d{4})-(\d{2})-(\d{2})$/.exec(a);
  const pb = /^(\d{4})-(\d{2})-(\d{2})$/.exec(b);
  if (!pa || !pb) return [];
  const DAY = 86400000;
  const start = Date.UTC(+pa[1], +pa[2] - 1, +pa[3]);
  const end = Date.UTC(+pb[1], +pb[2] - 1, +pb[3]);
  if (end < start || (end - start) / DAY > 30) return [];
  const out: string[] = [];
  for (let t = start; t <= end; t += DAY) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

export function tripWorkdays(outArrive: string, backDepart: string): string[] {
  return allDates(outArrive, backDepart).filter((d) => {
    const wd = new Date(`${d}T00:00:00.000Z`).getUTCDay();
    return wd >= 1 && wd <= 5;
  });
}

export function annotate(
  outArrive: string,
  backDepart: string,
  homeHolidays: Holiday[],
  destHolidays: Holiday[]
): DealHolidayInfo {
  const workdays = tripWorkdays(outArrive, backDepart);
  const homeByDate = new Map(homeHolidays.map((h) => [h.date, h]));
  const ptoDays = workdays.filter((d) => !homeByDate.has(d)).length;
  const homeHoliday =
    workdays.map((d) => homeByDate.get(d)).find(Boolean) ?? null;

  const span = allDates(outArrive, backDepart);
  const destByDate = new Map(destHolidays.map((h) => [h.date, h]));
  const destHoliday = span.map((d) => destByDate.get(d)).find(Boolean) ?? null;

  return { ptoDays, homeHoliday, destHoliday };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/holidays.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/holidays.ts src/lib/__tests__/holidays.test.ts
git commit -m "feat: add Nager.Date holiday fetch, workday, and annotate helpers"
```

---

### Task 4: Route — same-airport lock + holiday enrichment

**Files:**
- Modify: `src/app/api/weekends/route.ts`
- Test: `src/app/api/weekends/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `normalizeDeals` (Task 1), `fetchHolidays`/`annotate` (Task 3).
- Produces: `/api/weekends` sends `ret_from_diff_airport: false` and `ret_to_diff_airport: false`; each returned deal carries `ptoDays`, `homeHoliday`, `destHoliday`.

- [ ] **Step 1: Add the failing assertions to `src/app/api/weekends/__tests__/route.test.ts`**

At the top of the file, add a mock of the holidays module (keeps the real `annotate`, stubs the network `fetchHolidays`):

```ts
vi.mock("@/lib/holidays", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/holidays")>();
  return {
    ...actual,
    fetchHolidays: vi.fn(async () => [{ date: "2026-09-05", name: "Test Holiday" }]),
  };
});
```

In the existing "calls Tequila with mapped params" test, after the current `params` assertions, add:

```ts
    expect(params.ret_from_diff_airport).toBe(false);
    expect(params.ret_to_diff_airport).toBe(false);
```

Add a new test inside the `describe`:

```ts
  it("enriches deals with holiday info", async () => {
    (axios.get as any).mockResolvedValue({
      status: 200,
      data: {
        data: [
          {
            cityTo: "Rome",
            flyFrom: "BCN",
            flyTo: "FCO",
            countryFrom: { code: "ES", name: "Spain" },
            countryTo: { code: "IT", name: "Italy" },
            price: 55,
            deep_link: "https://kiwi.com/deep/rome",
            nightsInDest: 1,
            route: [
              { local_departure: "2026-09-05T07:30:00.000Z", local_arrival: "2026-09-05T09:00:00.000Z", return: 0 },
              { local_departure: "2026-09-06T21:00:00.000Z", local_arrival: "2026-09-06T22:30:00.000Z", return: 1 },
            ],
          },
        ],
      },
    });

    const res = await GET(req("flyFrom=BCN&style=frimon&months=3"));
    expect(res.status).toBe(200);
    const body = await res.json();
    // Sep 5-6 2026 is a weekend, so no PTO workdays; the mocked holiday on
    // Sep 5 lands in-span, surfacing as the destination holiday.
    expect(body.deals[0].ptoDays).toBe(0);
    expect(body.deals[0].destHoliday).toEqual({ date: "2026-09-05", name: "Test Holiday" });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/weekends/__tests__/route.test.ts`
Expected: FAIL (`ret_from_diff_airport` undefined; `deals[0].destHoliday` undefined).

- [ ] **Step 3: Edit `src/app/api/weekends/route.ts`**

Add the imports at the top:

```ts
import { fetchHolidays, annotate } from "@/lib/holidays";
```

In the `axios.get` `params` object, add after `ret_fly_days_type: "arrival",`:

```ts
        ret_from_diff_airport: false,
        ret_to_diff_airport: false,
```

Replace the `const deals = normalizeDeals(response.data, currency);` / `return NextResponse.json({ deals });` tail with:

```ts
    const deals = normalizeDeals(response.data, currency);

    if (deals.length > 0) {
      const years = new Set<number>();
      for (const d of deals) {
        years.add(Number(d.outArrive.slice(0, 4)));
        years.add(Number(d.backDepart.slice(0, 4)));
      }
      const yearList = [...years];
      const homeCC = deals[0].countryFromCode;

      const homeCal = (
        await Promise.all(yearList.map((y) => fetchHolidays(homeCC, y)))
      ).flat();

      const destCCs = [...new Set(deals.map((d) => d.countryToCode).filter(Boolean))];
      const destPairs = await Promise.all(
        destCCs.map(async (cc) => {
          const cal = (
            await Promise.all(yearList.map((y) => fetchHolidays(cc, y)))
          ).flat();
          return [cc, cal] as const;
        })
      );
      const destCalByCC = new Map(destPairs);

      for (const d of deals) {
        const info = annotate(
          d.outArrive,
          d.backDepart,
          homeCal,
          destCalByCC.get(d.countryToCode) ?? []
        );
        d.ptoDays = info.ptoDays;
        d.homeHoliday = info.homeHoliday;
        d.destHoliday = info.destHoliday;
      }
    }

    return NextResponse.json({ deals });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/weekends/__tests__/route.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/weekends/route.ts src/app/api/weekends/__tests__/route.test.ts
git commit -m "feat: lock round-trip to same airports and enrich deals with holidays"
```

---

### Task 5: DayBlocks renders the gauge, times, and red-eye markers

**Files:**
- Modify: `src/components/DayBlocks.tsx`
- Test: `src/components/__tests__/DayBlocks.test.tsx`

**Interfaces:**
- Consumes: `DayCell` (Task 2).
- Produces:
  ```
  function DayBlocks(props: {
    cells: DayCell[];
    arrival: { time: string; night: boolean; plusOne: boolean };
    departure: { time: string; night: boolean };
  }): JSX.Element
  ```
  Each cell shows weekday/day/month caption (once, above), a coral usable-fraction gauge, and — on the `arrive`/`solo` cell — a landing icon + `arrival.time` (+`+1` when `plusOne`, moon `aria-label="Night flight"` when `night`); on the `leave`/`solo` cell a take-off icon + `departure.time` (moon when `night`); `middle` cells show "full day".

- [ ] **Step 1: Rewrite the failing test `src/components/__tests__/DayBlocks.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DayBlocks } from "@/components/DayBlocks";
import type { DayCell } from "@/lib/format";

const cells: DayCell[] = [
  { weekday: "Sat", day: 8, month: "Aug", isWeekend: true, role: "arrive", fillStart: 0.35, fillEnd: 1 },
  { weekday: "Sun", day: 9, month: "Aug", isWeekend: true, role: "middle", fillStart: 0, fillEnd: 1 },
  { weekday: "Mon", day: 10, month: "Aug", isWeekend: false, role: "leave", fillStart: 0, fillEnd: 0.8 },
];

describe("DayBlocks", () => {
  it("renders the month, day cells, and arrival/departure times", () => {
    render(
      <DayBlocks
        cells={cells}
        arrival={{ time: "08:20", night: false, plusOne: false }}
        departure={{ time: "19:05", night: false }}
      />
    );
    expect(screen.getByText("Aug")).toBeInTheDocument();
    expect(screen.getByText("Sat")).toBeInTheDocument();
    expect(screen.getByText("08:20")).toBeInTheDocument();
    expect(screen.getByText("19:05")).toBeInTheDocument();
    expect(screen.getByText(/full day/i)).toBeInTheDocument();
  });

  it("marks a red-eye with +1 and night glyphs", () => {
    render(
      <DayBlocks
        cells={cells}
        arrival={{ time: "23:40", night: true, plusOne: true }}
        departure={{ time: "06:00", night: true }}
      />
    );
    expect(screen.getByText(/\+1/)).toBeInTheDocument();
    expect(screen.getAllByLabelText("Night flight")).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/DayBlocks.test.tsx`
Expected: FAIL (DayBlocks doesn't accept `arrival`/`departure`).

- [ ] **Step 3: Rewrite `src/components/DayBlocks.tsx`**

```tsx
import type { DayCell } from "@/lib/format";

export function DayBlocks({
  cells,
  arrival,
  departure,
}: {
  cells: DayCell[];
  arrival: { time: string; night: boolean; plusOne: boolean };
  departure: { time: string; night: boolean };
}) {
  const months: string[] = [];
  for (const c of cells) if (!months.includes(c.month)) months.push(c.month);

  return (
    <div>
      <div className="mb-1 text-[11px] text-black/40 dark:text-white/40">
        {months.join(" – ")}
      </div>
      <div className="flex gap-1" role="list" aria-label="Trip days">
        {cells.map((c, i) => {
          const usable = Math.round((c.fillEnd - c.fillStart) * 100);
          const showArrive = c.role === "arrive" || c.role === "solo";
          const showLeave = c.role === "leave" || c.role === "solo";
          return (
            <div
              key={i}
              role="listitem"
              aria-label={`${c.weekday} ${c.day}, ${usable}% of the day usable`}
              className="flex-1 rounded-md bg-black/5 px-1 py-1 text-center text-xs dark:bg-white/10"
            >
              <div className="text-black/60 dark:text-white/60">{c.weekday}</div>
              <div
                className={`font-medium ${
                  c.isWeekend ? "text-orange-700 dark:text-orange-300" : ""
                }`}
              >
                {c.day}
              </div>
              <div className="relative my-1 h-1.5 rounded-full bg-black/10 dark:bg-white/15">
                <div
                  className="absolute inset-y-0 rounded-full bg-orange-300 dark:bg-orange-400/70"
                  style={{
                    left: `${c.fillStart * 100}%`,
                    width: `${(c.fillEnd - c.fillStart) * 100}%`,
                  }}
                />
              </div>
              {showArrive && (
                <div className="text-black/70 dark:text-white/70">
                  🛬 {arrival.time}
                  {arrival.plusOne && <span> +1</span>}
                  {arrival.night && <span aria-label="Night flight"> 🌙</span>}
                </div>
              )}
              {showLeave && (
                <div className="text-black/70 dark:text-white/70">
                  🛫 {departure.time}
                  {departure.night && <span aria-label="Night flight"> 🌙</span>}
                </div>
              )}
              {c.role === "middle" && (
                <div className="text-black/40 dark:text-white/40">full day</div>
              )}
            </div>
          );
        })}
      </div>
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
git commit -m "feat: render usable-time gauge and red-eye markers in DayBlocks"
```

---

### Task 6: DealCard — origin chip, gauge, holiday badges

**Files:**
- Modify: `src/components/DealCard.tsx`
- Test: `src/components/__tests__/DealCard.test.tsx`

**Interfaces:**
- Consumes: `Deal` (Task 1), `dayLabel`/`timeLabel`/`durationLabel`/`daysUntil`/`dayBlocks`/`crossesMidnight`/`isNightHour` (Task 2), `DayBlocks` (Task 5).
- Produces: `DealCard({ deal })` — collapsed card with an origin chip (`flyFrom → flyTo`), the gauge (built from `outArrive`/`backDepart`), the green stay pill, and holiday badges (amber home PTO badge, secondary destination badge); expand reveals two flight lines with airport codes and `+1` where a leg crosses midnight; the old text summary line is removed.

- [ ] **Step 1: Rewrite the failing test `src/components/__tests__/DealCard.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DealCard } from "@/components/DealCard";
import type { Deal } from "@/lib/deals";

const base: Deal = {
  cityTo: "Ibiza",
  countryTo: "Spain",
  flag: "🇪🇸",
  flyFrom: "BCN",
  flyTo: "IBZ",
  countryFromCode: "ES",
  countryToCode: "ES",
  outDepart: "2026-08-08T21:05:00.000Z",
  outArrive: "2026-08-08T22:10:00.000Z",
  backDepart: "2026-08-10T18:00:00.000Z",
  backArrive: "2026-08-10T19:35:00.000Z",
  stayMinutes: 2915,
  nights: 2,
  price: 37,
  currency: "EUR",
  deepLink: "https://kiwi.com/deep/ibiza",
};

describe("DealCard", () => {
  it("shows the origin chip, price, times and a booking link", () => {
    render(<DealCard deal={base} />);
    expect(screen.getByText("Ibiza")).toBeInTheDocument();
    expect(screen.getByText("BCN → IBZ")).toBeInTheDocument();
    expect(screen.getByText(/37/)).toBeInTheDocument();
    expect(screen.getByText("22:10")).toBeInTheDocument();
    expect(screen.getByText("18:00")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /book ibiza/i })
    ).toHaveAttribute("href", "https://kiwi.com/deep/ibiza");
  });

  it("expands to flight lines with airport codes", () => {
    render(<DealCard deal={base} />);
    expect(screen.queryByText(/outbound/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByText(/outbound/i)).toBeInTheDocument();
    expect(screen.getByText(/return/i)).toBeInTheDocument();
  });

  it("renders holiday badges when present", () => {
    const withHols: Deal = {
      ...base,
      ptoDays: 0,
      homeHoliday: { date: "2026-08-07", name: "Assumption" },
      destHoliday: { date: "2026-08-08", name: "Ferragosto" },
    };
    render(<DealCard deal={withHols} />);
    expect(screen.getByText(/no day off needed/i)).toBeInTheDocument();
    expect(screen.getByText(/Ferragosto/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/DealCard.test.tsx`
Expected: FAIL (no origin chip; DayBlocks now needs `arrival`/`departure`).

- [ ] **Step 3: Rewrite `src/components/DealCard.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { Deal } from "@/lib/deals";
import {
  dayLabel,
  timeLabel,
  durationLabel,
  daysUntil,
  dayBlocks,
  crossesMidnight,
  isNightHour,
} from "@/lib/format";
import { DayBlocks } from "@/components/DayBlocks";

export function DealCard({ deal }: { deal: Deal }) {
  const [open, setOpen] = useState(false);
  const cells = dayBlocks(deal.outArrive, deal.backDepart);
  const stay = durationLabel(deal.stayMinutes);
  const days = daysUntil(deal.outDepart, new Date());
  const arrival = {
    time: timeLabel(deal.outArrive),
    night: isNightHour(deal.outArrive),
    plusOne: crossesMidnight(deal.outDepart, deal.outArrive),
  };
  const departure = {
    time: timeLabel(deal.backDepart),
    night: isNightHour(deal.backDepart),
  };
  const returnPlusOne = crossesMidnight(deal.backDepart, deal.backArrive);

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xl" aria-hidden>
              {deal.flag}
            </span>
            <span className="font-medium">{deal.cityTo}</span>
            <span className="text-sm opacity-60">{deal.countryTo}</span>
            <span className="rounded-full border border-black/15 px-2 py-0.5 text-xs opacity-70 dark:border-white/20">
              {deal.flyFrom} → {deal.flyTo}
            </span>
          </div>
          <div className="mt-2">
            <DayBlocks cells={cells} arrival={arrival} departure={departure} />
          </div>
        </button>
        <div className="text-right shrink-0">
          <div className="text-lg font-semibold">
            {deal.price} {deal.currency}
          </div>
          {days > 0 && <div className="text-xs opacity-60">in {days} days</div>}
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

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-green-100 px-2.5 py-1 text-sm font-medium text-green-900 dark:bg-green-300/20 dark:text-green-100">
          {stay} in {deal.cityTo}
        </span>
        {deal.homeHoliday && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-sm text-amber-900 dark:bg-amber-300/20 dark:text-amber-100">
            🎉 {deal.homeHoliday.name} —{" "}
            {deal.ptoDays === 0
              ? "no day off needed"
              : `${deal.ptoDays} day off`}
          </span>
        )}
        {deal.destHoliday && (
          <span className="rounded-full border border-amber-300/50 px-2.5 py-1 text-sm text-amber-800 dark:text-amber-200">
            {deal.destHoliday.name} in {deal.cityTo}
          </span>
        )}
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-1 border-t border-black/10 pt-3 text-sm dark:border-white/10">
          <div>
            Outbound · {dayLabel(deal.outDepart)} {timeLabel(deal.outDepart)}{" "}
            {deal.flyFrom} → {deal.flyTo} {timeLabel(deal.outArrive)}
            {arrival.plusOne ? " +1" : ""}
          </div>
          <div>
            Return · {dayLabel(deal.backDepart)} {timeLabel(deal.backDepart)}{" "}
            {deal.flyTo} → {deal.flyFrom} {timeLabel(deal.backArrive)}
            {returnPlusOne ? " +1" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/DealCard.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/DealCard.tsx src/components/__tests__/DealCard.test.tsx
git commit -m "feat: origin chip, stay gauge, and holiday badges on DealCard"
```

---

### Task 7: Page test fixtures + full verification

**Files:**
- Modify: `src/app/__tests__/page.test.tsx` (add codes to the `ibiza`/`rome` fixtures)

**Interfaces:**
- Consumes: everything above. `src/app/page.tsx` itself is unchanged (it passes deals straight through).

- [ ] **Step 1: Add codes to the page-test fixtures**

In `src/app/__tests__/page.test.tsx`, in the `ibiza` object add after `flag: "🇪🇸",`:

```ts
  flyFrom: "BCN",
  flyTo: "IBZ",
  countryFromCode: "ES",
  countryToCode: "ES",
```

The `rome` object spreads `...ibiza` then overrides; add after its `flag: "🇮🇹",`:

```ts
  flyTo: "FCO",
  countryToCode: "IT",
```

- [ ] **Step 2: Run the page test**

Run: `npx vitest run src/app/__tests__/page.test.tsx`
Expected: PASS (the existing 4 tests; deals now render with the enriched shape).

- [ ] **Step 3: Run the full suite and build**

Run: `npm test && npm run build`
Expected: all tests pass; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/__tests__/page.test.tsx
git commit -m "test: enrich page-test fixtures with airport and country codes"
```

---

### Task 8: Value verdict ("is it worth it?")

**Files:**
- Modify: `src/lib/format.ts`
- Test: `src/lib/__tests__/format.test.ts`
- Modify: `src/components/DealCard.tsx`
- Test: `src/components/__tests__/DealCard.test.tsx`

**Interfaces:**
- Consumes: `parts` (internal to format.ts), `Deal` times.
- Produces:
  - `interface Verdict { label: string; tier: "great" | "fair" | "poor" }`
  - `function travelMinutes(outDepart: string, outArrive: string, backDepart: string, backArrive: string): number` — outbound + return flight durations, in minutes.
  - `function valueVerdict(stayMinutes: number, travelMin: number): Verdict` — ratio `stayMinutes / travelMin`: `>= 5` great, `>= 2` fair, else poor; `travelMin <= 0` → great.
  - `DealCard` renders the verdict as a pill next to the stay pill (outlined green for great, outlined neutral for fair, muted text for poor).

- [ ] **Step 1: Add the failing tests to `src/lib/__tests__/format.test.ts`**

Add `travelMinutes` and `valueVerdict` to the import, then append:

```ts
describe("travelMinutes", () => {
  it("sums outbound and return flight durations", () => {
    expect(
      travelMinutes(
        "2026-08-08T21:05:00.000Z",
        "2026-08-08T22:10:00.000Z",
        "2026-08-10T18:00:00.000Z",
        "2026-08-10T19:35:00.000Z"
      )
    ).toBe(160);
  });
});

describe("valueVerdict", () => {
  it("rates a trip by its stay-to-travel ratio", () => {
    expect(valueVerdict(2880, 360).tier).toBe("great"); // 8:1
    expect(valueVerdict(1500, 600).tier).toBe("fair"); // 2.5:1
    expect(valueVerdict(480, 540).tier).toBe("poor"); // 0.9:1
    expect(valueVerdict(1000, 0).tier).toBe("great"); // guard
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/format.test.ts`
Expected: FAIL (`travelMinutes`/`valueVerdict` undefined).

- [ ] **Step 3: Add the functions to `src/lib/format.ts`**

```ts
export interface Verdict {
  label: string;
  tier: "great" | "fair" | "poor";
}

function naiveMin(iso: string): number {
  const p = parts(iso);
  return p ? Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) / 60000 : 0;
}

export function travelMinutes(
  outDepart: string,
  outArrive: string,
  backDepart: string,
  backArrive: string
): number {
  return (
    naiveMin(outArrive) -
    naiveMin(outDepart) +
    (naiveMin(backArrive) - naiveMin(backDepart))
  );
}

export function valueVerdict(stayMinutes: number, travelMin: number): Verdict {
  if (travelMin <= 0) return { label: "Great value", tier: "great" };
  const ratio = stayMinutes / travelMin;
  if (ratio >= 5) return { label: "Great value", tier: "great" };
  if (ratio >= 2) return { label: "Fair trade-off", tier: "fair" };
  return { label: "Long trip, short stay", tier: "poor" };
}
```

- [ ] **Step 4: Add a failing test to `src/components/__tests__/DealCard.test.tsx`**

Inside the `describe("DealCard", ...)` block add (the `base` fixture's ~48h stay vs 160m travel is an 18:1 ratio → great):

```ts
  it("shows a value verdict", () => {
    render(<DealCard deal={base} />);
    expect(screen.getByText(/great value/i)).toBeInTheDocument();
  });
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/DealCard.test.tsx`
Expected: FAIL (no verdict rendered).

- [ ] **Step 6: Render the verdict in `src/components/DealCard.tsx`**

Add to the imports from `@/lib/format`: `travelMinutes`, `valueVerdict`. After the `departure`/`returnPlusOne` consts add:

```ts
  const verdict = valueVerdict(
    deal.stayMinutes,
    travelMinutes(deal.outDepart, deal.outArrive, deal.backDepart, deal.backArrive)
  );
  const verdictClass =
    verdict.tier === "great"
      ? "border border-green-300 text-green-800 dark:border-green-400/40 dark:text-green-200"
      : verdict.tier === "fair"
        ? "border border-black/15 text-black/60 dark:border-white/20 dark:text-white/70"
        : "text-black/45 dark:text-white/45";
```

In the badges row, immediately after the green stay-pill `<span>…</span>`, add:

```tsx
        <span className={`rounded-full px-2.5 py-1 text-sm ${verdictClass}`}>
          {verdict.label}
        </span>
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/format.test.ts src/components/__tests__/DealCard.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/format.ts src/lib/__tests__/format.test.ts src/components/DealCard.tsx src/components/__tests__/DealCard.test.tsx
git commit -m "feat: add is-it-worth-it value verdict badge"
```

---

### Task 9: Space Grotesk font

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: nothing.
- Produces: the app renders in Space Grotesk (loaded via `next/font/google`), replacing the default Arial body font.

- [ ] **Step 1: Swap the font in `src/app/layout.tsx`**

Replace the font import and the `geistSans`/`geistMono` consts with Space Grotesk (keep Geist Mono for the mono variable), and update the `<html>` className:

```tsx
import { Space_Grotesk, Geist_Mono } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
```

Change the `<html>` element's className to:

```tsx
      className={`${spaceGrotesk.variable} ${geistMono.variable} h-full antialiased`}
```

- [ ] **Step 2: Point the body font at Space Grotesk in `src/app/globals.css`**

In the `@theme inline` block change the sans line to:

```css
  --font-sans: var(--font-space-grotesk);
```

And change the `body { … }` `font-family` line to:

```css
  font-family: var(--font-space-grotesk), system-ui, sans-serif;
```

- [ ] **Step 3: Run the full suite and build**

Run: `npm test && npm run build`
Expected: all tests pass; build succeeds (fonts load at build time).

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat: switch the app typeface to Space Grotesk"
```

---

## Notes for the implementer

- Tasks 1–3 are pure logic (deals/format/holidays); Task 4 wires the route (mock `axios` and `@/lib/holidays`); Tasks 5–6 are components under jsdom; Task 7 finishes the type ripple and runs the full build.
- Never call the live Nager.Date or Tequila APIs in tests — mock `fetch`/`axios`/`@/lib/holidays`.
- Do not use `new Date(iso)` on Kiwi timestamps anywhere; the helpers already parse string fields.
- Manual check after Task 7 (live key already in `.env.local`): `npm run dev`, open the app — cards show `BCN → CODE`, a gauge whose fill reflects arrival/departure times, moon/`+1` on red-eyes, and holiday badges where applicable.
```
