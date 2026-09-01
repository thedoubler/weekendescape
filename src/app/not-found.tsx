import Link from "next/link";
import { Masthead } from "@/components/Masthead";

// The 404, in the product's own voice: a board that answers "where can I go"
// answers a missing page the same way — with a deal card. One gag (the fare
// to Nowhere costs 404), told in the board's real visual language so it reads
// as this site being playful rather than a template being cute. Also reached
// by /from/[iata] pages whose airport can't be searched, so the copy blames
// the page, never the visitor's typing.

export const metadata = {
  title: "Not found — weekend.flights",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 pt-6 pb-10">
      <Masthead />

      <section className="mt-10 flex flex-col items-center gap-6 text-center">
        <p className="text-[11px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
          Flight 404 · departs never
        </p>
        <h2 className="text-[28px] leading-tight font-bold tracking-[-0.02em] text-balance sm:text-[34px]">
          This page isn&rsquo;t on the board.
        </h2>

        {/* The one deal this address has to offer, in the card language the
            rest of the site speaks. aria-hidden: it's a visual joke, and the
            headline + paragraph already carry the information. */}
        <div
          aria-hidden
          className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-4 text-left shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-lg font-bold">
              Nowhere{" "}
              <span className="text-sm font-normal text-muted-foreground">
                Terra Incognita
              </span>
            </p>
            <p className="text-lg font-bold whitespace-nowrap">404 EUR</p>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            0d 0h to explore · no return found · weather unknowable
          </p>
        </div>

        <p className="max-w-prose text-[15px] leading-relaxed text-black/70 dark:text-white/70">
          Whatever used to live at this address left no forwarding gate. The
          weekends that do exist — with real prices, real returns and somewhere
          to actually stand — are one tap away.
        </p>

        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-full bg-neutral-900 px-6 text-sm font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          See this weekend&rsquo;s flights
        </Link>
      </section>
    </main>
  );
}
