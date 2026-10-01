"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { useMounted } from "./useMounted";
import { STRATEGY_COLOUR } from "@/lib/cvar";

/* ------------------------------------------------------------------ */
/* Theme                                                               */
/* ------------------------------------------------------------------ */
// Recharts takes real colour values, not Tailwind classes, so the tokens are
// mirrored here. Keep in step with app/globals.css.
const AXIS = "#64748b";
const GRID = "#e2e8f0";
const REF = "#cbd5e1";
const FG = "#0f172a";
const SURFACE = "#ffffff";

// Five hues far apart in hue angle, all light enough to carry on the dark card
// surface. Defined once in lib/cvar.ts so the charts and the table swatches
// cannot drift apart.
const SERIES: Record<string, string> = STRATEGY_COLOUR;

/* ------------------------------------------------------------------ */
/* Shells                                                              */
/* ------------------------------------------------------------------ */
const axisProps = {
  stroke: GRID,
  tick: { fill: AXIS, fontSize: 11 },
  tickLine: false,
} as const;

/** Reserve the final height so hydration never shifts the page. */
export function Figure({
  title,
  height,
  lead,
  children,
  caption,
}: {
  title: string;
  height: number;
  /**
   * Legend or controls, drawn above the reserved chart box.
   *
   * These used to sit inside the box alongside a chart sized at `height - 46`,
   * a hardcoded guess at one line of legend. A legend that wrapped to two or
   * three lines - which every one of them does at 375px - pushed the chart
   * straight through the bottom of its figure and into the caption. Keeping it
   * outside means `height` is the chart's height and nothing has to guess.
   */
  lead?: React.ReactNode;
  children: React.ReactNode;
  caption?: React.ReactNode;
}) {
  const mounted = useMounted();
  return (
    <figure className="my-6 rounded-xl border border-line bg-surface p-4 sm:p-5">
      <figcaption className="mb-4 text-[13px] font-medium text-ink">
        {title}
      </figcaption>
      {lead}
      <div style={{ height }} className="w-full">
        {mounted ? (
          children
        ) : (
          <div className="h-full w-full rounded-lg border border-line bg-surface-2" />
        )}
      </div>
      {caption && (
        <p className="mt-4 text-[12px] leading-relaxed text-ink-dim">{caption}</p>
      )}
    </figure>
  );
}

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line-strong bg-paper px-3 py-2 shadow-lg shadow-ink/10">
      {children}
    </div>
  );
}

