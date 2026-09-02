import { SITE_NAME } from "@/lib/site";

// The About copy, in one place, rendered by two surfaces: the /about route and
// the dialog the board's footer opens. It stays a real route because it is the
// only page on this site a crawler can read in full — a modal-only version
// would trade the site's one indexable page for a convenience.
//
// No "use client": this is plain markup, so it renders on the server for the
// route and ships inside the dialog's client bundle for the board.

// The env var still wins, so a fork or a staging deploy can point somewhere
// else — but the real address is the default, because a shipped product with no
// way to reach it is worse than one that hard-codes the obvious address.
const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@weekend.flights";
const COFFEE_URL = process.env.NEXT_PUBLIC_COFFEE_URL ?? "";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5 border-t border-black/10 pt-6 dark:border-white/10">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export function AboutContent() {
  return (
    <>
      <header className="flex flex-col gap-2.5">
        {/* The thesis, in the fewest words that carry it — and only the
            thesis. The old second paragraph restated it with "a board of the
            cheapest…" and was cut in the conciseness pass. */}
        <p className="text-[15px] leading-relaxed text-black dark:text-white">
          Most trips start with where. This one starts with when: you already
          have the weekends, and the board shows where each of them can take
          you, cheapest first.
        </p>
        <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
          Not a booking site — it finds the trips and hands you to the people
          who sell them.
        </p>
      </header>
      <Section title="How it works">
        <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
          Give it a home airport — or let it find yours — and it searches every
          weekend in the months ahead, cheapest first. Each result carries what
          usually goes unmentioned: bag fees, how far the airport really is
          from the city, typical weather, and public holidays nearby.
        </p>
        <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
          <span className="font-medium text-black dark:text-white">
            Long weekends
          </span>{" "}
          — a trip-length choice that searches around your public holidays
          instead of fixed Fri&ndash;Sun. National ones always count; your
          region&rsquo;s count once the board knows it, and it says which
          region it assumed.
        </p>
      </Section>

      <Section title="Where the numbers come from">
        <ul className="flex flex-col gap-1.5 text-sm leading-relaxed text-black/70 dark:text-white/70">
          <li>
            <span className="font-medium text-black dark:text-white">
              Flights and prices
            </span>{" "}
            — Kiwi.com, live at the time the “checked” stamp shows.
          </li>
          <li>
            <span className="font-medium text-black dark:text-white">
              Weather
            </span>{" "}
            — Open-Meteo. Beyond the forecast window, five-year averages for
            those dates, labelled as such.
          </li>
          <li>
            <span className="font-medium text-black dark:text-white">
              Public holidays
            </span>{" "}
            — Nager.Date. Regional holidays are named as regional, never
            passed off as national.
          </li>
          <li>
            <span className="font-medium text-black dark:text-white">
              Maps
            </span>{" "}
            — OpenStreetMap data, served as tiles by OpenFreeMap.
          </li>
        </ul>
        <p className="text-sm leading-relaxed text-black/60 dark:text-white/60">
          The final price is whatever checkout shows — never this page.
        </p>
      </Section>

      <Section title="How it makes money">
        <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
          Affiliate links: book through Kiwi.com, Booking.com or GetYourGuide
          after following a link from here and this site may earn a commission.
          The price to you is the same, and it changes nothing you are shown —
          results rank by price, and nobody pays to appear.
        </p>
      </Section>

      <Section title="What it stores about you">
        <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
          No accounts, no advertising pixels. Two measurement tools run, both
          named below.
        </p>
        <ul className="flex flex-col gap-1.5 text-sm leading-relaxed text-black/70 dark:text-white/70">
          <li>
            <span className="font-medium text-black dark:text-white">
              Analytics
            </span>{" "}
            &mdash; Google Analytics counts visits; PostHog records which
            controls get used. Both on anonymous ids, their scripts and their
            terms — never tied to your searches or anything you type.
          </li>
          <li>
            <span className="font-medium text-black dark:text-white">
              Your location
            </span>{" "}
            — only if you allow the prompt, only to find your nearest airport.
            Never stored or shared; declining changes nothing else.
          </li>
          <li>
            <span className="font-medium text-black dark:text-white">
              Your home airports
            </span>{" "}
            — remembered in your own browser. They leave your device only
            inside a flight search.
          </li>
          <li>
            <span className="font-medium text-black dark:text-white">
              Third parties
            </span>{" "}
            — the services above see your IP as any site visit would. The
            GetYourGuide panel is their embed and loads only if you open it;
            outbound links land on their sites, under their terms.
          </li>
        </ul>
      </Section>

      <Section title="Get in touch">
        <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
          Wrong price, mislabelled airport, an airline under the wrong name —
          those reports fix things fastest.
        </p>
        {CONTACT_EMAIL ? (
          <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
            <a
              className="font-medium text-black underline underline-offset-4 dark:text-white"
              href={`mailto:${CONTACT_EMAIL}`}
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        ) : (
          // Rendering "contact us" with no way to do so is worse than silence.
          <p className="text-sm leading-relaxed text-black/55 dark:text-white/55">
            Set <code className="font-mono">NEXT_PUBLIC_CONTACT_EMAIL</code> to
            show an address here.
          </p>
        )}
        {COFFEE_URL && (
          <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
            This is an independent project run by one person. If it saved you
            money,{" "}
            <a
              className="font-medium text-black underline underline-offset-4 dark:text-white"
              href={COFFEE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              you can buy me a coffee
            </a>
            . Entirely optional — the affiliate links above already keep it
            running.
          </p>
        )}
      </Section>
    </>
  );
}
