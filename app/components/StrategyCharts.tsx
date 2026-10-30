"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  LabelList,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS, Frame, GRID, NEG, POS, REF, TipBox, axisProps } from "./Charts";

const INK = "#0f172a";
const SLATE = "#94a3b8";
const MUTED = "#cbd5e1";
const SHADE = "#f1f5f9";

const fmtPct = (x: number, d = 1, signed = false) =>
  `${signed && x > 0 ? "+" : ""}${(x * 100).toFixed(d).replace("-", "−")}%`;

/** January of every other year, so the time axis carries eight or nine labels. */
const yearTicks = (months: string[]) =>
  months.filter((m) => m.endsWith("-01") && Number(m.slice(0, 4)) % 2 === 0);

const monthLabel = (m: string) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

type Series = { key: string; label: string; color: string; width: number; dash?: string };

/** A legend of line swatches, drawn in the series' own stroke and dash. */
function LineLegend({ series }: { series: readonly Series[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-ink-muted">
      {series.map((s) => (
        <li key={s.key} className="inline-flex items-center gap-1.5">
          <svg width="18" height="6" aria-hidden>
            <line x1="0" y1="3" x2="18" y2="3" stroke={s.color} strokeWidth={s.width} strokeDasharray={s.dash} />
          </svg>
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/** The value at the right-hand end of a line, written beside it in ink. */
function EndLabel({
  x,
  y,
  index,
  value,
  last,
  dy = 0,
}: {
  x?: number | string;
  y?: number | string;
  index?: number;
  value?: unknown;
  last: number;
  dy?: number;
}) {
  if (index !== last || x === undefined || y === undefined) return null;
  return (
    <text x={Number(x) + 6} y={Number(y) + 4 + dy} fill={INK} fontSize={11} fontWeight={600} className="tnum">
      {Number(value).toFixed(1)}x
    </text>
  );
}

/* ------------------------------------------------------------------ */
/* Growth of one rupee, with the universe as a toggle                  */
/* ------------------------------------------------------------------ */

type Mode = "pit" | "survivor";

export function GrowthChart({
  months,
  pit,
  survivor,
  holdoutStart,
}: {
  months: string[];
  pit: { strategy: number[]; ew: number[]; nifty500: number[]; mom50: number[] };
  survivor: { strategy: number[]; ew: number[] };
  holdoutStart: string;
}) {
  const [mode, setMode] = useState<Mode>("pit");
  const src = mode === "pit" ? pit : survivor;
  const data = months.map((m, i) => ({
    m,
    s: src.strategy[i],
    e: src.ew[i],
    n: pit.nifty500[i],
    k: pit.mom50[i],
  }));
  const lastIdx = data.length - 1;
  const last = data[lastIdx];
  const top = mode === "pit" ? 60 : 150;
  const ticks = [1, 2, 5, 10, 20, 50, 100].filter((t) => t <= top);

  // The survivors-only run has no index of its own, so its chart shows the
  // strategy and its benchmark alone.
  const series: Series[] = [
    { key: "s", label: "Strategy", color: POS, width: 2.5 },
    { key: "e", label: "Equal-weight benchmark", color: INK, width: 1.5 },
    ...(mode === "pit"
      ? [
          { key: "k", label: "Nifty500 Momentum 50", color: NEG, width: 1.5, dash: "2 3" },
          { key: "n", label: "Nifty 500", color: SLATE, width: 1.5, dash: "6 4" },
        ]
      : []),
  ];
  // End labels that would sit on top of each other are nudged apart.
  const nudge: Record<string, number> = mode === "pit" ? { k: -5, n: 7 } : {};

  return (
    <Frame
      title="Growth of ₹1 invested in March 2009, net of costs (log scale)"
      height={400}
      caption={
        mode === "pit" ? (
          <>
            Every NSE stock that was trading at the time, including those that later
            failed. ₹1 in the strategy grew to{" "}
            <strong className="font-semibold text-ink">₹{last.s.toFixed(1)}</strong>,
            against ₹{last.e.toFixed(1)}{" "}in the equal-weight benchmark and ₹
            {last.n.toFixed(1)}{" "}in the Nifty 500. The two indices are total return series
            and pay no trading costs. The shaded years are the holdout.
          </>
        ) : (
          <>
            The same strategy run on today&apos;s Nifty 500, where every stock is a
            survivor. ₹1 appears to grow to{" "}
            <strong className="font-semibold text-ink">₹{last.s.toFixed(0)}</strong>, and
            the benchmark to ₹{last.e.toFixed(0)}. Both figures are inflated by
            survivorship bias, which the next section explains.
          </>
        )
      }
    >
      <div className="flex h-full flex-col">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Universe"
            className="inline-flex rounded-lg border border-line bg-paper p-0.5 text-[12.5px]"
          >
            {(
              [
                ["pit", "Every stock trading then"],
                ["survivor", "Today's survivors only"],
              ] as const
            ).map(([k, lab]) => (
              <button
                key={k}
                type="button"
                aria-pressed={mode === k}
                onClick={() => setMode(k)}
                className={`min-h-9 cursor-pointer rounded-md px-3 font-medium transition-colors duration-200 ${
                  mode === k ? "bg-accent text-paper" : "text-ink-muted hover:text-ink"
                }`}
              >
                {lab}
              </button>
            ))}
          </div>
          <LineLegend series={series} />
        </div>
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 44, bottom: 0, left: 0 }}>
              <ReferenceArea
                x1={holdoutStart}
                x2={months[lastIdx]}
                fill={SHADE}
                fillOpacity={1}
                label={{ value: "Holdout", position: "insideTopLeft", fill: AXIS, fontSize: 11 }}
              />
              <XAxis dataKey="m" {...axisProps} ticks={yearTicks(months)} tickFormatter={(m: string) => m.slice(0, 4)} />
              <YAxis
                {...axisProps}
                scale="log"
                domain={[1, top]}
                allowDataOverflow
                ticks={ticks}
                tickFormatter={(v: number) => `${v}x`}
                width={40}
              />
              <Tooltip
                cursor={{ stroke: REF }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as (typeof data)[number];
                  return (
                    <TipBox>
                      <div className="text-[11px] text-ink-dim">{monthLabel(String(label))}</div>
                      {series.map((s) => (
                        <div key={s.key} className="tnum mt-0.5 flex items-center justify-between gap-4 text-[12px]">
                          <span className="inline-flex items-center gap-1.5 text-ink-muted">
                            <span className="h-0.5 w-3 rounded" style={{ background: s.color }} />
                            {s.label}
                          </span>
                          <span className="font-semibold text-ink">
                            ₹{(d[s.key as "s" | "e" | "n" | "k"] as number).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </TipBox>
                  );
                }}
              />
              {series.map((s) => (
                <Line
                  key={s.key}
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={s.width}
                  strokeDasharray={s.dash}
                  dot={false}
                  activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }}
                  isAnimationActive={false}
                >
                  <LabelList dataKey={s.key} content={(p) => <EndLabel {...p} last={lastIdx} dy={nudge[s.key] ?? 0} />} />
                </Line>
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Drawdowns                                                           */
/* ------------------------------------------------------------------ */

export function DrawdownChart({
  months,
  strategy,
  ew,
  holdoutStart,
  worst,
}: {
  months: string[];
  strategy: number[];
  ew: number[];
  holdoutStart: string;
  worst: { strategy: number; ew: number };
}) {
  const data = months.map((m, i) => ({ m, s: strategy[i] * 100, e: ew[i] * 100 }));
  const at = (m: string) => data.find((d) => d.m === m) ?? data[0];
  const [y11, y20] = [at("2011-12"), at("2020-03")];
  const series: Series[] = [
    { key: "s", label: "Strategy", color: POS, width: 2 },
    { key: "e", label: "Equal-weight benchmark", color: INK, width: 1.5 },
  ];
  return (
    <Frame
      title="Fall from the previous peak, month-end values (%)"
      height={230}
      caption={
        <>
          In the deepest sell-offs the strategy fell much less than the benchmark:{" "}
          {Math.abs(y11.s).toFixed(0)}% against {Math.abs(y11.e).toFixed(0)}% by December
          2011, and {Math.abs(y20.s).toFixed(0)}% against {Math.abs(y20.e).toFixed(0)}% by
          March 2020. In milder ones, such as early 2016 and early 2025, it fell a little
          further. Measured on daily prices, the worst falls were{" "}
          {fmtPct(worst.strategy, 0)}{" "}and {fmtPct(worst.ew, 0)}.
        </>
      }
    >
      <div className="flex h-full flex-col">
        <div className="mb-2">
          <LineLegend series={series} />
        </div>
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 44, bottom: 0, left: 0 }}>
              <ReferenceArea x1={holdoutStart} x2={months[months.length - 1]} fill={SHADE} fillOpacity={1} />
              <XAxis dataKey="m" {...axisProps} ticks={yearTicks(months)} tickFormatter={(m: string) => m.slice(0, 4)} />
              <YAxis {...axisProps} domain={[-60, 0]} ticks={[-60, -40, -20, 0]} width={40} tickFormatter={(v: number) => `${v}%`} />
              <ReferenceLine y={0} stroke={REF} />
              <Tooltip
                cursor={{ stroke: REF }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as (typeof data)[number];
                  return (
                    <TipBox>
                      <div className="text-[11px] text-ink-dim">{monthLabel(String(label))}</div>
                      <div className="tnum mt-0.5 flex justify-between gap-4 text-[12px]">
                        <span className="text-ink-muted">Strategy</span>
                        <span className="font-semibold text-ink">{d.s.toFixed(1)}%</span>
                      </div>
                      <div className="tnum flex justify-between gap-4 text-[12px]">
                        <span className="text-ink-muted">Benchmark</span>
                        <span className="font-semibold text-ink">{d.e.toFixed(1)}%</span>
                      </div>
                    </TipBox>
                  );
                }}
              />
              <Area dataKey="e" stroke={INK} strokeWidth={1.5} fill={INK} fillOpacity={0.06} isAnimationActive={false} />
              <Area dataKey="s" stroke={POS} strokeWidth={2} fill={POS} fillOpacity={0.14} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Survivorship in the benchmark                                       */
/* ------------------------------------------------------------------ */

export function SurvivorshipGrowth({
  months,
  survivorEw,
  pitEw,
  indexEw,
}: {
  months: string[];
  survivorEw: number[];
  pitEw: number[];
  indexEw: number[];
}) {
  const data = months.map((m, i) => ({ m, a: survivorEw[i], b: indexEw[i], c: pitEw[i] }));
  const lastIdx = data.length - 1;
  const last = data[lastIdx];
  const series: Series[] = [
    { key: "a", label: "Equal weight, today's Nifty 500", color: NEG, width: 2.2 },
    { key: "b", label: "Nifty500 Equal Weight index (NSE)", color: SLATE, width: 1.6, dash: "6 4" },
    { key: "c", label: "Equal weight, every stock trading then", color: INK, width: 1.6 },
  ];
  return (
    <Frame
      title="The same portfolio with no signal, on two universes: growth of ₹1 (log scale)"
      height={330}
      caption={
        <>
          An equal-weighted portfolio of today&apos;s Nifty 500 turned ₹1 into ₹
          {last.a.toFixed(0)}. NSE&apos;s own equal-weight index, built from the stocks
          that were actually in the Nifty 500 on each date, turned it into ₹
          {last.b.toFixed(0)}. The equal-weighted portfolio of the rebuilt universe moves
          closely with the index and ends below it, at ₹{last.c.toFixed(0)}, partly
          because it pays trading costs and the index does not.
        </>
      }
    >
      <div className="flex h-full flex-col">
        <div className="mb-2">
          <LineLegend series={series} />
        </div>
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 44, bottom: 0, left: 0 }}>
              <XAxis dataKey="m" {...axisProps} ticks={yearTicks(months)} tickFormatter={(m: string) => m.slice(0, 4)} />
              <YAxis
                {...axisProps}
                scale="log"
                domain={[1, 60]}
                allowDataOverflow
                ticks={[1, 2, 5, 10, 20, 50]}
                tickFormatter={(v: number) => `${v}x`}
                width={40}
              />
              <Tooltip
                cursor={{ stroke: REF }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as (typeof data)[number];
                  return (
                    <TipBox>
                      <div className="text-[11px] text-ink-dim">{monthLabel(String(label))}</div>
                      {series.map((s) => (
                        <div key={s.key} className="tnum mt-0.5 flex items-center justify-between gap-4 text-[12px]">
                          <span className="inline-flex items-center gap-1.5 text-ink-muted">
                            <span className="h-0.5 w-3 rounded" style={{ background: s.color }} />
                            {s.label}
                          </span>
                          <span className="font-semibold text-ink">₹{(d[s.key as "a" | "b" | "c"] as number).toFixed(2)}</span>
                        </div>
                      ))}
                    </TipBox>
                  );
                }}
              />
              {series.map((s) => (
                <Line
                  key={s.key}
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={s.width}
                  strokeDasharray={s.dash}
                  dot={false}
                  activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }}
                  isAnimationActive={false}
                >
                  <LabelList dataKey={s.key} content={(p) => <EndLabel {...p} last={lastIdx} dy={s.key === "b" ? -4 : s.key === "c" ? 6 : 0} />} />
                </Line>
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Signal selection                                                    */
/* ------------------------------------------------------------------ */

export function SignalBars({
  signals,
}: {
  signals: { key: string; label: string; t: number; selected: boolean; tNse: number }[];
}) {
  return (
    <Frame
      title="How well each candidate signal ranked next month's returns, 2006 to 2018"
      height={340}
      caption={
        <>
          Each bar is the t-statistic, adjusted for autocorrelation, of the signal&apos;s
          average monthly rank correlation with the next month&apos;s return. The rule, fixed in advance, kept
          any signal beyond ±2 (the dashed lines), so four were chosen. The 200-day trend
          enters with its sign reversed: a price above its 200-day average scores well.
        </>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={signals} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 4 }} barCategoryGap={7}>
          <XAxis type="number" {...axisProps} domain={[-3, 3]} ticks={[-3, -2, -1, 0, 1, 2, 3]} />
          <YAxis type="category" dataKey="label" {...axisProps} stroke="transparent" width={168} interval={0} />
          <ReferenceLine x={0} stroke={REF} />
          <ReferenceLine x={2} stroke={AXIS} strokeDasharray="4 4" />
          <ReferenceLine x={-2} stroke={AXIS} strokeDasharray="4 4" />
          <Tooltip
            cursor={{ fill: "rgba(15,23,42,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof signals)[number];
              return (
                <TipBox>
                  <div className="text-[12px] font-semibold text-ink">{d.label}</div>
                  <div className="tnum mt-0.5 text-[12px] text-ink-muted">
                    t = {d.t.toFixed(2)}, {d.selected ? "selected" : "not selected"}
                  </div>
                </TipBox>
              );
            }}
          />
          <Bar dataKey="t" radius={4} barSize={16} isAnimationActive={false}>
            {signals.map((d) => (
              <Cell key={d.key} fill={d.selected ? (d.t > 0 ? POS : NEG) : MUTED} />
            ))}
            <LabelList
              dataKey="t"
              content={({ x, y, width, height, value }) => {
                const v = Number(value);
                const right = Number(x) + Math.max(Number(width), 0);
                const left = Number(x) + Math.min(Number(width), 0);
                return (
                  <text
                    x={v >= 0 ? right + 6 : left - 6}
                    y={Number(y) + Number(height) / 2 + 4}
                    textAnchor={v >= 0 ? "start" : "end"}
                    fill={AXIS}
                    fontSize={11}
                    className="tnum"
                  >
                    {(v > 0 ? "+" : "") + v.toFixed(2)}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Quintiles of the score                                              */
/* ------------------------------------------------------------------ */

export function QuintileBars({ quintiles }: { quintiles: number[] }) {
  const data = quintiles.map((q, i) => ({
    q: i === 0 ? "Q1 lowest" : i === 4 ? "Q5 held" : `Q${i + 1}`,
    v: q * 100,
    held: i === 4,
  }));
  return (
    <Frame
      title="Average next-month return by fifth of the score, before costs, 2009 to 2026"
      height={250}
      caption={
        <>
          Stocks are sorted into fifths by their score each month. Returns rise from each
          fifth to the next, from {data[0].v.toFixed(2)}% a month for the lowest-ranked
          stocks to {data[4].v.toFixed(2)}% for the highest, which are the ones the
          strategy buys. A signal that worked only by luck would not usually produce a
          staircase this even.
        </>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 22, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
          <XAxis dataKey="q" {...axisProps} interval={0} />
          <YAxis {...axisProps} domain={[0, 2.5]} ticks={[0, 0.5, 1, 1.5, 2, 2.5]} width={40} tickFormatter={(v: number) => `${v}%`} />
          <Tooltip
            cursor={{ fill: "rgba(15,23,42,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof data)[number];
              return (
                <TipBox>
                  <div className="text-[12px] font-semibold text-ink">{d.q}</div>
                  <div className="tnum mt-0.5 text-[12px] text-ink-muted">{d.v.toFixed(2)}% a month</div>
                </TipBox>
              );
            }}
          />
          <Bar dataKey="v" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.q} fill={d.held ? POS : "#93c5fd"} />
            ))}
            <LabelList dataKey="v" position="top" fill={INK} fontSize={11} formatter={(v: unknown) => `${Number(v).toFixed(2)}%`} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Random portfolios, drawn on a numeric axis                          */
/* ------------------------------------------------------------------ */

export function RandomHistogram({
  edges,
  counts,
  strategy,
  p95,
  n,
}: {
  edges: number[];
  counts: number[];
  strategy: number;
  p95: number;
  n: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  // Drawn in pixels at the measured width, so the labels keep their size on a
  // phone instead of shrinking with a scaled viewBox. A callback ref, because
  // Frame mounts its children only after hydration.
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [box]);
  const H = 230;
  const narrow = W < 480;
  const pad = { l: 36, r: 12, t: 34, b: 38 };
  const x0 = 0.3;
  const x1 = 1.0;
  const maxC = Math.ceil(Math.max(...counts) / 50) * 50;
  const sx = (v: number) => pad.l + ((v - x0) / (x1 - x0)) * (W - pad.l - pad.r);
  const sy = (c: number) => H - pad.b - (c / maxC) * (H - pad.t - pad.b);
  const xTicks = narrow ? [0.3, 0.5, 0.7, 0.9] : [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const yTicks = Array.from({ length: maxC / 50 + 1 }, (_, i) => i * 50).filter((t) => t % 100 === 0 || maxC <= 100);
  const best = edges[counts.length];

  return (
    <Frame
      title={`The strategy against ${n.toLocaleString("en-IN")} random portfolios: Sharpe ratio before costs, 2009 to 2026`}
      height={H}
      caption={
        <>
          Each random portfolio holds the same number of stocks as the strategy, picked at
          random each month from the same eligible stocks. The best of them reached a
          Sharpe ratio of about {best.toFixed(2)}{" "}and 95% stayed below {p95.toFixed(2)}.
          The strategy&apos;s {strategy.toFixed(2)}{" "}is well clear of the whole
          distribution.
        </>
      }
    >
      <div ref={setBox} className="relative h-full w-full overflow-hidden">
        <svg width={W} height={H} className="absolute left-0 top-0" role="img" aria-label="Histogram of random portfolio Sharpe ratios with the strategy marked">
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} stroke={GRID} />
              <text x={pad.l - 8} y={sy(t) + 4} textAnchor="end" fill={AXIS} fontSize={11}>
                {t}
              </text>
            </g>
          ))}
          {counts.map((c, i) => {
            const a = sx(edges[i]) + 1;
            const b = sx(edges[i + 1]) - 1;
            return (
              <rect
                key={i}
                x={a}
                y={sy(c)}
                width={Math.max(b - a, 1)}
                height={H - pad.b - sy(c)}
                rx={1.5}
                fill={hover === i ? "#64748b" : "#94a3b8"}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}
          <line x1={sx(p95)} x2={sx(p95)} y1={pad.t - 8} y2={H - pad.b} stroke={AXIS} strokeDasharray="4 4" />
          <text x={sx(p95) + 5} y={narrow ? pad.t + 6 : pad.t - 12} fill={AXIS} fontSize={11}>
            {narrow ? "95th pct" : "95th percentile"} {p95.toFixed(2)}
          </text>
          <line x1={sx(strategy)} x2={sx(strategy)} y1={pad.t - 8} y2={H - pad.b} stroke={POS} strokeWidth={2.5} />
          <text x={sx(strategy) - 6} y={pad.t - 12} textAnchor="end" fill={INK} fontSize={12} fontWeight={600}>
            Strategy {strategy.toFixed(2)}
          </text>
          <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke={REF} />
          {xTicks.map((t) => (
            <text key={t} x={sx(t)} y={H - pad.b + 16} textAnchor="middle" fill={AXIS} fontSize={11}>
              {t.toFixed(1)}
            </text>
          ))}
          <text x={(pad.l + W - pad.r) / 2} y={H - 4} textAnchor="middle" fill={AXIS} fontSize={11}>
            Sharpe ratio
          </text>
          {hover !== null && (
            <g pointerEvents="none">
              <rect x={sx(edges[hover + 1]) + 6} y={sy(counts[hover]) - 6} width={150} height={36} rx={6} fill="#fff" stroke={MUTED} />
              <text x={sx(edges[hover + 1]) + 14} y={sy(counts[hover]) + 9} fill={AXIS} fontSize={10.5}>
                Sharpe {edges[hover].toFixed(2)}{" "}to {edges[hover + 1].toFixed(2)}
              </text>
              <text x={sx(edges[hover + 1]) + 14} y={sy(counts[hover]) + 23} fill={INK} fontSize={11.5} fontWeight={600}>
                {counts[hover]}{" "}portfolios
              </text>
            </g>
          )}
        </svg>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Calendar years                                                      */
/* ------------------------------------------------------------------ */

export function YearBars({ rows }: { rows: { year: string; strategy: number; ew: number }[] }) {
  const FLOOR = -35;
  const data = rows.map((r) => ({
    ...r,
    label: `’${r.year.slice(2)}`,
    diff: (r.strategy - r.ew) * 100,
    shown: Math.max((r.strategy - r.ew) * 100, FLOOR),
  }));
  const behind = data.filter((d) => d.diff < 0);
  return (
    <Frame
      title="Strategy minus benchmark, by calendar year (percentage points)"
      height={260}
      caption={
        <>
          The strategy fell behind in {behind.length}{" "}of {data.length}{" "}years. The worst was
          2009, counted from March, when it trailed by {Math.abs(data[0].diff).toFixed(0)}{" "}
          points (the bar is cut off) because the stocks that had fallen furthest in 2008
          led the recovery. 2025 was the most recent such year. 2026 runs to June.
        </>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="18%">
          <XAxis dataKey="label" {...axisProps} interval={0} fontSize={10} />
          <YAxis {...axisProps} domain={[FLOOR, 30]} allowDataOverflow width={36} ticks={[-30, -15, 0, 15, 30]} />
          <ReferenceLine y={0} stroke={REF} />
          <Tooltip
            cursor={{ fill: "rgba(15,23,42,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof data)[number];
              return (
                <TipBox>
                  <div className="text-[12px] font-semibold text-ink">{d.year}</div>
                  <div className="tnum mt-0.5 text-[12px] text-ink-muted">
                    Strategy {fmtPct(d.strategy, 1, true)}, benchmark {fmtPct(d.ew, 1, true)}
                  </div>
                  <div className="tnum text-[12px] font-semibold text-ink">
                    {d.diff > 0 ? "+" : "−"}
                    {Math.abs(d.diff).toFixed(1)}{" "}points
                  </div>
                </TipBox>
              );
            }}
          />
          <Bar dataKey="shown" radius={[3, 3, 3, 3]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.year} fill={d.diff > 0 ? POS : NEG} />
            ))}
            <LabelList
              dataKey="shown"
              content={({ x, y, width, height, index }) => {
                const d = data[Number(index)];
                if (!d || d.diff >= FLOOR) return null;
                return (
                  <text
                    x={Number(x) + Number(width) / 2}
                    y={Math.max(Number(y), Number(y) + Number(height)) - 6}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={9.5}
                    fontWeight={600}
                  >
                    {d.diff.toFixed(0).replace("-", "−")}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Sensitivity to costs                                                */
/* ------------------------------------------------------------------ */

export function CostLine({ rows, breakEven }: { rows: { mult: number; active: number }[]; breakEven: number }) {
  const data = [...rows.map((r) => ({ x: r.mult, y: r.active * 100 })), { x: breakEven, y: 0 }].sort((a, b) => a.x - b.x);
  const actual = rows.find((r) => r.mult === 1)?.active ?? 0;
  return (
    <Frame
      title="Return over the benchmark at different levels of trading costs (% a year)"
      height={240}
      caption={
        <>
          At the real cost schedule (1x) the strategy beats its benchmark by{" "}
          {fmtPct(actual, 1)}{" "}a year. The lead shrinks by about two points for every extra
          multiple of costs and disappears at {breakEven.toFixed(1)}x. The benchmark is
          charged the same costs throughout.
        </>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 20, bottom: 18, left: 0 }}>
          <XAxis
            type="number"
            dataKey="x"
            {...axisProps}
            domain={[0, 4]}
            ticks={[0, 1, 2, 3, 4]}
            tickFormatter={(v: number) => `${v}x`}
            label={{ value: "Multiple of the real cost schedule", position: "insideBottom", offset: -12, fill: AXIS, fontSize: 11 }}
          />
          <YAxis {...axisProps} domain={[0, 8]} ticks={[0, 2, 4, 6, 8]} width={36} tickFormatter={(v: number) => `${v}%`} />
          <ReferenceLine y={0} stroke={REF} />
          <ReferenceLine x={1} stroke={AXIS} strokeDasharray="4 4" label={{ value: "Real costs", position: "insideTopRight", fill: AXIS, fontSize: 11 }} />
          <Tooltip
            cursor={{ stroke: REF }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof data)[number];
              return (
                <TipBox>
                  <div className="text-[11px] text-ink-dim">{d.x.toFixed(1)}x costs</div>
                  <div className="tnum mt-0.5 text-[12px] font-semibold text-ink">{d.y >= 0 ? "+" : "−"}{Math.abs(d.y).toFixed(1)}% a year</div>
                </TipBox>
              );
            }}
          />
          <Line
            dataKey="y"
            stroke={POS}
            strokeWidth={2}
            dot={{ r: 4, fill: POS, stroke: "#fff", strokeWidth: 2 }}
            activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Bar lists drawn in HTML: crisp at every width, no chart library     */
/* ------------------------------------------------------------------ */

function Figure({ title, caption, children }: { title: string; caption?: React.ReactNode; children: React.ReactNode }) {
  return (
    <figure className="my-6 rounded-xl border border-line bg-surface p-4 sm:p-5">
      <figcaption className="mb-4 text-[13px] font-medium text-ink">{title}</figcaption>
      {children}
      {caption && <p className="mt-4 text-[12px] leading-relaxed text-ink-dim">{caption}</p>}
    </figure>
  );
}

export function SurvivorshipBars({
  rows,
}: {
  rows: { key: string; label: string; cagr: number; ewCagr: number }[];
}) {
  const max = 0.36;
  return (
    <Figure
      title="One strategy on three universes: return a year, March 2009 to June 2026, net of costs"
      caption={
        <>
          The first two universes are today&apos;s Nifty 500, priced from Yahoo and from
          NSE&apos;s files, so every stock in them survived. The third is rebuilt each month
          from every stock trading at the time. Returns fall by about eight points when the
          failures are put back, but the gap between the strategy and its benchmark, on
          the right, barely moves.
        </>
      }
    >
      <div className="space-y-5">
        {rows.map((r) => (
          <div key={r.key} className="grid grid-cols-[1fr_auto] items-center gap-x-4 sm:grid-cols-[11rem_1fr_auto]">
            <div className="col-span-2 mb-1 text-[12.5px] font-medium text-ink sm:col-span-1 sm:mb-0">{r.label}</div>
            <div className="space-y-1.5">
              {[
                { v: r.cagr, c: POS, lab: "Strategy" },
                { v: r.ewCagr, c: MUTED, lab: "Benchmark" },
              ].map((b) => (
                <div key={b.lab} className="flex items-center gap-2" title={`${b.lab}: ${fmtPct(b.v)} a year`}>
                  <div className="h-4 rounded-r-[4px] transition-[width] duration-500" style={{ width: `${(b.v / max) * 100}%`, background: b.c }} />
                  <span className="tnum shrink-0 text-[12px] text-ink-muted">{fmtPct(b.v)}</span>
                </div>
              ))}
            </div>
            <div className="tnum text-right text-[15px] font-semibold text-ink">
              +{((r.cagr - r.ewCagr) * 100).toFixed(1)}
              <div className="text-[10.5px] font-normal text-ink-dim">pts gap</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-4 text-[11.5px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: POS }} /> Strategy
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: MUTED }} /> Equal-weight benchmark
        </span>
      </div>
    </Figure>
  );
}

export function EdgeBreakdown({
  groups,
}: {
  groups: { title: string; rows: { label: string; value: number; t: number }[] }[];
}) {
  const max = 0.1;
  return (
    <Figure
      title="Return over the matching equal-weight benchmark, a year, 2009 to 2026"
      caption={
        <>
          t-statistics in brackets; dark bars are significant at about the 5% level. Among
          the most liquid third of stocks, and in a universe of only the 200 most traded,
          the lead is too small to tell apart from noise.
        </>
      }
    >
      <div className="grid gap-6 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="eyebrow mb-3">{g.title}</p>
            <div className="space-y-3">
              {g.rows.map((r) => (
                <div key={r.label} title={`${r.label}: ${fmtPct(r.value, 1, true)} a year, t = ${r.t.toFixed(2)}`}>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-ink">{r.label}</span>
                    <span className="tnum text-ink">
                      {fmtPct(r.value, 1, true)} <span className="text-ink-dim">(t = {r.t.toFixed(2)})</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 rounded-full bg-surface-3">
                    <div
                      className="h-2.5 rounded-full"
                      style={{
                        width: `${Math.max(0, (r.value / max) * 100)}%`,
                        background: Math.abs(r.t) >= 2 ? POS : "#93c5fd",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Figure>
  );
}
