import { ImageResponse } from "next/og";
import { PROJECT } from "@/lib/project";
import { getMlSummary } from "@/lib/ml";

export const alt = PROJECT.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Social preview card. The headline numbers are read from the results rather
// than typed in, so the card cannot drift from the study behind it.
export default function Og() {
  const s = getMlSummary();
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

  // Satori requires a node with several children to declare display:flex, so
  // the deck is assembled as one string and rendered as a single text child.
  const deck =
    `${s.total} NSE stocks · seven years of daily closes · ` +
    `R² ${s.avgR2.toFixed(2)} on returns, direction correct ` +
    `${pct(s.avgDirAccuracy)} of the time`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0b0f18",
          padding: "72px",
          color: "#e8edf7",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              border: "1px solid #2a3651",
              background: "#161f30",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M3 12h18" stroke="#4d8dff" strokeWidth={2} strokeLinecap="round" />
              <circle cx="6.5" cy="7" r="1.5" fill="#4d8dff" />
              <circle cx="11" cy="16.5" r="1.5" fill="#4d8dff" />
              <circle cx="15.5" cy="6" r="1.5" fill="#4d8dff" />
              <circle cx="19" cy="17" r="1.5" fill="#4d8dff" />
            </svg>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>
            Price prediction with a linear regression model
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: 62,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              maxWidth: 980,
            }}
          >
            Can price momentum predict tomorrow&apos;s return?
          </div>
          <div style={{ fontSize: 27, color: "#9aa8c0", maxWidth: 940 }}>
            {deck}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 40,
            fontSize: 23,
            color: "#7c8aa4",
            borderTop: "1px solid #1c2537",
            paddingTop: 28,
          }}
        >
          <span>scikit-learn · pandas</span>
          <span>Next.js · TypeScript</span>
          <span>Reproducible pipeline</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
