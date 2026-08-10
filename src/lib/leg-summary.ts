import type { Layover } from "@/lib/deals";
import { durationLabel, timeLabel, dateWithMonth } from "@/lib/format";

// Text for one flight leg. Kept out of the component so the wording rules —
// which date is worth printing, how stops read, what a screen reader hears —
// are testable without rendering anything.

export interface LegInput {
  label: "Out" | "Back";
  depIso: string;
  arrIso: string;
  depCode: string;
  arrCode: string;
  depCity: string;
  arrCity: string;
  minutes: number;
  stops: number;
  layovers: Layover[];
  // True when the arrival lands on a later calendar day than the departure.
  plusOne: boolean;
  // Carriers for THIS direction, in flight order. Code drives the logo, name
  // the label — a logo alone is unreadable at 16px and unreachable to AT.
  carriers: { code: string; name: string }[];
}

export interface LegSummary {
  depTime: string;
  arrTime: string;
  // The quiet run after the times: air time, stops, and a landing day when it
  // is genuinely news.
  meta: string;
  // Full sentence for assistive tech, in reading order rather than visual order.
  spoken: string;
}

// Stops phrasing. Layover durations are dropped beyond one stop: at two the
// total elapsed time is what communicates "this eats your Sunday", and the
// individual gaps that matter are already called out by `layoverFlags`.
function stopsPhrase(stops: number, layovers: Layover[]): string {
  if (stops === 0) return "direct";
  const vias = layovers.map((l) => l.at).filter(Boolean);
  if (stops === 1) {
    const l = layovers[0];
    if (l?.at) return `1 stop, ${l.at} (${durationLabel(l.minutes)})`;
    return "1 stop";
  }
  return vias.length > 0
    ? `${stops} stops, ${vias.join(" · ")}`
    : `${stops} stops`;
}

function spokenStops(stops: number, layovers: Layover[]): string {
  if (stops === 0) return "direct";
  if (stops === 1 && layovers[0]?.at) {
    return `1 stop in ${layovers[0].at}, ${durationLabel(layovers[0].minutes)}`;
  }
  return stops === 1 ? "1 stop" : `${stops} stops`;
}

export function legSummary(leg: LegInput): LegSummary {
  const depTime = timeLabel(leg.depIso);
  const arrTime = timeLabel(leg.arrIso);
  // Carriers are NOT in this string: they render as logo + name, so the
  // component composes them separately.
  const parts = [durationLabel(leg.minutes), stopsPhrase(leg.stops, leg.layovers)];

  // The date is printed three times already (header range, day strip, and the
  // day cells). It is only news when the flight lands on a different day than
  // it left — which the day strip cannot show for the return home.
  if (leg.plusOne) {
    parts.push(
      leg.label === "Back"
        ? `home ${dateWithMonth(leg.arrIso)}`
        : `lands ${dateWithMonth(leg.arrIso)}`
    );
  }

  const from = leg.depCity || leg.depCode;
  const to = leg.arrCity || leg.arrCode;
  const spoken =
    `${leg.label === "Out" ? "Outbound" : "Return"}. ` +
    `Departs ${depTime} from ${from}. ` +
    `Arrives ${arrTime}${leg.plusOne ? " the next day" : ""} in ${to}. ` +
    `${durationLabel(leg.minutes)}, ${spokenStops(leg.stops, leg.layovers)}.` +
    (leg.carriers.length > 0
      ? ` With ${leg.carriers.map((c) => c.name).join(", ")}.`
      : "");

  return { depTime, arrTime, meta: parts.join(" · "), spoken };
}

// `<time datetime>` value for a duration in minutes, e.g. PT1H55M.
export function isoDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `PT${h > 0 ? `${h}H` : ""}${m > 0 || h === 0 ? `${m}M` : ""}`;
}
