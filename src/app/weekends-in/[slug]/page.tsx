import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Deal } from "@/lib/deals";
import { searchWeekends, MissingApiKeyError } from "@/lib/weekend-search";
import { weekendKey } from "@/lib/calendar";
import { siteUrl, SITE_NAME } from "@/lib/site";
import { Masthead } from "@/components/Masthead";
import { DealList } from "@/components/DealList";
import { OriginLinks } from "@/components/OriginLinks";
import { DestinationLinks } from "@/components/DestinationLinks";
import {
  destinationBySlug,
  DESTINATION_FROM,
} from "@/lib/destination-pages";

// The destination mirror of /from/[iata]: one page per curated city,
// answering "cheap weekend in Rome" the way the origin pages answer "weekend
// flights from Vienna". Same architecture for the same reasons — daily
// revalidation, no generateStaticParams, notFound() instead of a throw that
// could take a build down, and ONE upstream search per page per day (all
// origin metros in a single fly_from list).
export const revalidate = 86400;
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const dest = destinationBySlug(slug);
  if (!dest) return {};
  const title = `A weekend in ${dest.city}: cheap Fri–Sun flights`;
  return {
    title: `${title} — ${SITE_NAME}`,
    description: `The cheapest weekend round trips to ${dest.city} from ${DESTINATION_FROM.length} European cities, one per weekend for the next six months. Updated daily.`,
    alternates: { canonical: `/weekends-in/${dest.slug}` },
    openGraph: {
      title,
      description: `Every weekend you could spend in ${dest.city}, cheapest fare first.`,
      url: `${siteUrl}/weekends-in/${dest.slug}`,
      type: "website",
    },
  };
}

