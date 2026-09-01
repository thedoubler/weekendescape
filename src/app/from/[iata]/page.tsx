import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { airportCity } from "@/lib/airport-city";
import { weekendKey } from "@/lib/calendar";
import { searchWeekends, MissingApiKeyError } from "@/lib/weekend-search";
import { SITE_NAME, siteUrl } from "@/lib/site";
import type { Deal } from "@/lib/deals";
import { AboutDialog } from "@/components/AboutDialog";
import { Masthead } from "@/components/Masthead";
import { DealList } from "@/components/DealList";

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
  // No Date.now() placeholder: it is impure during render, and the value is
  // always replaced by the search's own honest fetch time below.
  let fetchedAt = 0;
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
    // A page that cannot answer its own question should not exist as a 200 —
    // including when the reason is a missing key.
    //
    // This used to rethrow MissingApiKeyError, which is correct at runtime and
    // catastrophic at build time: if anything ever prerenders this route without
    // the runtime Secret, the throw escapes as "Export encountered an error" and
    // takes the WHOLE deploy down — rate limiting, CSP, SEO fixes and all. There
    // is no generateStaticParams any more, so that should never happen; this is
    // the belt to that braces, because the cost of being wrong is asymmetric. A
    // 404 on one origin page is a bad page. A failed build is no site at all.
    if (e instanceof MissingApiKeyError) {
      console.error("Origin page: TEQUILA_API_KEY missing at render time");
    }
    notFound();
  }
  if (deals.length === 0) notFound();

  const weekends = byWeekend(deals);
  const cheapest = deals[0];
  const destinations = new Set(deals.map((d) => d.cityTo)).size;
  const countries = new Set(deals.map((d) => d.countryTo)).size;
  const money = (n: number) =>
    new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);


  return (
    // The board's own wrapper, verbatim: same max width, same padding, same
    // column gap. The origin page used to be max-w-3xl with its own spacing,
    // which was enough to make the two surfaces feel like different products.
    <main className="max-w-4xl mx-auto w-full min-w-0 p-4 sm:p-6 flex flex-col gap-4">
      <Masthead />

      {/* The board's receipt line, stated rather than interactive. It is the
          same sentence in the same grammar — "From <city> · Fri–Sun · direct" —
          so someone arriving here from a search recognises the board they are
          about to land on. The values are fixed because this page IS one
          search; the live version is a click away. */}
      {/* No rule under the line — removed on the board's receipt by request,
          and this static twin follows it. */}
      <p className="flex flex-wrap items-baseline justify-center gap-x-2.5 gap-y-2 pb-3 text-center text-[15px]">
        <span className="text-muted-foreground">From</span>
        <span className="font-semibold">{city}</span>
        <span aria-hidden className="text-black/25 dark:text-white/25">·</span>
        <span className="font-semibold">Fri–Sun</span>
        <span aria-hidden className="text-black/25 dark:text-white/25">·</span>
        <span className="font-semibold">direct</span>
        <span aria-hidden className="text-black/25 dark:text-white/25">·</span>
        <span className="font-semibold">1 adult</span>
      </p>

      {/* The one thing this page has that the board does not, and the reason it
          exists: a sentence a crawler or an assistant can quote. It was set in
          display serif italic, which made a document out of a page that is
          meant to be the product — so it is now the board's own sans at reading
          size. The words are what matter here; the styling was the part that
          did not belong. */}
      <h1 className="sr-only">Cheap weekend flights from {city}</h1>
      <p className="max-w-prose text-[15px] leading-relaxed">
        The cheapest weekend from {city} is{" "}
        <span className="font-semibold">{cheapest.cityTo}</span>, at{" "}
        <span className="font-semibold whitespace-nowrap text-orange-600 dark:text-orange-400">
          {money(cheapest.price)}
        </span>{" "}
        return.
      </p>

      <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[15px] font-semibold tracking-tight tabular-nums">
        {weekends.length} weekends ahead
        <span className="text-[11px] font-normal text-muted-foreground">
          {destinations} destinations · {countries} countries · checked{" "}
          <time dateTime={new Date(fetchedAt).toISOString()}>
            {new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" }).format(fetchedAt)}
          </time>
        </span>
      </p>

      {/* The board's own list component, so a weekend looks the same here as it
          does there — same card, same day strip, same month dividers, same booking
          hand-off. It also means this page inherits every future card change for
          free, which the hand-rolled ledger never would. Chronological, because
          this page answers "when could I go" rather than "what is cheapest". */}
      <DealList
        deals={weekends.map((w) => w.best)}
        loading={false}
        error={null}
        groupByMonth
        hideStops
        hideDays
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3.5 rounded-2xl border border-black/10 p-5 dark:border-white/10">
        <p className="max-w-[42ch] text-[13.5px] text-muted-foreground">
          <strong className="font-semibold text-foreground">Prices move.</strong>{" "}
          This page is rebuilt daily and shows the cheapest trip per weekend. The
          board searches live and knows every airline on the route.
        </p>
        <Link
          href={`/?from=${code}`}
          className="inline-flex shrink-0 items-center rounded-full bg-neutral-900 px-[18px] py-2.5 text-[13.5px] font-semibold text-white transition hover:opacity-90 dark:bg-white dark:text-black"
        >
          Search live from {city}
        </Link>
      </div>

      <footer className="mt-2 flex flex-col items-center gap-2 border-t border-black/10 pt-4 text-center text-xs leading-relaxed text-muted-foreground dark:border-white/10">
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
