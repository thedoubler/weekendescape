import { ImageResponse } from "next/og";
import { spaceGroteskBold, spaceGroteskRegular } from "./og-fonts";

// Site-wide Open Graph / Twitter card, generated in code so it matches the app's
// header and dark palette. Next auto-adds the og:image / twitter tags.
export const alt = "weekend.flights — cheapest weekend getaways from home";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  // Passing `fonts` replaces Satori's default, so we bundle the one face the
  // card renders. Space Grotesk is the header's face; the wordmark is a
  // weight/colour treatment of it, not a second family.
  //
  // Read from a bundled module rather than from disk: Cloudflare Workers has no
  // filesystem, so the readFile version threw on every request and this route
  // 500'd in production — which meant every shared link had no preview image.
  const sans = spaceGroteskRegular();
  const sansBold = spaceGroteskBold();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "96px",
          background:
            "radial-gradient(900px 520px at 82% 8%, rgba(249,115,22,0.22), rgba(20,22,28,0) 60%), #14161c",
          fontFamily: "Space Grotesk",
        }}
      >
        {/* Mark + mono eyebrow */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "62px",
              height: "62px",
              borderRadius: "16px",
              background: "#f97316",
            }}
          >
            <svg width="38" height="38" viewBox="0 0 24 24" fill="#14161c">
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
              <circle cx="19.6" cy="4.4" r="1.7" />
            </svg>
          </div>
          <div
            style={{
              color: "#9aa1ac",
              fontSize: "22px",
              letterSpacing: "7px",
              textTransform: "uppercase",
            }}
          >
            Est · Cheapest Weekends
          </div>
        </div>

        {/* Hero wordmark — "weekend.flights", with the same split-on-the-dot
            colour treatment the header uses, so the share card and the page
            read as one brand rather than two. */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            marginTop: "40px",
            fontSize: "104px",
            lineHeight: 1,
            letterSpacing: "-3px",
            color: "#f5f6f8",
          }}
        >
          <span style={{ fontWeight: 700 }}>weekend</span>
          <span style={{ fontWeight: 700, color: "#f97316" }}>.flights</span>
        </div>

        {/* Value prop */}
        <div
          style={{
            marginTop: "40px",
            maxWidth: "880px",
            color: "#9aa1ac",
            fontSize: "34px",
            lineHeight: 1.35,
          }}
        >
          Out Friday, back Sunday — round-trips ranked by price, weather and
          real airport distance.
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Space Grotesk", data: sans, style: "normal", weight: 400 },
        { name: "Space Grotesk", data: sansBold, style: "normal", weight: 700 },
      ],
    }
  );
}
