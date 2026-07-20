import { ImageResponse } from "next/og";

// Site-wide Open Graph / Twitter card, generated in code so it matches the app's
// dark palette without a binary asset. Next auto-adds the og:image / twitter tags
// for every route from this file.
export const alt = "Weekend Escape — cheapest weekend getaways from home";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "88px",
          // Soft off-black base (matches globals.css) with a warm corner glow.
          background:
            "radial-gradient(900px 500px at 82% 12%, rgba(249,115,22,0.20), rgba(20,22,28,0) 60%), #14161c",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "22px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "66px",
              height: "66px",
              borderRadius: "18px",
              background: "#f97316",
            }}
          >
            {/* Inline sparkle (the default OG font lacks the ✦ glyph). */}
            <svg width="40" height="40" viewBox="0 0 24 24" fill="#14161c">
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
            </svg>
          </div>
          <div style={{ color: "#e7e8ec", fontSize: "34px", fontWeight: 600 }}>
            Weekend Escape
          </div>
        </div>

        <div
          style={{
            marginTop: "48px",
            maxWidth: "900px",
            color: "#f5f6f8",
            fontSize: "76px",
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: "-1.5px",
          }}
        >
          Cheapest weekend getaways from home
        </div>

        <div
          style={{
            marginTop: "30px",
            color: "#9aa1ac",
            fontSize: "32px",
            lineHeight: 1.3,
          }}
        >
          Fly out Friday, back Monday — round-trips ranked by price, weather and
          real airport distance.
        </div>
      </div>
    ),
    { ...size }
  );
}
