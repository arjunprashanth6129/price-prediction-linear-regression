// The signal under test, drawn from real data rather than sketched.
//
// These are BRITANNIA's actual 5-day and 20-day moving averages from July to
// December 2019, scaled into the viewBox. Both crossings and both markers are
// computed from the series (linear interpolation between the two closes that
// straddle each crossing), so the dots sit exactly where the lines meet - an
// earlier hand-drawn version had the markers floating several pixels off the
// intersections, which is precisely the sort of thing this page argues against.
//
// No axes and no gridlines: the shape is the point, and the numbers are in the
// charts further down.

const FAST = "#4d8dff";
const SLOW = "#7c8aa4";
const POS = "#2fbf71";
const NEG = "#f1566a";

const FAST_D =
  "M 14.0 119.4 L 17.7 120.8 L 21.4 121.9 L 25.1 123.9 L 28.8 124.6 L 32.4 125.6 L 36.1 126.6 L 39.8 128.0 L 43.5 128.9 L 47.2 129.8 L 50.9 130.2 L 54.6 130.3 L 58.3 131.5 L 62.0 132.8 L 65.6 133.5 L 69.3 135.3 L 73.0 138.8 L 76.7 141.1 L 80.4 141.7 L 84.1 142.3 L 87.8 141.3 L 91.5 136.1 L 95.2 130.4 L 98.8 126.2 L 102.5 122.0 L 106.2 118.9 L 109.9 119.8 L 113.6 120.3 L 117.3 120.4 L 121.0 120.7 L 124.7 121.5 L 128.4 120.7 L 132.0 120.8 L 135.7 120.0 L 139.4 119.8 L 143.1 120.7 L 146.8 121.7 L 150.5 118.3 L 154.2 112.2 L 157.9 105.3 L 161.6 97.8 L 165.2 89.4 L 168.9 86.7 L 172.6 88.7 L 176.3 91.6 L 180.0 93.9 L 183.7 98.4 L 187.4 99.5 L 191.1 97.4 L 194.8 95.3 L 198.4 92.1 L 202.1 87.4 L 205.8 83.3 L 209.5 81.2 L 213.2 77.5 L 216.9 74.4 L 220.6 71.9 L 224.3 69.9 L 228.0 68.0 L 231.6 67.7 L 235.3 67.5 L 239.0 65.7 L 242.7 65.7 L 246.4 66.1 L 250.1 66.0 L 253.8 66.4 L 257.5 68.5 L 261.2 69.6 L 264.8 70.4 L 268.5 72.4 L 272.2 74.5 L 275.9 73.8 L 279.6 73.8 L 283.3 74.3 L 287.0 74.6 L 290.7 74.6 L 294.4 77.3 L 298.0 80.2 L 301.7 83.2 L 305.4 85.0 L 309.1 86.2 L 312.8 86.6 L 316.5 86.2 L 320.2 85.6 L 323.9 84.9 L 327.6 85.0 L 331.2 85.8 L 334.9 86.1 L 338.6 85.8 L 342.3 86.2 L 346.0 86.0";

