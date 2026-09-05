import type { Metadata } from "next";
import { Space_Grotesk, Instrument_Serif } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

// Display serif for headlines only — its warmth against Space Grotesk's
// geometry gives the brand personality without touching the UI/data type.
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});

import { siteUrl, SITE_NAME } from "@/lib/site";
const title = `${SITE_NAME} — cheapest weekend flights`;
// ~160 chars, and every clause is a real feature: the one-per-weekend board,
// bridge-day hunting, meet-up mode. The generic one-liner sold none of what
// makes this board different from a search engine.
const description =
  "Cheapest weekend round trips from your home airport — one per weekend, six months ahead. Hunt bridge-day long weekends, or meet a friend flying from another city.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  // og:image / twitter:image are added automatically from src/app/opengraph-image.tsx
  openGraph: {
    title,
    description,
    siteName: SITE_NAME,
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

// Minimal and truthful. Deliberately no SearchAction: the sitelinks searchbox
// it targets was retired by Google in 2024, so it would be markup that asserts
// something no consumer acts on.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: siteUrl,
  description,
  applicationCategory: "TravelApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript.",
  // Still minimal and truthful — each entry is a shipped, user-facing mode,
  // named in the product's own words.
  featureList: [
    "Cheapest fare for every weekend, six months ahead",
    "Bridge-day long weekend hunting around public holidays",
    "Meet-up search: two or three cities, one destination, same weekend",
    "Search up to three home airports at once",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${instrumentSerif.variable} h-full`}
    >
      {/* overflow-x-CLIP, not -hidden, and the difference is not cosmetic.
          `overflow-x: hidden` forces body's computed overflow-y to `auto`,
          which makes body a scroll container — one that can never actually
          scroll (its scrollHeight equals its clientHeight; the viewport
          scrolls via html). Chrome's SMOOTH scrollIntoView walks the ancestor
          chain, meets that inert scroll container, and silently stops: every
          smooth jump-to-card on the page was a no-op (behavior:"auto" still
          worked, which is what made it look intermittent). `clip` clips the
          same sideways overflow without creating a scroll container. */}
      <body className="min-h-full flex flex-col overflow-x-clip">
        {/* GA4, as Google's literal snippet rendered into the SERVER HTML.
            The next/script version (strategy="afterInteractive") injected the
            tag after hydration, which kept it out of the initial document —
            and Google's tag detector reads the document, so it reported "your
            Google tag wasn't detected" while analytics half-worked. A tag that
            exists to be found has to be in the HTML. Measurement id is a
            public identifier, so it is inline rather than an env var.

            FIRST in <body>, not last. React 19 hoists the src half into
            <head> on its own, but an inline script renders exactly where it
            is — at the end of the body it sat ~20 KB into the document,
            beyond where Google's static scanner pairs it with the loader.
            Here it lands within the first ~3 KB, immediately after </head>.

            Production only. Without the guard every `npm run dev` session and
            every preview deploy writes into the same property as real
            visitors, and the first month of data is the one you cannot
            re-collect. */}
        {process.env.NODE_ENV === "production" && (
          <>
            <script
              async
              src="https://www.googletagmanager.com/gtag/js?id=G-BVSSW686DH"
            />
            <script
              // Google's own bootstrap, verbatim; a local literal, no user
              // input — nothing here can be injected.
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-BVSSW686DH');`,
              }}
            />
          </>
        )}
        <script
          type="application/ld+json"
          // Local literal, no user input — nothing here can be injected.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
