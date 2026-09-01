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
        {/* The thesis, in the fewest words that carry it. Everything on the
            board is organised around the one unit of free time everyone
            already has — the weekend — so the pitch leads with that reversal
            rather than with what the site technically is. */}
        <p className="text-[15px] leading-relaxed text-black dark:text-white">
          Most trips start with where. This one starts with when: you already
          have the weekends, and the board shows where each of them can take
          you, cheapest first.
        </p>
        <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
          A board of the cheapest round-trip weekend flights from your home
          airport. Not a booking site — it finds the trips and hands you to the
          people who sell them.
        </p>
      </header>
      <Section title="How it works">
        <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
          You give it a home airport (or let it guess from your location). It
          searches every weekend in the months ahead and ranks what comes back by
          price. Most flight search asks where you want to go; this asks the
          question the other way round.
        </p>
        <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
          Each result carries the things that change a short trip and usually
          go unmentioned: what a checked bag costs on that airline, how far the
          airport really is from the city it is sold as, the typical weather for
          those dates, and whether a public holiday falls nearby — so one day of
          leave can buy you four.
        </p>
        <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
          <span className="font-medium text-black dark:text-white">
            Long weekends
          </span>{" "}
          — a choice under trip length. Instead of fixed Fri–Sun trips, the
          board reads your country&rsquo;s public holidays and searches around
          them: out on the holiday&rsquo;s edge, back after the weekend it
          touches. National holidays always count; a regional one counts only
          when it is yours — the board says which region it assumed from your
          airport, and you can correct it right there.
        </p>
      </Section>

      <Section title="Where the numbers come from">
        <ul className="flex flex-col gap-1.5 text-sm leading-relaxed text-black/70 dark:text-white/70">
          <li>
            <span className="font-medium text-black dark:text-white">
              Flights and prices
            </span>{" "}
            — Kiwi.com. Live at the time shown by the “checked” stamp on the
            board, and re-checked regularly.
          </li>
          <li>
            <span className="font-medium text-black dark:text-white">
              Weather
            </span>{" "}
            — Open-Meteo. Beyond the forecast window these are five-year
            averages for those dates, labelled as such. Nobody can forecast a
            weekend five months out; this is what the weather is usually like.
          </li>
          <li>
            <span className="font-medium text-black dark:text-white">
              Public holidays
            </span>{" "}
            — Nager.Date. Where a holiday is regional rather than national, the
            card says so rather than claiming the whole country is off.
          </li>
          <li>
            <span className="font-medium text-black dark:text-white">
              Maps
            </span>{" "}
            — OpenStreetMap data, served as tiles by OpenFreeMap.
          </li>
        </ul>
        <p className="text-sm leading-relaxed text-black/60 dark:text-white/60">
          Prices move, and airlines change bag rules. The final price is
          whatever the airline or agent shows you at checkout — never this page.
        </p>
      </Section>

      <Section title="How it makes money">
        <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
          Affiliate links. If you book a flight through Kiwi.com, a stay through
          Booking.com, or an activity through GetYourGuide after following a link
          from here, this site may earn a commission. It costs you nothing extra
          — the price is the same as going there directly.
        </p>
        <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
          It does not change what you are shown. Results are ranked by price, and
          no destination, airline or hotel pays to appear or to rank higher.
        </p>
      </Section>

      <Section title="What it stores about you">
        <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
          No accounts, no advertising pixels. One measurement tool runs, named
          below.
        </p>
        <ul className="flex flex-col gap-1.5 text-sm leading-relaxed text-black/70 dark:text-white/70">
          <li>
            <span className="font-medium text-black dark:text-white">
              Usage analytics
            </span>{" "}
            &mdash; Google Analytics counts visits: which pages, what device,
            roughly where from. Google&rsquo;s script, Google&rsquo;s
            identifiers, Google&rsquo;s terms. Not tied to your searches, your
            airports or anything you type.
          </li>
          <li>
            <span className="font-medium text-black dark:text-white">
              Your location
            </span>{" "}
            — only if you allow the browser prompt, and only to find your nearest
            airport. The coordinates are used to answer that one question and are
            not stored against you or shared. Decline and you can type the
            airport in instead; everything else works the same.
          </li>
          <li>
            <span className="font-medium text-black dark:text-white">
              Your home airports
            </span>{" "}
            — kept in your own browser’s local storage so the board remembers
            them next time. They never leave your device except as part of a
            flight search. Clearing your browser data removes them.
          </li>
          <li>
            <span className="font-medium text-black dark:text-white">
              Third parties
            </span>{" "}
            — loading a page means your browser talks to the services above, so
            they can see your IP address as any website visit would. The
            GetYourGuide activities panel is their embed and may set its own
            identifiers; it loads only if you open it. Following a link to
            Kiwi.com, Booking.com or GetYourGuide takes you to their site, under
            their own privacy terms.
          </li>
        </ul>
      </Section>

      <Section title="Get in touch">
        <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
          Wrong price, a mislabelled airport, an airline shown under the wrong
          name — those reports are genuinely useful, and the data gaps get fixed
          fastest when someone points at one.
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
