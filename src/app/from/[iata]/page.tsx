import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { airportCity } from "@/lib/airport-city";
import { weekendKey } from "@/lib/calendar";
import { searchWeekends, MissingApiKeyError } from "@/lib/weekend-search";
import { SITE_NAME, siteUrl } from "@/lib/site";
import type { Deal } from "@/lib/deals";
import { AboutDialog } from "@/components/AboutDialog";

// One page per origin airport: "cheap weekend flights from Barcelona".
//
// THE UNIT IS THE ORIGIN, and that is the whole strategy. The board answers
// "where can I go, from where I live", so the indexable version of it is one
// page per home airport — not per destination (a thousand travel sites already
// answer "weekend in Rome" better) and emphatically not per origin/destination
// PAIR, which would be 200x200 = 40,000 pages each carrying a single number.
// That is the thin auto-generated content search engines penalise, and it would
// put the whole domain at risk to chase long-tail queries.
//
// It exists because the board is a client component: a crawler sees 656
// characters of shell, with no city, no route and no price in it, and `?from=BCN`
// changes none of them. LLM crawlers do not run JavaScript either, so the same
// page serves both. /about is currently the only page on this site that can be
// read in full, which is not a foundation to grow traffic on.
//
// Rendered from the SAME search the board runs, via the shared module, so the
// two can never answer the same question differently.

// Daily. Prices move, but not by the second, and a page rendered once a day
// costs one search instead of one per visitor.
export const revalidate = 86400;
export const dynamicParams = true;

// NOTHING is prerendered, deliberately, and this is the second attempt at it.
//
// Every /from/* path renders on first request and is then cached for
// `revalidate`. There is no generateStaticParams at all, so Next has no list of
// paths to build ahead of time and cannot try.
//
// The first attempt returned [] only when TEQUILA_API_KEY was absent. That was
// too clever: prerendering a page here runs a real Kiwi search, the key is a
// RUNTIME Secret the build environment has never seen, and the whole deploy died
// on `Error occurred prerendering page "/from/bcn"`. A conditional still leaves
// the failure reachable — it only asks that an environment variable be exactly
// right — whereas having no build-time path list removes the failure mode
// itself. The cost is one visitor per origin per day paying ~2.5s. That is a
// fine price for a build that cannot break this way.
//
// The general rule: a page that needs a runtime secret must not be built at
// build time.

const IATA_RE = /^[A-Za-z]{3}$/;

function label(iata: string): string {
  return airportCity(iata.toUpperCase()) ?? iata.toUpperCase();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ iata: string }>;
}): Promise<Metadata> {
  const { iata } = await params;
  if (!IATA_RE.test(iata)) return {};
  const city = label(iata);
  const title = `Cheap weekend flights from ${city}`;
  return {
    title: `${title} — ${SITE_NAME}`,
    description: `Every weekend you could fly from ${city} in the next six months, with the cheapest destination and fare for each one. Updated daily.`,
    alternates: { canonical: `/from/${iata.toLowerCase()}` },
    openGraph: {
      title,
      description: `Every weekend you could fly from ${city}, cheapest first.`,
      url: `${siteUrl}/from/${iata.toLowerCase()}`,
      type: "website",
    },
  };
}

/** The cheapest deal on each weekend, chronological — the page's spine. */
function byWeekend(deals: Deal[]) {
  const map = new Map<string, Deal[]>();
  for (const d of deals) {
    const k = weekendKey(d.outDepart);
    if (!k) continue;
    (map.get(k) ?? map.set(k, []).get(k)!).push(d);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sat, list]) => ({
      sat,
      count: list.length,
      best: list.reduce((a, b) => (a.price <= b.price ? a : b)),
    }));
}

