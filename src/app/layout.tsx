import type { Metadata } from "next";
import Script from "next/script";
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
const description =
  "Find the cheapest weekend round-trips from your home airport.";

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
        <script
          type="application/ld+json"
          // Local literal, no user input — nothing here can be injected.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
        {/* GA4. `afterInteractive` rather than the raw async tag from Google's
            snippet: next/script then loads it after hydration instead of
            competing with the board's own first paint, which is the number
            this product is judged on. Measurement id is a public identifier,
            so it is inline rather than an env var — nothing to leak.

            Production only. Without the guard every `npm run dev` session, and
            every preview deploy, writes into the same property as real
            visitors, and the first month of data is the one you cannot
            re-collect. */}
        {process.env.NODE_ENV === "production" && (
          <>
            <Script
              src="https://www.googletagmanager.com/gtag/js?id=G-BVSSW686DH"
              strategy="afterInteractive"
            />
            <Script id="ga4" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-BVSSW686DH');`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
