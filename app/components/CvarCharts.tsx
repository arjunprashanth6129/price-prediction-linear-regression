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

  const pick = (d: FrontierDot | StrategyDot, title: string) =>
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
  const zoom: [number, number] = [
    Math.min(...strategies.map((d) => d.cvar)) - 0.08,
    Math.max(...strategies.map((d) => d.cvar)) + 0.3,
  ];
  const zoomY: [number, number] = [
    Math.min(...strategies.map((d) => d.ret)) - 2,
    Math.max(...strategies.map((d) => d.ret)) + 3,
  ];

  const chart = (
    xDomain: [number, number] | undefined,
    yDomain: [number, number] | undefined,
    tickFmt: (v: number) => string,
  ) => (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart
        data={curve}
        margin={{ top: 8, right: 14, bottom: 24, left: 2 }}
      >
        <CartesianGrid stroke={GRID} />
        <XAxis
          type="number"
          dataKey="cvar"
          domain={xDomain ?? [0.6, "dataMax + 0.4"]}
          allowDataOverflow={xDomain != null}
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
          domain={yDomain ?? [0, "dataMax + 4"]}
          allowDataOverflow={yDomain != null}
          {...axisProps}
          width={42}
          tickFormatter={(v: number) => `${v.toFixed(0)}%`}
        />
        <ZAxis range={[46, 46]} />
        {/* The frontier itself. Without it the 25 points read as a cloud
            rather than as a boundary nothing can sit below. */}
        <Line
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
        <Tooltip
          cursor={{ strokeDasharray: "3 3", stroke: REF }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[payload.length - 1].payload as FrontierDot & {
              label?: string;
            };
            return (
              <TipBox>
                <div className="text-[12px] font-semibold text-ink">
                  {d.label ?? `Frontier point ${d.index + 1}`}
                </div>
                <div className="mt-1 space-y-0.5 text-[11px] text-ink-muted">
                  <div>
                    return <span className="tnum text-ink">{d.ret.toFixed(2)}%</span>
                  </div>
                  <div>
                    CVaR 95{" "}
                    <span className="tnum text-ink">{d.cvar.toFixed(3)}%</span>
                  </div>
                  <div>
                    max drawdown{" "}
                    <span className="tnum text-ink">{d.dd.toFixed(2)}%</span>
                  </div>
                </div>
              </TipBox>
            );
          }}
        />
        <Scatter
          data={curve}
          className="cursor-pointer"
          shape={<Ring />}
          onClick={(p: unknown) => {
            const d = p as FrontierDot;
            pick(d, `Frontier point ${d.index + 1}`);
          }}
        />
        <Scatter
          data={strategies}
          shape={<Diamond />}
          className="cursor-pointer"
          onClick={(p: unknown) => {
            const d = p as StrategyDot;
            pick(d, d.label);
          }}
        >
          {strategies.map((d) => (
            <Cell key={d.key} fill={SERIES[d.key]} />
          ))}
        </Scatter>
      </ComposedChart>
    </ResponsiveContainer>
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
              The {curve.length} rings are the frontier portfolios, each one a
              separate optimisation. Nothing exists below the curve; anything above
              it is a mistake made voluntarily. All five named strategies sit in the
              bottom-left corner, magnified on the right.
            </>
          }
        >
          {chart(undefined, undefined, (v) => `${v.toFixed(0)}%`)}
        </Figure>

        <Figure
          title={`The five strategies, magnified (CVaR ${zoom[0].toFixed(1)}% to ${zoom[1].toFixed(1)}%)`}
          height={300}
          caption={
            <>
              Min variance and min CVaR land 0.006 points apart on CVaR, so their
              diamonds nearly coincide - min variance is drawn larger to stay
              visible behind min CVaR. Click any mark in either panel to load its
              exact weights below.
            </>
          }
        >
          {chart(zoom, zoomY, (v) => `${v.toFixed(1)}%`)}
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
              width={112}
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
            Weights are re-optimised every quarter on the trailing 500 days only,
            then held; between rebalances they drift with the market. The dotted
            line is the Nifty bought and held, for contrast. Min CVaR is the
            lowest line here and the flattest below, which is the trade the
            strategy exists to make.
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
            Max Sharpe&apos;s 2022 trough reaches 34.36%, deeper than the Nifty it
            was meant to improve on. Min CVaR never exceeds 12.19%.
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
          The upper bar in each pair is the fitted score, the lower coloured one is
          what the strategy actually earned on data it had never seen. Four
          strategies improve. Max Sharpe is the only one that falls, and the only
          one of the five that needs expected returns as an input.
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
        title="VaR stops where CVaR starts looking"
        height={360}
        caption={
          <>
            The hollow mark is VaR 95%, the threshold. The filled mark is CVaR
            95%, the average loss beyond it. Sorted by CVaR, mildest tail first.
            The axis is logarithmic, so the length of each segment is that
            asset&apos;s CVaR/VaR ratio: gold in rupees at 1.71x draws visibly
            longer than US long treasuries at 1.38x.
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
        title="A bell curve understates every tail here"
        height={360}
        caption={
          <>
            Realised CVaR divided by the CVaR a normal distribution predicts.
            Every one of the twelve sits to the right of 1.00, so the bell curve
            under-predicts the tail in every single case, by 1.18x for the Nifty
            and 1.16x for Bitcoin. This is what variance cannot see, and it is
            the argument for optimising CVaR instead.
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

  return (
    <Figure
      title="Crisis replay, real episodes through the fitted portfolios"
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
          Bitcoin did not exist in 2008 and no proxy for it is defensible, so two
          bounds are reported: dropped and renormalised, or assumed to move at
          three times the S&amp;P. Min CVaR and min variance hold no Bitcoin, so
          switching between the first two measures does not move them at all.
          Those two share an axis, so the difference you see is the assumption.
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
              domain={[lo - pad, hi + pad]}
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
