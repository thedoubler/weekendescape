import type { Deal, Layover } from "@/lib/deals";
import { legMinutes } from "@/lib/format";

// Derived facts for the expanded card. Kept out of the component so the
// arithmetic — which is where the bugs live — is testable on its own.

// Gate-to-gate journey time for a leg — including any layover, which is the
// number a traveller actually experiences. Prefers the upstream duration;
// falls back to wall-clock subtraction, which is only correct when both ends
// share a time zone. See the note on `outDurationMin` in deals.ts.
export function legAirMinutes(
  upstream: number | null | undefined,
  depIso: string,
  arrIso: string
): number {
  return upstream ?? legMinutes(depIso, arrIso);
}

// Below this a missed connection is a real risk — and on a self-transfer
// itinerary that means re-booking at your own cost, not being re-routed.
export const TIGHT_LAYOVER_MIN = 75;
// Beyond this the stop is long enough to be a dead half-day the leg label hides.
export const LONG_LAYOVER_MIN = 240;

export interface LayoverFlag {
  at: string;
  minutes: number;
  kind: "tight" | "long";
}

export function layoverFlags(deal: Deal): LayoverFlag[] {
  const all: Layover[] = [...deal.outLayovers, ...deal.backLayovers];
  const out: LayoverFlag[] = [];
  for (const l of all) {
    if (l.minutes > 0 && l.minutes < TIGHT_LAYOVER_MIN) {
      out.push({ at: l.at, minutes: l.minutes, kind: "tight" });
    } else if (l.minutes >= LONG_LAYOVER_MIN) {
      out.push({ at: l.at, minutes: l.minutes, kind: "long" });
    }
  }
  return out;
}

export interface CostRow {
  label: string;
  value: string;
  // Renders as the emphasised total line.
  total?: boolean;
}

// The cost breakdown, as rows. Returns only what we can state honestly: when the
// bag price is unknown or ambiguous there is simply no total row, rather than a
// total that might be wrong.
export function costRows(deal: Deal, adults: number): CostRow[] {
  const cur = deal.currency;
  const rows: CostRow[] = [
    { label: adults > 1 ? `Fare, round trip · ${adults} travellers` : "Fare, round trip", value: `${deal.price} ${cur}` },
  ];
  if (adults > 1) {
    rows.push({
      label: "Per person",
      value: `${Math.round(deal.price / adults)} ${cur}`,
    });
  }
  // Only sum when a single traveller: whether bagPrice is per-bag or per-booking
  // is unverified, so adding it to a party total could be wrong either way.
  if (adults === 1 && typeof deal.bagPrice === "number" && deal.bagPrice > 0) {
    const bag = Math.round(deal.bagPrice);
    rows.push({ label: "First checked bag", value: `+${bag} ${cur}` });
    rows.push({
      label: "With one checked bag",
      value: `${Math.round(deal.price) + bag} ${cur}`,
      total: true,
    });
  }
  return rows;
}

// An alternative weekend only earns a row when the saving is worth acting on.
// Two floors, both required: a percentage alone oversells a tiny delta on a
// two-digit fare, and an absolute alone fires constantly on expensive trips.
// Below these the difference is inside fare noise and the 30-minute cache.
export const MIN_SAVING_PCT = 10;
export const MIN_SAVING_ABS = 10;

export interface Saving {
  amount: number;
  pct: number;
  // True when both sides could be compared with a checked bag included. When
  // false the comparison is fare-only and the copy has to say so — the cost
  // table directly above has just argued the fare is not the price.
  allIn: boolean;
}

// All-in cost when we can state one honestly, else the bare fare. Mirrors the
// rule in `costRows`: never total a bag price for a party, because whether it is
// per-bag or per-booking is unverified.
// Exported because the UI must display the SAME basis the saving was computed
// on. It previously showed the bare fare beside an all-in saving, so the row
// read "153 EUR ... 50 EUR less ... 39 EUR" — three numbers that cannot be
// reconciled by any reader.
export function comparable(
  price: number,
  bagPrice: number | null | undefined,
  adults: number
): { value: number; allIn: boolean } {
  if (adults === 1 && typeof bagPrice === "number" && bagPrice > 0) {
    return { value: price + Math.round(bagPrice), allIn: true };
  }
  return { value: price, allIn: false };
}

// Null when the alternative isn't worth showing — same dates, dearer, or a
// saving too small to act on.
export function weekendSaving(
  current: Deal,
  alternative: Deal,
  adults: number
): Saving | null {
  // The same weekend cannot be a cheaper weekend.
  if (
    alternative.outDepart.slice(0, 10) === current.outDepart.slice(0, 10) &&
    alternative.backDepart.slice(0, 10) === current.backDepart.slice(0, 10)
  ) {
    return null;
  }
  if (alternative.currency !== current.currency) return null;

  const a = comparable(current.price, current.bagPrice, adults);
  const b = comparable(alternative.price, alternative.bagPrice, adults);
  // Only claim an all-in saving when BOTH sides were comparable that way.
  const allIn = a.allIn && b.allIn;
  const base = allIn ? a.value : current.price;
  const other = allIn ? b.value : alternative.price;

  const amount = base - other;
  if (amount < MIN_SAVING_ABS) return null;
  const pct = Math.round((amount / base) * 100);
  if (pct < MIN_SAVING_PCT) return null;
  return { amount, pct, allIn };
}
