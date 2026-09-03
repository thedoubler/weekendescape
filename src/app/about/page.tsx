import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import { AboutContent } from "@/components/AboutContent";
import { OriginLinks } from "@/components/OriginLinks";

// One page carrying About + how it works + affiliate disclosure + privacy +
// contact. Deliberately NOT a marketing page: the board sells itself, and a
// hero here would duplicate it. What this page is actually for is being a real,
// contactable, compliant operator — which the affiliate programmes expect and
// which the geolocation prompt on the board makes a fair thing to ask for.
//
// The board's footer now opens the same copy in a dialog, but this route stays:
// it is static, it prerenders, and it is the only page on a client-rendered
// site that a crawler can read in full. The dialog is the convenience; this is
// the address.

export const metadata: Metadata = {
  title: `About — ${SITE_NAME}`,
  description:
    "What weekend.flights is, where its numbers come from, how it makes money, what it stores, and how to get in touch.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <main className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-3">
        <Link
          href="/"
          className="w-fit text-sm text-muted-foreground underline underline-offset-4 transition hover:text-black dark:hover:text-white"
        >
          ← Back to the board
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          About {SITE_NAME}
        </h1>
      </header>
      <AboutContent />
      <div className="mt-2 border-t border-black/10 pt-6 dark:border-white/10">
        <OriginLinks />
      </div>
    </main>
  );
}