/** Shared legend for a set of named series. */
export function SeriesLegend({
  keys,
  labels,
  colours,
}: {
  keys: string[];
  labels: Record<string, string>;
  colours?: Record<string, string>;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {keys.map((k) => (
        <span key={k} className="flex items-center gap-1.5 text-[11.5px] text-ink-muted">
          <i
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-sm"
            style={{ background: (colours ?? SERIES)[k] }}
          />
          {labels[k] ?? k}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Efficient frontier, with a weights panel                         */
/* ------------------------------------------------------------------ */
export interface FrontierDot {
  cvar: number;
  ret: number;
  vol: number;
  dd: number;
  holdings: number;
  weights: Record<string, number>;
  index: number;
}
export interface StrategyDot extends Omit<FrontierDot, "index"> {
  key: string;
  label: string;
}

/**
 * Fixed-size diamond for the named strategies.
 *
 * Recharts sizes scatter symbols from a chart-wide ZAxis range, so the strategy
 * marks could not be made larger than the frontier dots through props alone.
 * Drawing the symbol directly sidesteps that, and the surface-coloured outline
 * keeps two coincident diamonds (min variance and min CVaR) readable as two
 * marks rather than one.
 */
function Ring(props: { cx?: number; cy?: number }) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill="#ffffff"
      stroke="#9aa8c0"
      strokeWidth={1.4}
    />
  );
}

function Diamond(props: {
  cx?: number;
  cy?: number;
  fill?: string;
  payload?: { key?: string };
}) {
  const { cx, cy, fill, payload } = props;
  if (cx == null || cy == null) return null;
  // Min variance sits 0.006 points from min CVaR on CVaR and a quarter point on
  // return - visually the same place. Drawing it larger, and first, means it
  // reads as a ring around min CVaR instead of vanishing underneath it.
  const r = payload?.key === "min_variance" ? 10 : 7;
  return (
    <path
      d={`M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`}
      fill={fill}
      stroke="#ffffff"
      strokeWidth={1.5}
    />
  );
}

/** A frontier ring or a strategy diamond; `key` is set only on strategies. */
type MarkDot = Omit<FrontierDot, "index"> & {
  // Named `title`, not `label`: Recharts drops a `label` field from the
  // tooltip payload, which left the tooltip heading blank.
  title: string;
  key?: string;
  index?: number;
};

function Mark(props: { cx?: number; cy?: number; payload?: MarkDot }) {
  const key = props.payload?.key;
  return key ? (
    <Diamond cx={props.cx} cy={props.cy} fill={SERIES[key]} payload={{ key }} />
  ) : (
    <Ring cx={props.cx} cy={props.cy} />
  );
}

export function Frontier({
  curve,
  strategies,
  assets,
  assetShort,
  colours,
}: {
  curve: FrontierDot[];
  strategies: StrategyDot[];
  assets: string[];
  assetShort: Record<string, string>;
  colours: Record<string, string>;
}) {
  // The panel starts on min CVaR, which is the portfolio the project is about.
  const [picked, setPicked] = useState<{
    title: string;
    sub: string;
    cvar: number;
    ret: number;
    vol: number;
    dd: number;
    weights: Record<string, number>;
  }>(() => {
    const s = strategies.find((d) => d.key === "min_cvar") ?? strategies[0];
    return {
      title: s.label,
      sub: `${s.holdings} holdings above 0.01%`,
      cvar: s.cvar,
      ret: s.ret,
      vol: s.vol,
      dd: s.dd,
      weights: s.weights,
    };
  });

  const held = assets
    .filter((a) => (picked.weights[a] ?? 0) > 1e-4)
    .sort((a, b) => picked.weights[b] - picked.weights[a]);

  // Frontier rings first and strategy diamonds after, so the diamonds draw on
  // top. Every mark carries its own label.
  const marks: MarkDot[] = [
    ...curve.map((d) => ({ ...d, title: `Frontier point ${d.index + 1}` })),
    ...strategies.map((d) => ({ ...d, title: d.label })),
  ];

  const pick = (d: FrontierDot | StrategyDot | MarkDot, title: string) =>
    setPicked({
      title,
      sub: `${d.holdings} holdings above 0.01%`,
      cvar: d.cvar,
      ret: d.ret,
      vol: d.vol,
      dd: d.dd,
      weights: d.weights,
    });

  // All five strategies sit inside the bottom-left corner of the frontier, so a
  // single chart either shows the whole curve and squashes them together or
  // shows them and loses the curve. Two panels do both: same data, same marks,
  // different window, and the second one states its range in its title.
  // Axis ends are rounded to the tick step, so no axis stops on an odd value
  // like 79% or 2.2%.
  const steps = (lo: number, hi: number, step: number) => {
    const out: number[] = [];
    for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step)
      out.push(Number(v.toFixed(4)));
    return out;
  };
  const full: [number, number] = [
    0,
    Math.ceil(Math.max(...curve.map((d) => d.cvar)) + 0.4),
  ];
  const fullY: [number, number] = [
    0,
    Math.ceil((Math.max(...curve.map((d) => d.ret)) + 4) / 20) * 20,
  ];
  const zoom: [number, number] = [
    Math.floor((Math.min(...strategies.map((d) => d.cvar)) - 0.08) * 5) / 5,
    Math.ceil((Math.max(...strategies.map((d) => d.cvar)) + 0.3) * 5) / 5,
  ];
  const zoomY: [number, number] = [
    Math.floor((Math.min(...strategies.map((d) => d.ret)) - 2) / 4) * 4,
    Math.ceil((Math.max(...strategies.map((d) => d.ret)) + 3) / 4) * 4,
  ];

  // The hover card is drawn here rather than by Recharts' <Tooltip>. With two
  // kinds of mark on one chart, the Recharts tooltip resolved a hover by array
  // position and reported the wrong portfolio (hovering frontier point 5 could
  // show "Min CVaR"). The scatter's own mouse events carry the exact point, the
  // same object a click receives, so the card and the weights panel agree.
  const [hover, setHover] = useState<{
    panel: string;
    d: MarkDot;
    x: number;
    y: number;
    flip: boolean;
  } | null>(null);

  const chart = (
    panel: string,
    xDomain: [number, number],
    yDomain: [number, number],
    xTicks: number[],
    yTicks: number[],
    tickFmt: (v: number) => string,
  ) => (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart margin={{ top: 8, right: 14, bottom: 24, left: 2 }}>
          <CartesianGrid stroke={GRID} />
          <XAxis
            type="number"
            dataKey="cvar"
            domain={xDomain}
            ticks={xTicks}
            allowDataOverflow
            {...axisProps}
            tickFormatter={tickFmt}
            label={{
              value: "Daily CVaR 95% (loss)",
              position: "insideBottom",
              offset: -14,
              fill: AXIS,
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            dataKey="ret"
            domain={yDomain}
            ticks={yTicks}
            allowDataOverflow
            {...axisProps}
            width={42}
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
          />
          <ZAxis range={[46, 46]} />
          {/* The frontier itself. Without it the 25 points read as a cloud
              rather than as a boundary nothing can sit below. */}
          <Line
            data={curve}
            type="monotone"
            dataKey="ret"
            stroke={AXIS}
            strokeWidth={1.4}
            strokeOpacity={0.5}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
            legendType="none"
          />
          {/* Rings and diamonds are one series, rings first so the diamonds
              draw on top. */}
          <Scatter
            data={marks}
            className="cursor-pointer"
            shape={<Mark />}
            isAnimationActive={false}
            onMouseEnter={(p: unknown, _i: number, e: React.MouseEvent) => {
              const d = p as MarkDot & { cx: number; cy: number };
              const svg = (e.target as SVGElement).ownerSVGElement;
              const width = svg?.clientWidth ?? 0;
              setHover({ panel, d, x: d.cx, y: d.cy, flip: d.cx > width * 0.6 });
            }}
            onMouseLeave={() => setHover(null)}
            onClick={(p: unknown) => {
              const d = p as MarkDot;
              pick(d, d.title);
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      {hover?.panel === panel && (
        <div
          className="pointer-events-none absolute z-10"
          style={{
            left: hover.x,
            top: hover.y,
            transform: hover.flip
              ? "translate(calc(-100% - 14px), -50%)"
              : "translate(14px, -50%)",
          }}
        >
          <TipBox>
            <div className="text-[12px] font-semibold text-ink">
              {hover.d.title}
            </div>
            <div className="mt-1 space-y-0.5 whitespace-nowrap text-[11px] text-ink-muted">
              <div>
                return{" "}
                <span className="tnum text-ink">{hover.d.ret.toFixed(2)}%</span>
              </div>
              <div>
                CVaR 95{" "}
                <span className="tnum text-ink">{hover.d.cvar.toFixed(3)}%</span>
              </div>
              <div>
                max drawdown{" "}
                <span className="tnum text-ink">{hover.d.dd.toFixed(2)}%</span>
              </div>
            </div>
          </TipBox>
        </div>
      )}
    </div>
  );

  return (
    <div className="my-6 space-y-4">
      <SeriesLegend
        keys={strategies.map((d) => d.key)}
        labels={Object.fromEntries(strategies.map((d) => [d.key, d.label]))}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Figure
          title="The whole frontier"
          height={300}
          caption={
            <>
              Each of the {curve.length} rings is a separately optimised frontier
              portfolio. No long-only portfolio of these assets lies above or to
              the left of the curve. The five rules lie in the lower-left region,
              magnified on the right.
            </>
          }
        >
          {chart("full", full, fullY, steps(full[0], full[1], 2), steps(fullY[0], fullY[1], 20), (v) => `${v.toFixed(0)}%`)}
        </Figure>

        <Figure
          title={`The five strategies, magnified (CVaR ${zoom[0].toFixed(1)}% to ${zoom[1].toFixed(1)}%)`}
          height={300}
          caption={
            <>
              Minimum variance and minimum CVaR are 0.006 percentage points apart
              in CVaR, so their markers nearly coincide; minimum variance is drawn
              larger so that both are visible. Select a marker to show its
              weights below.
            </>
          }
        >
          {chart("zoom", zoom, zoomY, steps(zoom[0], zoom[1], 0.4), steps(zoomY[0], zoomY[1], 4), (v) => `${v.toFixed(1)}%`)}
        </Figure>
      </div>

      {/* Weights panel. Laid out horizontally so it stays compact rather than
          stretching to a chart's height with a four-row table in it. */}
      <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[14px] font-semibold text-ink">{picked.title}</h3>
          <span className="text-[11px] text-ink-dim">{picked.sub}</span>
        </div>

        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <dl className="grid grid-cols-2 gap-px self-start overflow-hidden rounded-lg border border-line bg-line xs:grid-cols-4 lg:grid-cols-2">
            {[
              ["Expected return", `${picked.ret.toFixed(2)}%`],
              ["CVaR 95% (daily)", `${picked.cvar.toFixed(3)}%`],
              ["Volatility", `${picked.vol.toFixed(2)}%`],
              ["Max drawdown", `${picked.dd.toFixed(2)}%`],
            ].map(([k, v]) => (
              <div key={k} className="bg-surface-2 px-3 py-2.5">
                <dt className="text-[10px] uppercase tracking-wider text-ink-dim">
                  {k}
                </dt>
                <dd className="tnum mt-1 text-[15px] font-semibold text-ink">{v}</dd>
              </div>
            ))}
          </dl>

          <div>
            <h4 className="text-[12px] font-medium text-ink">Allocation</h4>
            <div className="mt-2 flex h-3 w-full overflow-hidden rounded-sm">
              {held.map((a) => (
                <div
                  key={a}
                  style={{
                    width: `${picked.weights[a] * 100}%`,
                    background: colours[a],
                  }}
                  title={`${assetShort[a]} ${(picked.weights[a] * 100).toFixed(2)}%`}
                />
              ))}
            </div>
            {/* Two columns once there are more than four holdings, so a
                twelve-asset frontier point does not run down the page. */}
            <div
              className={`mt-3 grid gap-x-6 ${held.length > 4 ? "sm:grid-cols-2" : ""}`}
            >
              {held.map((a) => (
                <div
                  key={a}
                  className="flex items-baseline justify-between gap-3 border-t border-line/60 py-1.5 text-[12px]"
                >
                  <span className="text-ink-muted">
                    <span
                      aria-hidden
                      className="mr-2 inline-block h-2 w-2 rounded-sm align-middle"
                      style={{ background: colours[a] }}
                    />
                    {assetShort[a] ?? a}
                  </span>
                  <span className="tnum font-medium text-ink">
                    {(picked.weights[a] * 100).toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Stacked allocations                                              */
/* ------------------------------------------------------------------ */
/**
 * Label for a stacked segment, drawn only when the segment can actually hold it.
 *
 * The guard used to be a percentage threshold, which is width-blind. At 390px
 * the plot area is about 260px wide, so a 7% segment is 18px across and the
 * equal-weight row printed twelve "8%" labels straight through each other.
 * Deciding from the rendered pixel width makes the rule hold at any viewport.
 */
function SegmentLabel(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  value?: number | string;
}) {
  const { x, y, width, height, value } = props;
  if (x == null || y == null || width == null || height == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;

  const text = `${Math.round(n)}%`;
  // Roughly 6px per glyph at 10px semibold, plus 4px of clearance either side.
  if (width < text.length * 6 + 8) return null;

  return (
    <text
      x={x + width / 2}
      y={y + height / 2}
      textAnchor="middle"
      dominantBaseline="central"
      fill="#ffffff"
      fontSize={10}
      fontWeight={600}
    >
      {text}
    </text>
  );
}

export function Allocations({
  rows,
  assets,
  assetShort,
  colours,
  title,
  height = 260,
  caption,
  note,
}: {
  rows: { label: string; weights: Record<string, number>; note?: string }[];
  assets: string[];
  assetShort: Record<string, string>;
  colours: Record<string, string>;
  title: string;
  height?: number;
  caption?: React.ReactNode;
  note?: string;
}) {
  // Recharts wants one flat object per row with a key per series.
  const data = rows.map((r) => ({
    label: r.label,
    note: r.note ?? "",
    ...Object.fromEntries(assets.map((a) => [a, (r.weights[a] ?? 0) * 100])),
  }));
  const held = assets.filter((a) => rows.some((r) => (r.weights[a] ?? 0) > 1e-4));

  return (
    <Figure
      title={title}
      height={height}
      caption={caption}
      lead={<SeriesLegend keys={held} labels={assetShort} colours={colours} />}
    >
      <>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: note ? 120 : 12, bottom: 18, left: 4 }}
            barCategoryGap={12}
          >
            <XAxis
              type="number"
              domain={[0, 100]}
              {...axisProps}
              tickFormatter={(v: number) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="label"
              {...axisProps}
              width={126}
              tick={{ fill: AXIS, fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: "rgba(15,23,42,0.04)" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const rowsIn = payload
                  .filter((p) => Number(p.value) > 0.01)
                  .sort((a, b) => Number(b.value) - Number(a.value));
                return (
                  <TipBox>
                    <div className="text-[12px] font-semibold text-ink">{label}</div>
                    <div className="mt-1 space-y-0.5">
                      {rowsIn.map((p) => (
                        <div
                          key={String(p.dataKey)}
                          className="flex items-center gap-2 text-[11px]"
                        >
                          <i
                            aria-hidden
                            className="h-2 w-2 rounded-sm"
                            style={{ background: p.color }}
                          />
                          <span className="text-ink-muted">
                            {assetShort[String(p.dataKey)] ?? String(p.dataKey)}
                          </span>
                          <span className="tnum ml-auto text-ink">
                            {Number(p.value).toFixed(2)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </TipBox>
                );
              }}
            />
            {held.map((a) => (
              <Bar
                key={a}
                dataKey={a}
                stackId="w"
                fill={colours[a]}
                isAnimationActive={false}
              >
                <LabelList dataKey={a} content={<SegmentLabel />} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </>
    </Figure>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Out-of-sample equity and drawdown                                */
/* ------------------------------------------------------------------ */
export interface CurvePoint {
  date: string;
  [k: string]: string | number;
}

export function EquityCurves({
  data,
  keys,
  labels,
  span,
}: {
  data: CurvePoint[];
  keys: string[];
  labels: Record<string, string>;
  span: string;
}) {
  const ticks = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const d of data) {
      const y = d.date.slice(0, 4);
      if (!seen.has(y)) {
        seen.add(y);
        out.push(d.date);
      }
    }
    return out;
  }, [data]);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { month: "short", year: "numeric" });

  // Drawdown from the running peak, computed per series.
  const dd = useMemo(() => {
    const peak: Record<string, number> = {};
    return data.map((row) => {
      const out: CurvePoint = { date: row.date };
      for (const k of keys) {
        const v = Number(row[k]);
        if (!Number.isFinite(v)) continue;
        peak[k] = Math.max(peak[k] ?? v, v);
        out[k] = (v / peak[k] - 1) * 100;
      }
      return out;
    });
  }, [data, keys]);

  return (
    <>
      <Figure
        title={`Growth of 1.0 out of sample, net of costs - ${span}`}
        height={314}
        caption={
          <>
            Weights are re-estimated each quarter on the trailing 500 days and
            held until the next rebalance, drifting with returns in between. The
            dotted line is the Nifty ETF held throughout. Minimum CVaR has the
            lowest growth and the shallowest drawdown.
          </>
        }
        lead={<SeriesLegend keys={keys} labels={labels} />}
      >
        <>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 14, bottom: 20, left: 2 }}>
              <CartesianGrid stroke={GRID} />
              <XAxis
                dataKey="date"
                ticks={ticks}
                tickFormatter={(d: string) => d.slice(0, 4)}
                {...axisProps}
              />
              <YAxis
                {...axisProps}
                width={44}
                domain={[0.9, 6.2]}
                ticks={[1, 2, 3, 4, 5, 6]}
                tickFormatter={(v: number) => `${v}x`}
              />
              <Tooltip
                cursor={{ strokeDasharray: "3 3", stroke: REF }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <TipBox>
                      <div className="text-[11px] text-ink-dim">
                        {fmtDate(String(label))}
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {payload
                          .slice()
                          .sort((a, b) => Number(b.value) - Number(a.value))
                          .map((p) => (
                            <div
                              key={String(p.dataKey)}
                              className="flex items-center gap-2 text-[11px]"
                            >
                              <i
                                aria-hidden
                                className="h-2 w-2 rounded-sm"
                                style={{ background: p.color }}
                              />
                              <span className="text-ink-muted">
                                {labels[String(p.dataKey)]}
                              </span>
                              <span className="tnum ml-auto text-ink">
                                {Number(p.value).toFixed(2)}x
                              </span>
                            </div>
                          ))}
                      </div>
                    </TipBox>
                  );
                }}
              />
              {keys.map((k) => (
                <Line
                  key={k}
                  type="monotone"
                  dataKey={k}
                  name={labels[k]}
                  stroke={SERIES[k]}
                  strokeWidth={k === "min_cvar" ? 2.2 : 1.5}
                  strokeDasharray={k.startsWith("BH_") ? "3 3" : undefined}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </>
      </Figure>

      <Figure
        title="Drawdown from the running peak"
        height={280}
        caption={
          <>
            Maximum Sharpe&apos;s deepest drawdown, in 2022, is 34.36%, close to
            the Nifty ETF&apos;s 36.34%. Minimum CVaR&apos;s does not exceed
            12.19%.
          </>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={dd} margin={{ top: 6, right: 14, bottom: 20, left: 2 }}>
            <CartesianGrid stroke={GRID} />
            <XAxis
              dataKey="date"
              ticks={ticks}
              tickFormatter={(d: string) => d.slice(0, 4)}
              {...axisProps}
            />
            <YAxis
              {...axisProps}
              width={44}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            />
            <ReferenceLine y={0} stroke={REF} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: REF }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <TipBox>
                    <div className="text-[11px] text-ink-dim">
                      {fmtDate(String(label))}
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {payload
                        .slice()
                        .sort((a, b) => Number(a.value) - Number(b.value))
                        .map((p) => (
                          <div
                            key={String(p.dataKey)}
                            className="flex items-center gap-2 text-[11px]"
                          >
                            <i
                              aria-hidden
                              className="h-2 w-2 rounded-sm"
                              style={{ background: p.color }}
                            />
                            <span className="text-ink-muted">
                              {labels[String(p.dataKey)]}
                            </span>
                            <span className="tnum ml-auto text-ink">
                              {Number(p.value).toFixed(2)}%
                            </span>
                          </div>
                        ))}
                    </div>
                  </TipBox>
                );
              }}
            />
            {keys.map((k) => (
              <Area
                key={k}
                type="monotone"
                dataKey={k}
                stroke={SERIES[k]}
                strokeWidth={k === "min_cvar" ? 2 : 1.2}
                fill={SERIES[k]}
                fillOpacity={k === "max_sharpe" ? 0.1 : 0.02}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </Figure>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Sharpe: in sample against out of sample                          */
/* ------------------------------------------------------------------ */
export function SharpeShift({
  data,
}: {
  data: { key: string; label: string; ins: number; oos: number }[];
}) {
  return (
    <Figure
      title="Sharpe in sample against out of sample"
      height={254}
      /* Recharts 3 dropped Legend's `payload`, and the two bars here are not
         named series anyway - they are the same measure at two points in time -
         so the key is written out directly. */
      lead={
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-ink-muted">
          <span className="flex items-center gap-1.5">
            <i
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ background: "#3d4a63" }}
            />
            in sample
          </span>
          <span className="flex items-center gap-1.5">
            <i
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ background: FG }}
            />
            out of sample, net of costs
          </span>
        </div>
      }
      caption={
        <>
          The upper bar in each pair is the in-sample Sharpe ratio and the lower
          bar the out-of-sample ratio, net of costs. Four rules improve out of
          sample. Maximum Sharpe, the only rule that estimates expected returns,
          is the only one that falls.
        </>
      }
    >
      <>
        <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 6, right: 60, bottom: 22, left: 4 }}
          barCategoryGap={14}
        >
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 1.6]}
            {...axisProps}
            label={{
              value: "Sharpe ratio",
              position: "insideBottom",
              offset: -14,
              fill: AXIS,
              fontSize: 11,
            }}
          />
          <YAxis
            type="category"
            dataKey="label"
            {...axisProps}
            width={92}
            tick={{ fill: AXIS, fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: "rgba(15,23,42,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof data)[number];
              const shift = d.oos - d.ins;
              return (
                <TipBox>
                  <div className="text-[12px] font-semibold text-ink">{d.label}</div>
                  <div className="mt-1 space-y-0.5 text-[11px] text-ink-muted">
                    <div>
                      in sample <span className="tnum text-ink">{d.ins.toFixed(3)}</span>
                    </div>
                    <div>
                      out of sample{" "}
                      <span className="tnum text-ink">{d.oos.toFixed(3)}</span>
                    </div>
                    <div className={shift >= 0 ? "text-accent" : "text-[#b45309]"}>
                      shift {shift >= 0 ? "+" : ""}
                      {shift.toFixed(3)}
                    </div>
                  </div>
                </TipBox>
              );
            }}
          />
          {/* Two bars per strategy rather than a dumbbell: Recharts has no
              dumbbell mark, and a paired bar still reads as "these two numbers
              belong together" while keeping the hover target large. */}
          <Bar dataKey="ins" fill="#3d4a63" isAnimationActive={false} barSize={10}>
            <LabelList
              dataKey="ins"
              position="right"
              fill={AXIS}
              fontSize={10}
              formatter={(v: React.ReactNode) => Number(v).toFixed(3)}
            />
          </Bar>
          <Bar dataKey="oos" isAnimationActive={false} barSize={10}>
            {data.map((d) => (
              <Cell key={d.key} fill={SERIES[d.key]} />
            ))}
            <LabelList
              dataKey="oos"
              position="right"
              fill={FG}
              fontSize={10}
              fontWeight={600}
              formatter={(v: React.ReactNode) => Number(v).toFixed(3)}
            />
          </Bar>
        </BarChart>
        </ResponsiveContainer>
      </>
    </Figure>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Per-asset tails: VaR against CVaR, and realised against normal   */
/* ------------------------------------------------------------------ */

export interface TailRow {
  asset: string;
  label: string;
  varr: number;
  cvar: number;
  ratio: number;
  vsNormal: number;
  colour: string;
}

/**
 * Two panels, neither of which Bitcoin is allowed to distort.
 *
 * Bitcoin's CVaR is 9.84% against 1.07% for US aggregate bonds. On a linear
 * axis it takes two thirds of the width and squashes the eleven assets a reader
 * needs to compare into the rest, so the left panel is drawn on a log scale.
 * That is the right scale for a quantity spanning a factor of nine and has a
 * useful side effect: on a log axis the VaR-to-CVaR segment length is the
 * CVaR/VaR ratio, so equal fat-tailedness draws as equal length.
 */
export function TailProfile({ data }: { data: TailRow[] }) {
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div className="my-6 grid gap-4 lg:grid-cols-2">
      <Figure
        title="VaR 95% and CVaR 95% by asset"
        height={360}
        caption={
          <>
            The hollow marker is VaR 95% and the filled marker CVaR 95%, the
            expected loss beyond it, sorted by CVaR. On the logarithmic axis each
            segment&apos;s length is proportional to the logarithm of the
            CVaR/VaR ratio, so Indian gold (1.71) is longer than US long-term
            Treasuries (1.38).
          </>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 46, bottom: 22, left: 4 }}
          >
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis
              type="number"
              scale="log"
              domain={[0.55, 14]}
              ticks={[0.75, 1, 1.5, 2, 3, 5, 8, 12]}
              {...axisProps}
              tickFormatter={(v: number) => `${v}%`}
              label={{
                value: "Daily loss, log scale",
                position: "insideBottom",
                offset: -14,
                fill: AXIS,
                fontSize: 11,
              }}
            />
            <YAxis
              type="category"
              dataKey="label"
              {...axisProps}
              width={88}
              tick={{ fill: AXIS, fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: "rgba(15,23,42,0.04)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as TailRow;
                return (
                  <TipBox>
                    <div className="text-[12px] font-semibold text-ink">
                      {d.label}
                    </div>
                    <div className="mt-1 space-y-0.5 text-[11px] text-ink-muted">
                      <div>
                        VaR 95{" "}
                        <span className="tnum text-ink">{d.varr.toFixed(3)}%</span>
                      </div>
                      <div>
                        CVaR 95{" "}
                        <span className="tnum text-ink">{d.cvar.toFixed(3)}%</span>
                      </div>
                      <div>
                        ratio{" "}
                        <span className="tnum text-accent">
                          {d.ratio.toFixed(2)}x
                        </span>
                      </div>
                    </div>
                  </TipBox>
                );
              }}
            />
            {/* The connecting segment, drawn as a floating bar from VaR to CVaR. */}
            <Bar
              dataKey={(d: TailRow) => [d.varr, d.cvar]}
              barSize={7}
              isAnimationActive={false}
              onMouseEnter={(d: unknown) => setHover((d as TailRow).asset)}
              onMouseLeave={() => setHover(null)}
            >
              {data.map((d) => (
                <Cell
                  key={d.asset}
                  fill={d.colour}
                  fillOpacity={hover && hover !== d.asset ? 0.45 : 1}
                />
              ))}
              <LabelList
                dataKey="ratio"
                position="right"
                offset={10}
                fill={AXIS}
                fontSize={10}
                formatter={(v: React.ReactNode) => `${Number(v).toFixed(2)}x`}
              />
            </Bar>
            <Scatter dataKey="varr" shape={<HollowDot />} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.asset} fill={d.colour} />
              ))}
            </Scatter>
            <Scatter dataKey="cvar" shape={<SolidDot />} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.asset} fill={d.colour} />
              ))}
            </Scatter>
          </ComposedChart>
        </ResponsiveContainer>
      </Figure>

      <Figure
        title="Realised CVaR relative to a normal distribution"
        height={360}
        caption={
          <>
            Realised CVaR divided by the CVaR of a normal distribution with the
            same mean and variance. All twelve ratios exceed 1, so a normal
            distribution understates the loss tail of every asset; the largest
            ratio is 1.18, for the Nifty ETF.
          </>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 44, bottom: 22, left: 4 }}
          >
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis
              type="number"
              domain={[1, "dataMax + 0.02"]}
              {...axisProps}
              tickFormatter={(v: number) => `${v.toFixed(2)}x`}
              label={{
                value: "Realised CVaR / normal-distribution CVaR",
                position: "insideBottom",
                offset: -14,
                fill: AXIS,
                fontSize: 11,
              }}
            />
            <YAxis
              type="category"
              dataKey="label"
              {...axisProps}
              width={88}
              tick={{ fill: AXIS, fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: "rgba(15,23,42,0.04)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as TailRow;
                return (
                  <TipBox>
                    <div className="text-[12px] font-semibold text-ink">
                      {d.label}
                    </div>
                    <div className="tnum mt-1 text-[11px] text-ink-muted">
                      realised tail is{" "}
                      <span className="text-accent">
                        {d.vsNormal.toFixed(2)}x
                      </span>{" "}
                      the normal prediction
                    </div>
                  </TipBox>
                );
              }}
            />
            <ReferenceLine x={1} stroke={AXIS} strokeWidth={1.4} />
            <Bar dataKey="vsNormal" barSize={13} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.asset} fill={d.colour} />
              ))}
              <LabelList
                dataKey="vsNormal"
                position="right"
                fill={AXIS}
                fontSize={10}
                formatter={(v: React.ReactNode) => `${Number(v).toFixed(2)}x`}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Figure>
    </div>
  );
}