const MONTH = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" });
const DAY = new Intl.DateTimeFormat("en", { day: "numeric", timeZone: "UTC" });
const SHORT = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" });
const WEEKDAY = new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export default async function OriginPage({
  params,
}: {
  params: Promise<{ iata: string }>;
}) {
  const { iata } = await params;
  if (!IATA_RE.test(iata)) notFound();
  const code = iata.toUpperCase();
  const city = label(iata);

  let deals: Deal[] = [];
  let currency = "EUR";
  let fetchedAt = Date.now();
  try {
    const r = await searchWeekends({
      origins: [code],
      style: "strict",
      months: 6,
      adults: 1,
      direct: true,
    });
    deals = r.deals;
    currency = r.currency;
    fetchedAt = r.fetchedAt;
  } catch (e) {
    // A page that cannot answer its own question should not exist as a 200.
    if (e instanceof MissingApiKeyError) throw e;
    notFound();
  }
  if (deals.length === 0) notFound();

  const weekends = byWeekend(deals);
  const cheapest = deals[0];
  const prices = weekends.map((w) => w.best.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const destinations = new Set(deals.map((d) => d.cityTo)).size;
  const countries = new Set(deals.map((d) => d.countryTo)).size;
  const out = new Date(cheapest.outDepart);
  const back = new Date(cheapest.backDepart);
  const money = (n: number) =>
    new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

  let lastMonth = "";

  return (
    <main className="mx-auto w-full min-w-0 max-w-3xl p-4 sm:p-6">
      <header className="flex items-baseline justify-between gap-4 pb-6">
        <Link href="/" className="text-[17px] font-bold tracking-tight">
          weekend<span className="text-orange-600 dark:text-orange-400">.flights</span>
        </Link>
        <Link href="/" className="text-[12.5px] text-muted underline underline-offset-4">
          Flying from somewhere else?
        </Link>
      </header>

      <h1 className="text-[13px] font-semibold uppercase tracking-[0.09em] text-muted">
        Cheap weekend flights from {city}
      </h1>

      {/* The thesis. A crawler and an assistant both read this sentence and
          have the answer; a grid of destination cards gives neither anything to
          quote. Every number in it is real and refreshed daily. */}
      <p className="mt-4 max-w-[20ch] font-serif text-[clamp(1.9rem,5.4vw,2.9rem)] italic leading-[1.18] tracking-[-0.015em] text-balance">
        The cheapest weekend from {city} is {cheapest.cityTo}, at{" "}
        <span className="whitespace-nowrap not-italic text-orange-600 dark:text-orange-400">
          {money(cheapest.price)}
        </span>{" "}
        return.
      </p>
      <p className="mt-3.5 font-sans text-[15px] text-muted">
        Out {WEEKDAY.format(out)}, back {WEEKDAY.format(back)} — direct.
      </p>

      <p className="mt-6 flex flex-wrap items-baseline gap-x-3.5 gap-y-1 text-[12.5px] tabular-nums text-muted">
        <span><b className="font-semibold text-foreground">{destinations}</b> destinations</span>
        <span aria-hidden className="opacity-40">·</span>
        <span><b className="font-semibold text-foreground">{countries}</b> countries</span>
        <span aria-hidden className="opacity-40">·</span>
        <span><b className="font-semibold text-foreground">{weekends.length}</b> weekends ahead</span>
        <span aria-hidden className="opacity-40">·</span>
        <span>direct flights only</span>
      </p>

      {/* One row per WEEKEND, not per destination: the weekend is this
          product's unit of inventory, so the page is a calendar of departures
          rather than a storefront of places. It is also what makes the content
          genuinely unique per origin. */}
      <section className="mt-9 border-t border-black/10 dark:border-white/10">
        {weekends.map((w) => {
          const o = new Date(w.best.outDepart);
          const b = new Date(w.best.backDepart);
          const month = MONTH.format(o);
          const showMonth = month !== lastMonth;
          lastMonth = month;
          const isBest = w.best.price === min;
          const width = max > min ? 8 + ((w.best.price - min) / (max - min)) * 92 : 100;
          const sameMonth = o.getUTCMonth() === b.getUTCMonth();
          return (
            <div key={w.sat}>
              {showMonth && (
                <h2 className="px-2 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                  {month}
                </h2>
              )}
              <div
                className={`-mx-2 grid grid-cols-[86px_minmax(0,1fr)_62px] items-center gap-3 rounded-lg border-b border-black/[0.06] px-2 py-2.5 sm:grid-cols-[92px_minmax(0,1fr)_74px_66px] dark:border-white/[0.06] ${
                  isBest ? "bg-orange-500/[0.07] dark:bg-orange-400/10" : ""
                }`}
              >
                <div className="flex flex-col gap-px tabular-nums">
                  <span className="text-[14px] font-semibold tracking-[-0.01em]">
                    {sameMonth
                      ? `${DAY.format(o)}–${DAY.format(b)}`
                      : `${SHORT.format(o)} – ${SHORT.format(b)}`}
                  </span>
                  <span className="text-[10.5px] text-muted">
                    {w.best.nights} {w.best.nights === 1 ? "night" : "nights"}
                  </span>
                </div>
                <div className="flex min-w-0 items-baseline gap-1.5">
                  <span aria-hidden className="shrink-0 text-[13px]">{w.best.flag}</span>
                  <span className="truncate text-[14.5px] font-medium">{w.best.cityTo}</span>
                  <span className="hidden whitespace-nowrap text-[12px] text-muted sm:inline">
                    {w.best.countryTo}
                  </span>
                  {w.count > 1 && (
                    <span className="hidden shrink-0 whitespace-nowrap rounded-full border border-black/10 px-1.5 py-px text-[10.5px] text-muted sm:inline dark:border-white/15">
                      +{w.count - 1} more
                    </span>
                  )}
                </div>
                {/* The fare drawn to scale, so the shape of the season is
                    visible at a glance. The number is right beside it, so this
                    carries no information of its own. */}
                <span aria-hidden className="hidden h-[3px] overflow-hidden rounded-sm bg-black/[0.06] sm:block dark:bg-white/[0.08]">
                  <i
                    className={`block h-full rounded-sm ${isBest ? "bg-orange-600 dark:bg-orange-400" : "bg-muted/55"}`}
                    style={{ width: `${width}%` }}
                  />
                </span>
                <span
                  className={`text-right text-[15px] font-semibold tabular-nums tracking-[-0.02em] ${
                    isBest ? "text-orange-600 dark:text-orange-400" : ""
                  }`}
                >
                  {money(w.best.price)}
                </span>
              </div>
            </div>
          );
        })}
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3.5 rounded-2xl border border-black/10 p-5 dark:border-white/10">
        <p className="max-w-[42ch] text-[13.5px] text-muted">
          <strong className="font-semibold text-foreground">Prices move.</strong>{" "}
          This page is rebuilt daily; the board searches live and knows every
          airline on the route, not just the cheapest one per weekend.
        </p>
        <Link
          href={`/?from=${code}`}
          className="inline-flex shrink-0 items-center rounded-full bg-neutral-900 px-[18px] py-2.5 text-[13.5px] font-semibold text-white transition hover:opacity-90 dark:bg-white dark:text-black"
        >
          Search live from {city}
        </Link>
      </div>

      <p className="mt-7 text-[12px] text-muted">
        Checked{" "}
        <time dateTime={new Date(fetchedAt).toISOString()}>
          {new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" }).format(fetchedAt)}
        </time>
        . Fares are found by Kiwi.com and set at booking.
      </p>

      <footer className="mt-8 flex flex-col items-center gap-2 border-t border-black/10 pt-4.5 text-center text-xs leading-relaxed text-muted dark:border-white/10">
        <p className="max-w-prose">
          Flights, stays and activities are booked on Kiwi.com, Booking.com and
          GetYourGuide. We may earn a commission from those bookings, at no extra
          cost to you. Prices and availability are set by them, not by us.
        </p>
        <AboutDialog className="w-fit underline underline-offset-2 transition hover:text-black/70 dark:hover:text-white/70" />
      </footer>
    </main>
  );
}
