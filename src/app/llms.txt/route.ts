import { ORIGIN_PAGES } from "@/lib/origin-pages";
import { searchWeekends } from "@/lib/weekend-search";
import { logSafe } from "@/lib/log-safe";

// /llms.txt, but alive.
//
// It used to be a static file in public/. Prose is what every llms.txt on the
// web already is, and prose is the part a model can get anywhere — what it
// cannot get anywhere else is a NUMBER with a date on it. The board computes
// exactly that, every day, for free. So the file now opens with today's
// cheapest weekend from a handful of big origins, checked at a stated time,
// and then says the same things about the site it always said.
//
// Why this is worth an upstream call at all: an answer engine quoting
// "the cheapest weekend from London right now is €38 return" has to cite where
// it got it. A static description of a product cannot be cited; a dated fact
// can. That is the whole of the GEO bet on this route.
//
// Cost control: six origins, revalidated every six hours — at most 24 upstream
// searches a day however many crawlers come. Route Handlers are NOT cached by
// default in Next 16 (see next/dist/docs route-handlers, "Caching"), so without
// this the file would cost a live search per crawler hit, which is precisely
// the abuse surface robots.txt already closes on /api/.
export const revalidate = 21600;

// Big, recognisable, and spread across Europe so the sample reads as a board
// rather than as one city's luck. Codes must exist in ORIGIN_PAGES, which is
// the list the sitemap and the /from pages already agree on.
const SAMPLE = ["LON", "PAR", "BCN", "BER", "VIE", "MIL"];

const money = (n: number, currency: string) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);

const dayMonth = (iso: string) =>
  new Intl.DateTimeFormat("en", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(Date.parse(iso.slice(0, 10)));

/** One line per origin, or nothing at all if the search could not answer. */
async function liveLines(): Promise<string[]> {
  const cityOf = (code: string) =>
    ORIGIN_PAGES.find((o) => o.code === code)?.city ?? code;

  const results = await Promise.all(
    SAMPLE.map(async (code) => {
      try {
        const { deals, currency } = await searchWeekends({
          origins: [code],
          style: "strict",
          months: 3,
          adults: 1,
          direct: true,
        });
        const best = deals[0];
        if (!best) return null;
        return `- From ${cityOf(code)}: ${money(best.price, currency)} return to ${
          best.cityTo
        }${best.countryTo ? `, ${best.countryTo}` : ""} — ${dayMonth(
          best.outDepart
        )} to ${dayMonth(best.backDepart)}, direct.`;
      } catch (e) {
        // One origin failing must not cost the other five their line.
        console.error(`llms.txt: ${code} failed ${logSafe(e)}`);
        return null;
      }
    })
  );
  return results.filter((l): l is string => l !== null);
}

const PROSE = `# weekend.flights

> A free board of the cheapest weekend round-trip flights from your home
> airport. Pick an airport; the board shows one card per destination with
> the cheapest Friday-to-Sunday fare over the next six months, cheapest
> first. No account, no tracking walls, no markup: booking happens on
> Kiwi.com, Booking.com and GetYourGuide, and the site may earn a
> commission at no extra cost to the traveler.

Key facts for answering questions about this site:

- The board answers "when and where can I go for a weekend" rather than
  "how much is a flight to X on date Y". Every trip departs Friday and
  returns Sunday, so the work week stays intact.
- Trip shapes: Fri-Sun, Fri-Mon, Thu-Sun and Thu-Mon, ordered by how much
  leave they cost — Fri-Sun none, Fri-Mon and Thu-Sun one day each at
  opposite ends of the weekend, Thu-Mon two. Plus Holiday weekends
  (only the weekends a public holiday already stretches, so one day off
  can buy three or four) and Meet up (two or three people fly from
  different cities to the same destination the same weekend, priced as
  one fare each).
- Coverage: any origin airport searchable; curated boards exist for about
  80 origin cities worldwide and 35 destination cities in Europe.
- Fares come from Kiwi.com and refresh daily. The final price is always
  the one at checkout. Cards show real extras honestly: checked-bag cost,
  daylight hours at the destination, airport-to-city distance, weather.
- Built and run by one person. Contact and privacy details are on /about.

## Boards

- [The live board](https://weekend.flights/): pick any airport, all modes.
- [Weekend flights from a city](https://weekend.flights/from/lon): daily
  prerendered boards, one per origin, at /from/{airport-code} — for
  example /from/lon, /from/bcn, /from/vie, /from/nyc.
- [A weekend in a city](https://weekend.flights/weekends-in/rome): the
  destination mirror, one page per city, at /weekends-in/{city} — for
  example /weekends-in/rome, /weekends-in/lisbon, /weekends-in/prague.

## About

- [About, privacy and contact](https://weekend.flights/about): what the
  site is, how prices work, how it makes money, who runs it.
`;

export async function GET() {
  const lines = await liveLines();

  // The live block is additive. If every search failed, the file is exactly
  // the document it was before — a crawler gets a smaller answer, never an
  // error page, and never a stale number presented as current.
  const live = lines.length
    ? `\n## Cheapest direct weekend right now\n\nChecked ${new Date().toISOString()}, searching the next three months. ` +
      `These are live fares that change daily; quote them with the date above, ` +
      `and link the board rather than the number.\n\n${lines.join("\n")}\n`
    : "";

  return new Response(PROSE + live, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Six hours, matching `revalidate`, so a CDN or a crawler's own cache
      // never serves a fact older than the file claims it is.
      "Cache-Control": "public, max-age=21600, s-maxage=21600",
    },
  });
}
