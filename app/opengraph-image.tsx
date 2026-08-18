import { ImageResponse } from "next/og";
import { SITE, PROJECTS } from "@/lib/project";
import { getMlSummary } from "@/lib/ml";
import { getCvarHeadline } from "@/lib/cvar";

export const alt = `${SITE.name} - ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Social preview card. The headline numbers are read from each study's saved
// output rather than typed in, so the card cannot drift from the work.
export default function Og() {
  const ml = getMlSummary();
  const cv = getCvarHeadline();

  // Satori requires any node with several children to declare display:flex, so
  // each line of text is assembled as a single string.
  const rows = [
    {
      n: "01",
      name: PROJECTS[0].navName,
      stat: `R² ${ml.avgR2.toFixed(2)} · direction ${(ml.avgDirAccuracy * 100).toFixed(1)}% · ${ml.total} NSE stocks`,
    },
    {
      n: "02",
      name: PROJECTS[1].navName,
      stat: `Sharpe ${cv.bestSharpe.value.toFixed(2)} to 1/N · min CVaR drawdown ${cv.shallowestDrawdown.value.toFixed(1)}%`,
    },
  ];

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
          padding: "68px",
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
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>
            {SITE.name}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              fontSize: 54,
              fontWeight: 800,
              lineHeight: 1.06,
              letterSpacing: -1.4,
              maxWidth: 1000,
            }}
          >
            Two studies, and neither found what it went looking for
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {rows.map((r) => (
            <div
              key={r.n}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 18,
                borderTop: "1px solid #1c2537",
                paddingTop: 16,
              }}
            >
              <div style={{ fontSize: 20, color: "#4d8dff", fontWeight: 600 }}>
                {r.n}
              </div>
              <div style={{ fontSize: 26, fontWeight: 600, width: 430 }}>
                {r.name}
              </div>
              <div style={{ fontSize: 21, color: "#9aa8c0" }}>{r.stat}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
