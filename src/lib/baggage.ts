import type { Deal } from "@/lib/deals";

// What we can honestly say about baggage on a deal.
//
// The only datum we get from Kiwi is `bags_price["1"]` — the cost to ADD a first
// checked bag. It says nothing about what cabin allowance the fare includes, so
// we must not claim one. (The previous copy said "Cabin bag only", which on Wizz
// or Ryanair is often wrong: the base fare covers an under-seat personal item
// and a trolley is itself a paid extra.)
export interface BaggageInfo {
  // The statement shown in the expanded details. Never null — an unknown
  // baggage price is itself something we say out loud rather than leave silent.
  full: string;
  // Whether the fee is large enough relative to the fare to warrant the amber
  // treatment already used for far-from-city airports.
  severe: boolean;
}

// Amber only when the fee is extreme RELATIVE TO THIS MARKET, and not trivially
// small in absolute terms.
//
// Calibrated against a real 58-deal board (BCN, direct, 2026-07-27) rather than
// intuition, because intuition was wrong here. On that sample the bag/fare ratio
// ran: p25 0.58, median 0.85, p75 1.25, max 2.73. A bag costing most of the fare
// is the NORM on these routes, not an outlier — so a "half the fare" trigger
// sits below the median and fires on 82% of cards, which is exactly the
// amber-everywhere failure that makes the colour mean nothing.
//
// At 1.5x the fare (i.e. the true cost is ~2.5x the advertised price) roughly
// 13% of that board qualifies — a legible minority that still catches the
// motivating case of a 165 EUR bag on a 49 EUR fare. Re-measure if the market
// mix changes; this number is an empirical fact about the data, not a taste.
export const SEVERE_BAG_RATIO = 1.5;
export const SEVERE_BAG_MIN = 25;

export function isSevereBagFee(bagPrice: number, price: number): boolean {
  return bagPrice >= price * SEVERE_BAG_RATIO && bagPrice >= SEVERE_BAG_MIN;
}

export function baggageInfo(deal: Deal, adults: number): BaggageInfo {
  const bag = deal.bagPrice;
  const carriers = deal.airlines?.length ?? 0;
  const hasStops = deal.outStops > 0 || deal.backStops > 0;

  // Kiwi's own flag, not an inference. The old heuristic ("2 carriers plus a
  // stop") both over-fired — two carriers on a single ticket — and under-fired,
  // on one carrier sold as two tickets. With the real field, this warning now
  // appears on fewer trips and means something when it does.
  if (deal.selfTransfer) {
    const at = deal.bagRecheckAt?.[0];
    return {
      full:
        "Booked as separate tickets — a missed connection is on you, not the " +
        "airline, and bag fees may differ per carrier." +
        (at ? ` You collect and re-check your bag in ${at}.` : "") +
        " Confirm on Kiwi.",
      severe: false,
    };
  }
  // Not flagged as self-transfer, but still two carriers over a connection:
  // don't quote one bag figure for two policies.
  if (carriers > 1 && hasStops) {
    return {
      full:
        "Two airlines on this trip — bag fees and allowances may differ per " +
        "airline. Confirm on Kiwi.",
      severe: false,
    };
  }

  if (bag == null) {
    return {
      full: "Baggage: not shown for this fare — check on Kiwi.",
      severe: false,
    };
  }

  if (bag === 0) {
    return {
      full: "Checked bag included in the fare.",
      severe: false,
    };
  }

  const rounded = Math.round(bag);

  // `price` is a party total, but whether `bags_price` is per-passenger or
  // per-booking is unverified. Rather than print a number that might be either,
  // drop to a qualitative statement for groups. Restore the figure once the
  // semantics are confirmed against a live multi-adult response.
  if (adults > 1) {
    return {
      full: "Checked bags are extra — priced per bag on Kiwi.",
      severe: false,
    };
  }

  return {
    full:
      `Fare excludes checked bags — first checked bag +${rounded} ${deal.currency}. ` +
      "Cabin allowance is set by the airline; confirm on Kiwi.",
    severe: isSevereBagFee(bag, deal.price),
  };
}
