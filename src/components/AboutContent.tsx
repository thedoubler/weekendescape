import { SITE_NAME } from "@/lib/site";

// The About copy, in one place, rendered by two surfaces: the /about route and
// the dialog the board's footer opens. It stays a real route because it is the
// only page on this site a crawler can read in full; a modal-only version
// would trade the site's one indexable page for a convenience.
//
// Voice rules, set by the owner: short, first person where a person is
// actually speaking (this is a one-person project and the page should say
// so), and NO em dashes. The long dash had become this page's tic, and it
// reads as generated. Full stops and colons do the work instead.
//
// No "use client": plain markup, so it renders on the server for the route
// and ships inside the dialog's client bundle for the board.

// The env var still wins, so a fork or a staging deploy can point somewhere
// else. The real address is the default: a shipped product with no way to
// reach it is worse than one that hard-codes the obvious address.
const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@weekend.flights";
const COFFEE_URL = process.env.NEXT_PUBLIC_COFFEE_URL ?? "";

const SECTIONS = [
  { id: "how", title: "How it works" },
  { id: "data", title: "The data" },
  { id: "money", title: "Money" },
  { id: "privacy", title: "Privacy" },
  { id: "contact", title: "Contact" },
] as const;

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    // scroll-mt so a jump from the top links doesn't bury the heading under
    // the dialog's padding; works in both surfaces because the browser
    // scrolls the nearest scrollable ancestor.
    <section
      id={id}
      className="flex scroll-mt-4 flex-col gap-2.5 border-t border-black/10 pt-6 dark:border-white/10"
    >
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export function AboutContent() {
  return (
    <>
      <header className="flex flex-col gap-2.5">
        <p className="text-[15px] leading-relaxed text-black dark:text-white">
          Most trips start with where. This one starts with when: you already
          have the weekends, and the board shows where each of them can take
          you, cheapest first.
        </p>
        <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
          Not a booking site. It finds the trips and hands you to the people
          who sell them.
        </p>
        {/* Section links, per the owner's ask: the page is read for one
            answer at a time, so the top hands you straight to it. */}
        <nav
          aria-label="On this page"
          className="mt-1 flex flex-wrap gap-x-3 gap-y-1.5 text-[12.5px]"
        >
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="text-muted-foreground underline decoration-black/20 underline-offset-4 transition-colors hover:text-black dark:decoration-white/25 dark:hover:text-white"
            >
              {s.title}
            </a>
          ))}
        </nav>
      </header>
      <Section id="how" title="How it works">
        <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
          Give it a home airport, or let it find yours. It searches every
          weekend in the months ahead and shows the cheapest first, with the
          things that usually go unmentioned: bag fees, how far the airport
          really is from the city, typical weather, public holidays nearby.
        </p>
        <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
          <span className="font-medium text-black dark:text-white">
            Long weekends
          </span>{" "}
          searches around your public holidays instead of fixed
          Fri&ndash;Sun. National ones always count. Your region&rsquo;s count
          too once the board knows it, and it tells you which region it
          assumed.
        </p>
      </Section>

      <Section id="data" title="The data">
        <ul className="flex flex-col gap-1.5 text-sm leading-relaxed text-black/70 dark:text-white/70">
          <li>
            <span className="font-medium text-black dark:text-white">
              Flights and prices:
            </span>{" "}
            Kiwi.com, live at the time the &ldquo;checked&rdquo; stamp shows.
          </li>
          <li>
            <span className="font-medium text-black dark:text-white">
              Weather:
            </span>{" "}
            Open-Meteo. Past the forecast window it&rsquo;s five-year averages,
            labelled as such.
          </li>
          <li>
            <span className="font-medium text-black dark:text-white">
              Public holidays:
            </span>{" "}
            Nager.Date. Regional holidays are named as regional.
          </li>
          <li>
            <span className="font-medium text-black dark:text-white">
              Maps:
            </span>{" "}
            OpenStreetMap, served by OpenFreeMap.
          </li>
        </ul>
        <p className="text-sm leading-relaxed text-black/60 dark:text-white/60">
          The final price is whatever checkout shows, never this page.
        </p>
      </Section>

      <Section id="money" title="Money">
        <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
          Affiliate links. Book through Kiwi.com, Booking.com or GetYourGuide
          after following a link from here and I may earn a commission. Your
          price is the same, results rank by price, and nobody pays to appear.
        </p>
      </Section>

      <Section id="privacy" title="Privacy">
        <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
          No accounts, no advertising pixels.
        </p>
        <ul className="flex flex-col gap-1.5 text-sm leading-relaxed text-black/70 dark:text-white/70">
          <li>
            <span className="font-medium text-black dark:text-white">
              Analytics:
            </span>{" "}
            Google Analytics counts visits, PostHog records which controls get
            used. Anonymous ids, never tied to anything you type.
          </li>
          <li>
            <span className="font-medium text-black dark:text-white">
              Location:
            </span>{" "}
            only if you allow it, only to find your nearest airport. Never
            stored or shared.
          </li>
          <li>
            <span className="font-medium text-black dark:text-white">
              Home airports:
            </span>{" "}
            remembered in your own browser. They leave it only inside a search.
          </li>
          <li>
            <span className="font-medium text-black dark:text-white">
              Third parties:
            </span>{" "}
            the services above see your IP like any site visit. The
            GetYourGuide panel loads only if you open it; outbound links live
            under their own terms.
          </li>
        </ul>
      </Section>

      <Section id="contact" title="Contact">
        <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
          I run {SITE_NAME} alone. Wrong price, mislabelled airport, an airline
          under the wrong name: tell me and I&rsquo;ll fix it. Ideas,
          collaborations and partnerships are welcome at the same address.
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
            If it saved you money,{" "}
            <a
              className="font-medium text-black underline underline-offset-4 dark:text-white"
              href={COFFEE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              you can buy me a coffee
            </a>
            . Entirely optional.
          </p>
        )}
      </Section>
    </>
  );
}
