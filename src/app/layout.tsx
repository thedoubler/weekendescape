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

// Absolute base for OG image URLs. Prefers an explicit env var, then Vercel's
// stable production domain, else localhost in dev.
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

// The product is called shortliday — short + holiday. The name has to match
// the header everywhere it is quoted back at a reader: tab title, search
// result, link preview, share card. It used to say "Weekend Escape" in all
// four while the page said shortliday.
export const SITE_NAME = "shortliday";
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
      <body className="min-h-full flex flex-col overflow-x-hidden">
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
