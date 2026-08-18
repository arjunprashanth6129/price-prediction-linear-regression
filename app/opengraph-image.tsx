import { ImageResponse } from "next/og";
import { SITE, PROJECTS } from "@/lib/project";

export const alt = SITE.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Social preview card for the site as a whole. It names the two projects and
// says nothing about their results - the same rule the landing page follows.
export default function Og() {
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
          {/* One text child: Satori requires display:flex on any node with
              more than one, and an interpolation beside literal text is two. */}
          <div style={{ fontSize: 24, color: "#9aa8c0", letterSpacing: 0.5 }}>
            {`${SITE.author} Prashanth`}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 88,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: -2.4,
            }}
          >
            {SITE.name}
          </div>
          <div style={{ fontSize: 27, color: "#9aa8c0", maxWidth: 940 }}>
            {SITE.tagline}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {PROJECTS.map((p, i) => (
            <div
              key={p.href}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 20,
                borderTop: "1px solid #1c2537",
                paddingTop: 15,
              }}
            >
              <div style={{ fontSize: 19, color: "#4d8dff", fontWeight: 600 }}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <div style={{ fontSize: 28, fontWeight: 600 }}>{p.name}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