function HollowDot(props: { cx?: number; cy?: number; fill?: string }) {
  const { cx, cy, fill } = props;
  if (cx == null || cy == null) return null;
  return (
    <circle cx={cx} cy={cy} r={4.5} fill={SURFACE} stroke={fill} strokeWidth={2} />
  );
}

function SolidDot(props: { cx?: number; cy?: number; fill?: string }) {
  const { cx, cy, fill } = props;
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={5} fill={fill} />;
}

/* ------------------------------------------------------------------ */
/* 6. Crisis replay                                                    */
/* ------------------------------------------------------------------ */

export interface CrisisRow {
  key: string;
  label: string;
  gfc: number;
  gfcBeta3: number;
  covid: number;
  oosDD: number;
}

const CRISIS_METRICS = [
  { key: "gfc", label: "2008 GFC, Lehman to bottom" },
  { key: "gfcBeta3", label: "2008 GFC, Bitcoin at 3x S&P" },
  { key: "covid", label: "COVID crash, 2020" },
  { key: "oosDD", label: "Walk-forward max drawdown" },
] as const;

/**
 * The crisis replay, one measure at a time.
 *
 * A small-multiples row would need four x scales on one line and would not fit
 * a content column, so the measure is a control instead. The first two options
 * are the same measure under two Bitcoin assumptions and deliberately share a
 * domain, so switching between them shows the assumption's effect as a change
 * in bar length rather than a redrawn axis.
 */
