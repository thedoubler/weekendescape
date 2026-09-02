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
          {/* A LINK, because a logo that does nothing is a dead tap — the
              universal convention is logo-goes-home. On the board itself,
              bare "/" doubles as the reset: a fresh boot with the remembered
              airports and every setting back to default. A plain <a>, not
              next/link: the point on the board is the full reload. */}
          <a href="/" className="text-inherit no-underline">
            <span aria-hidden>
              weekend<span className="wordmark-hi">.flights</span>
            </span>
            {/* The word intact for assistive tech and for copy-paste. */}
            <span className="sr-only">weekend.flights — start over</span>
          </a>
        </h1>
        {/* The promise, and only the promise.
            "Pick your airport." was an instruction, and it was the half doing
            the least work: the board below already opens with an airport field,
            so the line spent its first three words telling the reader to do
            something the screen was already asking for. What it could not say
            for itself is what it gives back — when you can go, and where.
            Present tense, not "we'll": the board is already showing it.

            One sentence now, so the old two-tone split (your job bold, our job
            muted) has nothing to separate and is gone. At 17px it is 322px
            against the 358px a 390px phone gives, so it holds one line
            everywhere and the original "one line, not two" rule is intact. */}
        <p className="mt-0.5 text-[17px] leading-snug font-semibold tracking-[-0.01em] text-balance sm:text-[20px]">
          We tell you when and where you can go.
        </p>
    </header>
  );
}
