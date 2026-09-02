import { NextRequest, NextResponse } from "next/server";

// Airline logos, proxied so they can be CACHED HARD. Kiwi's CDN serves them
// with max-age=604800 (a week), which still meant every new visitor and every
// cache eviction went back to images.kiwi.com — and the owner wants Kiwi
// touched as little as possible. Same-origin also means the existing
// img-src 'self' in the CSP covers it.
//
//   browser:  public, max-age=31536000, immutable — a logo never changes for
//             a given code, and if an airline rebrands, a week's staleness on
//             a 16px icon is invisible.
//   server:   next revalidate 604800 — the worker's data cache re-fetches a
//             logo from Kiwi at most weekly, however many visitors ask.
const UPSTREAM = "https://images.kiwi.com/airlines/64";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ code: string }> }
) {
  const { code } = await ctx.params;
  // IATA airline designators: two or three characters, letters and digits.
  // Anything else is not a logo lookup and must not become an upstream
  // passthrough.
  if (!/^[A-Z0-9]{2,3}$/i.test(code)) {
    return NextResponse.json({ error: "Invalid airline code" }, { status: 400 });
  }
  try {
    const res = await fetch(`${UPSTREAM}/${code.toUpperCase()}.png`, {
      next: { revalidate: 604800 },
    } as RequestInit);
    if (!res.ok) {
      // The card's <img onError> hides itself; a 404 body is never seen.
      return new NextResponse(null, { status: 404 });
    }
    const body = await res.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