export default async function DestinationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dest = destinationBySlug(slug);
  if (!dest) notFound();

  // A city never searches itself; metro overlaps (rome page, ROM origin)
  // would return zero-distance "trips".
  const origins = DESTINATION_FROM.filter((o) => o !== dest.code);

  let deals: Deal[] = [];
  let currency = "EUR";
  let fetchedAt = 0;
  try {
    // Two cached calls a day, one per axis: one_per_date covers every
    // WEEKEND (price-sorted rows otherwise drown in time-variants of the
    // same cheap ones — measured 51 distinct dates vs 31), the plain call
    // covers every ORIGIN. Merged, each section below gets the axis it needs.
    const base = {
      origins,
      flyTo: dest.code,
      flyToKeepAll: true,
      style: "strict" as const,
      months: 6,
      adults: 1,
      direct: true,
    };
    const [spine, variety] = await Promise.all([
      searchWeekends({ ...base, onePerDate: true }),
      searchWeekends(base),
    ]);
    deals = [...spine.deals, ...variety.deals];
    currency = spine.currency;
    fetchedAt = spine.fetchedAt;
  } catch (e) {
    if (e instanceof MissingApiKeyError) {
      console.error("Destination page: TEQUILA_API_KEY missing at render time");
    }
    notFound();
  }
  if (deals.length === 0) notFound();

  const money = (n: number) =>
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);

  // The page's spine: the cheapest way in, per weekend, chronological.
  const byWeekend = new Map<string, Deal>();
  for (const d of deals) {
    const k = weekendKey(d.outDepart);
    if (!k) continue;
    const cur = byWeekend.get(k);
    if (!cur || d.price < cur.price) byWeekend.set(k, d);
  }
  const weekends = [...byWeekend.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, d]) => d);

  // And the second cut: the cheapest fare from each origin city, for the
  // reader who starts from "I live in X" — each linking that city's board.
  const byOriginCity = new Map<string, Deal>();
  for (const d of deals) {
    const cur = byOriginCity.get(d.cityFrom);
    if (!cur || d.price < cur.price) byOriginCity.set(d.cityFrom, d);
  }
  const fromCities = [...byOriginCity.values()].sort(
    (a, b) => a.price - b.price
  );

  const cheapest = weekends.reduce((a, b) => (a.price <= b.price ? a : b));
  const monthName = (iso: string) =>
    new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(
      Date.parse(iso.slice(0, 10))
    );
  const prices = weekends.map((w) => w.price).sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)];
  const checkedOn = new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(fetchedAt);

  const faq: { q: string; a: string }[] = [
    {
      q: `How cheap is a weekend in ${dest.city}?`,
      a: `Right now the cheapest Fri–Sun round trip is ${money(cheapest.price)} from ${cheapest.cityFrom}. Across the next six months, half of all weekends have a way in at ${money(median)} or less.`,
    },
    {
      q: `Which cities have cheap direct weekend flights to ${dest.city}?`,
      a: `${fromCities.length} of ${origins.length} major European cities have direct Fri–Sun round trips. The cheapest right now: ${fromCities
        .slice(0, 3)
        .map((d) => `${d.cityFrom} (${money(d.price)})`)
        .join(", ")}.`,
    },
    {
      q: `When is the cheapest weekend to visit ${dest.city}?`,
      a: `The weekend of ${new Intl.DateTimeFormat("en", { day: "numeric", month: "long", timeZone: "UTC" }).format(Date.parse(cheapest.outDepart.slice(0, 10)))} (${monthName(cheapest.outDepart)}), at ${money(cheapest.price)} return from ${cheapest.cityFrom}.`,
    },
    {
      q: `Do I need to take days off work?`,
      a: `Usually not: every trip on this page leaves on Friday and returns on Sunday, so the work week stays intact. An early Friday departure can still mean leaving work after lunch, so check the times on the card.`,
    },
    {
      q: `How fresh are these prices?`,
      a: `This page was rebuilt on ${checkedOn} and refreshes daily. Fares are from Kiwi.com; the final price is always the one at checkout.`,
    },
  ];

  return (
    <main className="max-w-4xl mx-auto w-full min-w-0 p-4 sm:p-6 flex flex-col gap-4">
      <Masthead />

      <p className="flex flex-wrap items-baseline justify-center gap-x-2.5 gap-y-2 pb-3 text-center text-[15px]">
        <span className="text-muted-foreground">To</span>
        <span className="font-semibold">{dest.city}</span>
        <span aria-hidden className="text-black/25 dark:text-white/25">·</span>
        <span className="font-semibold">Fri–Sun</span>
        <span aria-hidden className="text-black/25 dark:text-white/25">·</span>
        <span className="font-semibold">direct</span>
        <span aria-hidden className="text-black/25 dark:text-white/25">·</span>
        <span className="font-semibold">1 adult</span>
      </p>

      <h1 className="sr-only">A weekend in {dest.city}: cheap Fri–Sun flights</h1>
      <p className="max-w-prose text-[15px] leading-relaxed">
        The cheapest weekend in {dest.city} right now costs{" "}
        <span className="font-semibold whitespace-nowrap text-orange-600 dark:text-orange-400">
          {money(cheapest.price)}
        </span>{" "}
        return, flying from{" "}
        <span className="font-semibold">{cheapest.cityFrom}</span>.{" "}
        {fromCities.length} European cities have a direct Fri–Sun way in.
      </p>

      <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[15px] font-semibold tracking-tight tabular-nums">
        {weekends.length} weekends ahead
        <span className="text-[11px] font-normal text-muted-foreground">
          from {fromCities.length} cities · checked{" "}
          <time dateTime={new Date(fetchedAt).toISOString()}>
            {checkedOn}
          </time>
        </span>
      </p>

      {/* One card per weekend — the cheapest way in that weekend, whatever
          the origin. showOrigin because the origin VARIES card to card here,
          which is exactly the fact the marker exists for. */}
      <DealList
        deals={weekends}
        loading={false}
        error={null}
        groupByMonth
        hideStops
        hideDays
        showOrigin
      />

      {/* The other way the question comes: "I live in X — what does Rome
          cost me?" Each city links its own board, which is also the crawl
          graph earning its keep. */}
      <section className="mt-2 flex flex-col gap-3 border-t border-black/10 pt-5 dark:border-white/10">
        <h2 className="text-base font-semibold tracking-tight">
          Cheapest from each city
        </h2>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
          {fromCities.map((d) => (
            <li key={d.cityFrom} className="flex items-baseline justify-between gap-2">
              <Link
                href={`/from/${d.flyFrom.toLowerCase()}`}
                className="truncate text-black/70 underline decoration-black/15 underline-offset-4 hover:text-black dark:text-white/70 dark:decoration-white/20 dark:hover:text-white"
              >
                {d.cityFrom}
              </Link>
              <span className="font-semibold whitespace-nowrap tabular-nums">
                {money(d.price)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-2 flex flex-col gap-4 border-t border-black/10 pt-5 dark:border-white/10">
        <h2 className="text-base font-semibold tracking-tight">
          A weekend in {dest.city}: quick answers
        </h2>
        {faq.map((f) => (
          <div key={f.q} className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold">{f.q}</h3>
            <p className="max-w-prose text-sm leading-relaxed text-black/70 dark:text-white/70">
              {f.a}
            </p>
          </div>
        ))}
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />

      <div className="mt-2 flex flex-col gap-4 border-t border-black/10 pt-4 dark:border-white/10">
        <DestinationLinks exclude={dest.slug} />
        <OriginLinks />
      </div>

      <footer className="mt-2 flex flex-col items-center gap-2 border-t border-black/10 pt-4 text-center text-xs leading-relaxed text-muted-foreground dark:border-white/10">
        <p className="max-w-prose">
          Flights, stays and activities are booked on Kiwi.com, Booking.com and
          GetYourGuide. We may earn a commission from those bookings, at no
          extra cost to you. Prices and availability are set by them, not by us.
        </p>
        <Link href="/about" className="underline underline-offset-4">
          About, privacy &amp; contact
        </Link>
      </footer>
    </main>
  );
}