export function CrisisReplay({ data }: { data: CrisisRow[] }) {
  const [metric, setMetric] =
    useState<(typeof CRISIS_METRICS)[number]["key"]>("gfc");

  const sorted = [...data].sort(
    (a, b) => (a[metric] as number) - (b[metric] as number),
  );
  // The two GFC measures share a domain so the toggle is a like-for-like read.
  const gfcAll = data.flatMap((d) => [d.gfc, d.gfcBeta3]);
  const vals = sorted.map((d) => d[metric] as number);
  const [lo, hi] =
    metric === "gfc" || metric === "gfcBeta3"
      ? [Math.min(...gfcAll, 0), Math.max(...gfcAll, 0)]
      : [Math.min(...vals, 0), Math.max(...vals, 0)];
  const pad = (hi - lo) * 0.22 || 1;
  // Round the axis to a tick step so it reads -30%, -20%, ... rather than
  // stopping on values like -32% and 12%.
  const span = hi - lo + 2 * pad;
  const step = span > 60 ? 20 : span > 24 ? 10 : 5;
  const x0 = Math.floor((lo - pad) / step) * step;
  const x1 = Math.ceil((hi + pad) / step) * step;
  const crisisTicks: number[] = [];
  for (let v = x0; v <= x1; v += step) crisisTicks.push(v);

  return (
    <Figure
      title="Crisis replay: full-sample weights applied to historical episodes"
      height={286}
      lead={
        <div
          role="group"
          aria-label="Choose a crisis measure"
          className="mb-4 flex flex-wrap gap-1.5"
        >
          {CRISIS_METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              aria-pressed={metric === m.key}
              className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium transition-colors duration-200 ${
                metric === m.key
                  ? "border-accent-line bg-accent-soft text-accent-strong"
                  : "border-line bg-paper text-ink-muted hover:border-line-strong hover:text-ink"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      }
      caption={
        <>
          Bitcoin did not exist in 2008 and no proxy is defensible, so two bounds
          are shown: Bitcoin removed with the other weights renormalised, and
          Bitcoin returning three times the S&amp;P 500. Minimum CVaR and minimum
          variance hold no Bitcoin and are identical under both. The first two
          measures share an axis, so any difference between them is due to the
          assumption.
        </>
      }
    >
      <>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sorted}
            layout="vertical"
            margin={{ top: 4, right: 52, bottom: 20, left: 4 }}
          >
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis
              type="number"
              domain={[x0, x1]}
              ticks={crisisTicks}
              {...axisProps}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            />
            <YAxis
              type="category"
              dataKey="label"
              {...axisProps}
              width={92}
              tick={{ fill: AXIS, fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: "rgba(15,23,42,0.04)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as CrisisRow;
                const v = d[metric] as number;
                return (
                  <TipBox>
                    <div className="text-[12px] font-semibold text-ink">
                      {d.label}
                    </div>
                    <div
                      className={`tnum mt-1 text-[12px] ${
                        v >= 0 ? "text-accent" : "text-[#b45309]"
                      }`}
                    >
                      {v >= 0 ? "+" : ""}
                      {v.toFixed(2)}%
                    </div>
                  </TipBox>
                );
              }}
            />
            <ReferenceLine x={0} stroke={AXIS} strokeWidth={1.3} />
            <Bar dataKey={metric} barSize={22} isAnimationActive={false}>
              {sorted.map((d) => (
                <Cell key={d.key} fill={SERIES[d.key]} />
              ))}
              <LabelList
                dataKey={metric}
                position="right"
                fill={AXIS}
                fontSize={10.5}
                formatter={(v: React.ReactNode) =>
                  `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(1)}%`
                }
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </>
    </Figure>
  );
}
