// The masthead, in one place, because two surfaces now show it: the board and
// the /from/[iata] origin pages. It was copied once and immediately started to
// drift — the origin page had a smaller wordmark, a left-aligned lockup and no
// tagline at all, so the two pages read as two products.
//
// Everything here is presentational, so it stays a server component and its
// markup ships in the HTML — which matters on the origin pages, where the whole
// point is that a crawler can read the page without running JavaScript.

export function Masthead() {
  return (
    <header className="flex flex-col items-center gap-1 pt-2 pb-3 text-center">
        {/* No eyebrow. Its whole lineage went: a rotating list of six
            audiences, then one frozen word, then gone — each cut asked for
            after seeing the previous one. The masthead survives it fine: the
            headline right below already names the reader ("Pick your
            airport"), which is what "for the spontaneous" was gesturing at. */}
        <h1 className="text-[38px] font-bold leading-[0.9] tracking-[-0.035em] sm:text-[54px]">
          {/* Split on the dot, because the dot is the joke: read as a domain
              it is an address, read as a lockup it is "weekend" and the thing
              you do about it. The accent takes the TLD and the dot with it, so
              the break lands where the meaning does.

              orange-600, not the brand #f97316: that hue is 2.8:1 on white and
              fails even the 3:1 large-text bar, while orange-600 clears it and
              still reads as the accent. Dark mode flips to orange-400, the
              lighter value a near-black ground needs. */}
          {/* The reveal: the accent run starts at the body colour and warms in,
              so ".flights" surfaces a beat after "weekend" rather than being
              coloured from the first frame. Colour only — no movement, no
              reflow, so the CLS budget stays zero and reduced-motion gets the
              finished state. */}
          <span aria-hidden>
            weekend<span className="wordmark-hi">.flights</span>
          </span>
          {/* The word intact for assistive tech and for copy-paste. */}
          <span className="sr-only">weekend.flights</span>
        </h1>
        {/* The headline says the MECHANIC, which is the one thing the rest of
            the page cannot say for itself. Three earlier versions were cut
            because each only restated the screen below it — the wordmark
            already says weekend.flights, the Searching line already says the
            origin and the trip shape, the Cheapest toggle already says the
            ranking. This is the deal being offered, not a description of the
            board.

            The two halves split at the SENTENCE, not mid-clause, and only
            where they have to. The promise now names what the product actually
            answers — when you can go, and where — which at 17px is 490px of
            text against 358px of phone. It has to break somewhere, and the
            original rule ("one line, not two") was really about the KIND of
            break: a hard wrap mid-clause read as an accident. Breaking between
            "your job" and "our job" reads as a deliberate stack, and it lands on
            the boundary the muted colour already marks. One line again from
            `sm`, where the whole sentence fits. */}
        <p className="mt-0.5 text-[17px] leading-snug font-semibold tracking-[-0.01em] text-balance sm:text-[20px]">
          Pick your airport.{" "}
          <span className="block font-medium text-muted sm:inline">
            We&rsquo;ll tell you when and where you can go.
          </span>
        </p>
    </header>
  );
}