const SLOW_D =
  "M 14.0 114.4 L 17.7 114.7 L 21.4 115.0 L 25.1 115.7 L 28.8 116.5 L 32.4 117.5 L 36.1 118.5 L 39.8 119.3 L 43.5 120.2 L 47.2 121.1 L 50.9 121.9 L 54.6 122.7 L 58.3 123.8 L 62.0 124.9 L 65.6 126.2 L 69.3 127.6 L 73.0 129.1 L 76.7 130.6 L 80.4 131.9 L 84.1 132.6 L 87.8 133.1 L 91.5 133.0 L 95.2 132.8 L 98.8 132.4 L 102.5 131.9 L 106.2 131.5 L 109.9 131.3 L 113.6 130.8 L 117.3 130.3 L 121.0 129.7 L 124.7 129.3 L 128.4 128.9 L 132.0 128.1 L 135.7 127.1 L 139.4 126.2 L 143.1 125.6 L 146.8 124.6 L 150.5 122.4 L 154.2 119.7 L 157.9 117.0 L 161.6 114.7 L 165.2 112.9 L 168.9 111.5 L 172.6 110.3 L 176.3 109.4 L 180.0 108.5 L 183.7 107.5 L 187.4 106.3 L 191.1 104.6 L 194.8 103.0 L 198.4 101.1 L 202.1 99.2 L 205.8 96.9 L 209.5 94.9 L 213.2 92.4 L 216.9 89.6 L 220.6 86.8 L 224.3 84.9 L 228.0 83.8 L 231.6 83.0 L 235.3 82.0 L 239.0 80.8 L 242.7 79.6 L 246.4 78.2 L 250.1 76.6 L 253.8 75.1 L 257.5 73.4 L 261.2 72.2 L 264.8 71.4 L 268.5 70.9 L 272.2 70.7 L 275.9 70.0 L 279.6 69.8 L 283.3 69.7 L 287.0 70.2 L 290.7 70.8 L 294.4 71.3 L 298.0 72.3 L 301.7 73.5 L 305.4 74.5 L 309.1 75.4 L 312.8 76.6 L 316.5 77.4 L 320.2 78.4 L 323.9 79.2 L 327.6 80.1 L 331.2 80.9 L 334.9 81.6 L 338.6 82.2 L 342.3 82.7 L 346.0 83.0";

// Computed crossings, not eyeballed.
const GOLDEN = { x: 93.6, y: 132.8 };
const DEATH = { x: 266.3, y: 71.2 };

export default function CrossDiagram() {
  return (
    <figure className="rounded-xl border border-line bg-ink-850/50 p-4">
      <svg
        viewBox="0 0 360 200"
        className="h-auto w-full"
        role="img"
        aria-label="Britannia's 5-day moving average crossing above its 20-day average at a golden cross in August 2019, then back below it at a death cross in November 2019."
      >
        <path
          d={SLOW_D}
          fill="none"
          stroke={SLOW}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={FAST_D}
          fill="none"
          stroke={FAST}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Death cross - label above, where the plot area is clear */}
        <line
          x1={DEATH.x}
          y1={DEATH.y - 7}
          x2={DEATH.x}
          y2={DEATH.y - 21}
          stroke={NEG}
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
        <text
          x={DEATH.x}
          y={DEATH.y - 27}
          fill={NEG}
          fontSize="11"
          textAnchor="middle"
        >
          Death Cross ↓
        </text>
        <circle
          cx={DEATH.x}
          cy={DEATH.y}
          r="4.5"
          fill={NEG}
          stroke="#101725"
          strokeWidth="1.5"
        />

        {/* Golden cross - label below */}
        <line
          x1={GOLDEN.x}
          y1={GOLDEN.y + 7}
          x2={GOLDEN.x}
          y2={GOLDEN.y + 21}
          stroke={POS}
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
        <text
          x={GOLDEN.x}
          y={GOLDEN.y + 34}
          fill={POS}
          fontSize="11"
          textAnchor="middle"
        >
          Golden Cross ↑
        </text>
        <circle
          cx={GOLDEN.x}
          cy={GOLDEN.y}
          r="4.5"
          fill={POS}
          stroke="#101725"
          strokeWidth="1.5"
        />

        {/* Key */}
        <g fontSize="10">
          <line x1="14" y1="190" x2="34" y2="190" stroke={FAST} strokeWidth="2.5" />
          <text x="40" y="193.5" fill={FAST}>
            5-day MA
          </text>
          <line x1="104" y1="190" x2="124" y2="190" stroke={SLOW} strokeWidth="2" />
          <text x="130" y="193.5" fill={SLOW}>
            20-day MA
          </text>
        </g>
      </svg>
      <figcaption className="mt-3 text-[12px] leading-relaxed text-fg-dim">
        Britannia, July-December 2019 - real closes, not an illustration. When
        the fast average climbs above the slow one traders call it a golden
        cross and read it as bullish; the reverse is a death cross. It is one of
        the most cited signals in retail trading, which is exactly why it is
        worth checking.
      </figcaption>
    </figure>
  );
}
