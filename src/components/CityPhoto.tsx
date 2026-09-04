"use client";

import { useState } from "react";

// The city's lead photo, atop the "In {city}" section — the panel's "what is
// it like there" question answered in the only medium that actually answers
// it. Mounted with the panel (everOpened), so a board of 78 cards costs zero
// photo requests until someone opens one.
//
// The frame reserves its height up front: the weather row below already
// learned that a late-arriving element must not reflow the open panel. Only
// an ERROR collapses the space (unmount), and that path is rare — the route
// 404s when Wikipedia has no lead image for the city.
export default function CityPhoto({
  city,
  country,
}: {
  city: string;
  country?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  const params = new URLSearchParams({ city });
  if (country) params.set("country", country);
  return (
    <div className="relative h-36 w-full overflow-hidden rounded-xl border border-black/10 bg-black/[0.04] sm:h-44 dark:border-white/10 dark:bg-white/[0.06]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/city-photo?${params}`}
        // Decorative: the section heading right above already says the city's
        // name, so alt text would announce it twice.
        alt=""
        loading="lazy"
        className="h-full w-full object-cover opacity-0 transition-opacity duration-300 data-[loaded]:opacity-100"
        onLoad={(e) => e.currentTarget.setAttribute("data-loaded", "")}
        onError={() => setFailed(true)}
      />
      {/* The image is Wikipedia's, and the chip is both the credit and the
          deep link for "tell me more about this place". Search URL, not a
          guessed article title — the same disambiguation reasoning as the
          API route ("Nice", "Split"). */}
      <a
        href={`https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(
          country ? `${city} ${country}` : city
        )}`}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute right-2 bottom-2 rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm transition hover:bg-black/60 hover:text-white"
      >
        Wikipedia
      </a>
    </div>
  );
}
