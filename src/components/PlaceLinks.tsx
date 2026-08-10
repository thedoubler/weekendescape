// "What does this place actually look like?" — the question a price table
// cannot answer, handed off to the two places people already go to answer it.
//
// Icons rather than words: this sits beside a section heading, and three text
// links there would compete with the weather and holiday rows that carry real
// information. On hover each takes its own brand colour, which is the only
// place in the app where brand colour other than ours appears — it is a
// deliberate signal that these leave the site.

// City AND country. "Memmingen" alone is ambiguous enough on a search engine,
// and the board is full of small towns that share a name with somewhere else
// entirely (Valencia, Cordoba, Santiago, Tripoli).
function place(city: string, country?: string): string {
  return country ? `${city} ${country}` : city;
}

const YOUTUBE = (city: string, country?: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${place(city, country)} travel`
  )}`;

// A HASHTAG, not a keyword search, and city only — no country.
//
// The keyword search (`/explore/search/keyword/?q=…`) was tried first and is
// worse on both counts: signed-out web visitors get an outright login wall, and
// a two-word query like "Memmingen Germany" has nothing to match, so it
// resolves to nothing even when signed in. The tag page for the same city
// returns real content (verified 2026-07-31: "Memmingen · 1.5M reels").
//
// Tags are single tokens, so the country has to be dropped here even though
// YouTube keeps it. Accents and punctuation go too — Cluj-Napoca is #clujnapoca.
const INSTAGRAM = (city: string) =>
  `https://www.instagram.com/explore/tags/${city
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")}/`;

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.5 15.6V8.4l6.3 3.6-6.3 3.6z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function PlaceLinks({
  city,
  country,
}: {
  city: string;
  country?: string;
}) {
  if (!city) return null;
  const label = place(city, country);
  // 44px on touch, tighter on desktop where the cursor is precise. The icons
  // themselves were 16px, which is below the size at which a brand mark is
  // recognisable at a glance.
  const base =
    "flex h-11 w-11 items-center justify-center rounded-full text-black/40 transition hover:bg-black/[0.06] sm:h-9 sm:w-9 dark:text-white/45 dark:hover:bg-white/10";
  return (
    <div className="-my-2 flex items-center gap-0.5 sm:-my-1">
      <a
        href={YOUTUBE(city, country)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Search YouTube for ${label} (opens a new tab)`}
        title={`${label} on YouTube`}
        className={`${base} hover:text-[#ff0000] dark:hover:text-[#ff4444]`}
      >
        <YouTubeIcon className="h-5 w-5" />
      </a>
      <a
        href={INSTAGRAM(city)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${city} on Instagram (opens a new tab)`}
        title={`#${city} on Instagram`}
        className={`${base} hover:text-[#c13584] dark:hover:text-[#e17fb8]`}
      >
        <InstagramIcon className="h-5 w-5" />
      </a>
    </div>
  );
}
