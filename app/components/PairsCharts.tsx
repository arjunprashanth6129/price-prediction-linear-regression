"use client";

import { useMemo } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMounted } from "./useMounted";
import type { AnnualRow, CostRow, Example, ExitRow, Point } from "@/lib/pairs";

// Mirrors the design tokens in globals.css. Blue and amber carry every
// polarity (before and after costs, profit and loss); everything else is grey.
const AXIS = "#64748b";
const GRID = "#e2e8f0";
const REF = "#cbd5e1";
const INK = "#0f172a";
const INK_MUTED = "#475569";
const BLUE = "#2563eb";
const AMBER = "#b45309";
const SLATE = "#64748b";
const SLATE_DARK = "#334155";

const axisProps = {
  stroke: GRID,
  tick: { fill: AXIS, fontSize: 11 },
  tickLine: false,
} as const;

const DAY = 86_400_000;
const ts = (d: string) => new Date(`${d}T00:00:00Z`).getTime();
const fmtDay = (t: number) =>
  new Date(t).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
const fmtMonth = (t: number) =>
  new Date(t).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
const rupees = (v: number) =>
  `${v < 0 ? "-" : v > 0 ? "+" : ""}₹${Math.abs(Math.round(v)).toLocaleString("en-IN")}`;

/** Evenly spaced round ticks covering [lo, hi]. */
function niceTicks(lo: number, hi: number, step: number) {
  const out: number[] = [];
  const start = Math.floor(lo / step) * step;
  for (let v = start; v <= hi + step * 1e-9; v += step) out.push(+v.toFixed(6));
  if (out[out.length - 1] < hi) out.push(+(out[out.length - 1] + step).toFixed(6));
  return out;
}

/** First trading day of each year present in a date-sorted series. */
function yearTicks(dates: number[]) {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const t of dates) {
    const y = new Date(t).getUTCFullYear();
    if (!seen.has(y)) {
      seen.add(y);
      out.push(Date.UTC(y, 0, 1));
    }
  }
  return out.filter((t) => t >= dates[0]);
}

function Frame({
  title,
  height,
  legend,
  children,
  caption,
}: {
  title: string;
  height: number;
  legend?: React.ReactNode;
  children: React.ReactNode;
  caption?: React.ReactNode;
}) {
  const mounted = useMounted();
  return (
    <figure className="my-7 rounded-xl border border-line bg-paper p-4 sm:p-5">
      <figcaption className="text-[13.5px] font-semibold leading-snug text-ink">
        {title}
      </figcaption>
      {legend && <div className="mt-3">{legend}</div>}
      <div style={{ height }} className="mt-4 w-full">
        {mounted ? (
          children
        ) : (
          <div className="h-full w-full rounded-lg border border-line bg-surface" />
        )}
      </div>
      {caption && (
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-dim">{caption}</p>
      )}
    </figure>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line-strong bg-paper px-3 py-2 shadow-sm">
      {children}
    </div>
  );
}

type Swatch = "line" | "dash" | "dot" | "block" | "ring" | "fill";

function Key({ items }: { items: { label: string; colour: string; kind?: Swatch }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((i) => {
        const kind = i.kind ?? "line";
        let swatch: React.ReactNode;
        if (kind === "block" || kind === "fill") {
          swatch = (
            <i
              aria-hidden
              className="h-2.5 w-3.5 shrink-0 rounded-[3px]"
              style={{ background: i.colour, opacity: kind === "fill" ? 0.3 : 1 }}
            />
          );
        } else if (kind === "ring" || kind === "dot") {
          swatch = (
            <i
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={
                kind === "ring"
                  ? { border: `1.6px solid ${i.colour}`, background: "#fff" }
                  : { background: i.colour }
              }
            />
          );
        } else {
          swatch = (
            <i
              aria-hidden
              className="h-0.5 w-4 shrink-0 rounded"
              style={{
                background:
                  kind === "dash"
                    ? `repeating-linear-gradient(90deg, ${i.colour} 0 3px, transparent 3px 6px)`
                    : i.colour,
              }}
            />
          );
        }
        return (
          <span key={i.label} className="flex items-center gap-1.5 text-[11.5px] text-ink-muted">
            {swatch}
            {i.label}
          </span>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1. The mechanism: one pair's z-score through one trading window     */
/* ------------------------------------------------------------------ */
export function PairMechanism({
  example,
  entryZ,
  exitZ,
  stopZ,
}: {
  example: Example;
  entryZ: number;
  exitZ: number;
  stopZ: number;
}) {
  const data = useMemo(
    () => example.series.map((p) => ({ t: ts(p.d), z: p.z, spread: p.spread })),
    [example],
  );
  const zAt = useMemo(() => new Map(data.map((r) => [r.t, r.z])), [data]);
  const entries = example.trades.map((t) => ({ t: ts(t.entry), z: zAt.get(ts(t.entry)) }));
  const exits = example.trades.map((t) => ({ t: ts(t.exit), z: zAt.get(ts(t.exit)) }));

  const lim = Math.ceil(Math.max(stopZ + 0.5, ...data.map((r) => Math.abs(r.z) + 0.3)));
  const months = useMemo(() => {
    const out: number[] = [];
    const first = new Date(data[0].t);
    for (let m = 0; m < 8; m++) {
      const t = Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + m, 1);
      if (t >= data[0].t && t <= data[data.length - 1].t) out.push(t);
    }
    return out;
  }, [data]);

  const nRev = example.trades.filter((t) => t.reason === "reverted").length;
  const nStop = example.trades.filter((t) => t.reason === "stop").length;
  const short = (s: string) => s.replace(".NS", "");
  const bands: [number, string, string][] = [
    [stopZ, SLATE_DARK, "0"],
    [entryZ, SLATE, "5 4"],
    [exitZ, SLATE, "2 3"],
  ];

  return (
    <Frame
      title={`${short(example.y)} against ${example.beta.toFixed(2)} x ${short(example.x)}: ${example.trades.length} trades, ${nRev} converged, ${nStop} stopped out`}
      height={330}
      legend={
        <Key
          items={[
            { label: "trade closed in profit", colour: BLUE, kind: "fill" },
            { label: "trade closed at a loss", colour: AMBER, kind: "fill" },
            { label: "entry", colour: INK, kind: "ring" },
            { label: "exit", colour: INK, kind: "dot" },
          ]}
        />
      }
      caption={
        <>
          The z-score is the spread&apos;s distance from its formation mean, in
          formation standard deviations. The hedge ratio, mean and standard
          deviation were fixed on the previous 12 months (Engle-Granger p ={" "}
          {example.pvalue.toFixed(3)}, half-life {example.half_life.toFixed(1)}{" "}
          days). Markers sit at the fill, one day after the signal.
        </>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 6, right: 56, bottom: 4, left: -8 }}>
          {example.trades.map((t) => (
            <ReferenceArea
              key={t.entry}
              x1={ts(t.entry)}
              x2={ts(t.exit)}
              fill={t.pnl_net > 0 ? BLUE : AMBER}
              fillOpacity={t.pnl_net > 0 ? 0.09 : 0.12}
              strokeWidth={0}
              ifOverflow="hidden"
            />
          ))}
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[data[0].t - 2 * DAY, data[data.length - 1].t + 2 * DAY]}
            ticks={months}
            tickFormatter={fmtMonth}
            {...axisProps}
          />
          <YAxis
            {...axisProps}
            axisLine={false}
            width={40}
            domain={[-lim, lim]}
            ticks={[-stopZ, -entryZ, 0, entryZ, stopZ]}
            allowDataOverflow
          />
          <ReferenceLine y={0} stroke={REF} />
          {bands.flatMap(([v, colour, dash]) =>
            [v, -v].map((y) => (
              <ReferenceLine
                key={`b${y}`}
                y={y}
                stroke={colour}
                strokeDasharray={dash}
                label={{
                  value: `${y === stopZ || y === -stopZ ? "stop" : y === entryZ || y === -entryZ ? "entry" : "exit"} ${y > 0 ? "+" : ""}${y}`,
                  position: "right",
                  fill: INK_MUTED,
                  fontSize: 10.5,
                }}
              />
            )),
          )}
          <Tooltip
            cursor={{ stroke: REF }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as { t: number; z: number; spread?: number };
              return (
                <Tip>
                  <div className="text-[11px] text-ink-dim">{fmtDay(row.t)}</div>
                  <div className="tnum mt-0.5 text-[12px] text-ink">z = {row.z.toFixed(2)}</div>
                </Tip>
              );
            }}
          />
          <Line
            type="linear"
            dataKey="z"
            stroke={INK}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3.5, fill: INK, stroke: "#fff", strokeWidth: 2 }}
            isAnimationActive={false}
          />
          <Scatter
            data={entries}
            dataKey="z"
            isAnimationActive={false}
            shape={(p: { cx?: number; cy?: number }) => (
              <circle cx={p.cx} cy={p.cy} r={4.5} fill="#fff" stroke={INK} strokeWidth={1.8} />
            )}
          />
          <Scatter
            data={exits}
            dataKey="z"
            isAnimationActive={false}
            shape={(p: { cx?: number; cy?: number }) => (
              <circle cx={p.cx} cy={p.cy} r={4.5} fill={INK} stroke="#fff" strokeWidth={1.8} />
            )}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Where the money came from: gross P&L by exit, then costs          */
/* ------------------------------------------------------------------ */
const EXIT_LABEL: Record<ExitRow["reason"], string> = {
  reverted: "Converged",
  stop: "Stopped",
  timeout: "Timed out",
  window_end: "Window end",
};

export function ExitWaterfall({ exits }: { exits: ExitRow[] }) {
  const rows = useMemo(() => {
    const out: {
      name: string;
      base: number;
      size: number;
      value: number;
      colour: string;
      note: string;
    }[] = [];
    let level = 0;
    for (const e of exits) {
      const v = e.gross / 1000;
      out.push({
        name: EXIT_LABEL[e.reason],
        base: Math.min(level, level + v),
        size: Math.abs(v),
        value: v,
        colour: v >= 0 ? BLUE : AMBER,
        note: `${e.n} trades, median ${e.median_hold} days held`,
      });
      level += v;
    }
    const gross = level;
    const cost = exits.reduce((a, e) => a + e.cost, 0) / 1000;
    const n = exits.reduce((a, e) => a + e.n, 0);
    out.push({ name: "Gross", base: Math.min(0, gross), size: Math.abs(gross), value: gross, colour: SLATE, note: "before costs" });
    out.push({ name: "Costs", base: gross - cost, size: cost, value: -cost, colour: AMBER, note: `${n} round trips` });
    const net = gross - cost;
    out.push({ name: "Net", base: Math.min(0, net), size: Math.abs(net), value: net, colour: SLATE, note: "after costs" });
    return out;
  }, [exits]);

  const lo = Math.min(...rows.map((r) => r.base));
  const hi = Math.max(...rows.map((r) => r.base + r.size));
  const ticks = niceTicks(lo, hi, 100);

  return (
    <Frame
      title="Gross P&L by exit type, then costs (₹ thousands)"
      height={300}
      legend={
        <Key
          items={[
            { label: "positive contribution", colour: BLUE, kind: "block" },
            { label: "negative contribution", colour: AMBER, kind: "block" },
            { label: "running total", colour: SLATE, kind: "block" },
          ]}
        />
      }
      caption="Each bar begins where the bar above it ends. All trades, on ₹1 lakh of gross notional per position."
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 0, right: 40, bottom: 4, left: 0 }}
          barCategoryGap="24%"
        >
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis
            type="number"
            {...axisProps}
            domain={[ticks[0], ticks[ticks.length - 1]]}
            ticks={ticks}
          />
          <YAxis
            type="category"
            dataKey="name"
            {...axisProps}
            axisLine={false}
            width={78}
            interval={0}
            tick={{ fill: INK_MUTED, fontSize: 11.5 }}
          />
          <ReferenceLine x={0} stroke={SLATE} />
          <Tooltip
            cursor={{ fill: "#f1f5f9" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as (typeof rows)[number];
              return (
                <Tip>
                  <div className="text-[11px] font-medium text-ink">{r.name}</div>
                  <div className="tnum mt-0.5 text-[12px] text-ink">{rupees(r.value * 1000)}</div>
                  <div className="text-[11px] text-ink-dim">{r.note}</div>
                </Tip>
              );
            }}
          />
          <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="size" stackId="w" radius={[3, 3, 3, 3]} isAnimationActive={false}>
            {rows.map((r) => (
              <Cell key={r.name} fill={r.colour} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v: unknown) => `${Number(v) > 0 ? "+" : ""}${Math.round(Number(v))}`}
              style={{ fill: INK, fontSize: 11, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Equity, before and after costs, and the drawdown                 */
/* ------------------------------------------------------------------ */
export function EquityChart({
  gross,
  net,
  drawdown,
}: {
  gross: Point[];
  net: Point[];
  drawdown: Point[];
}) {
  const data = useMemo(() => {
    const n = new Map(net.map((p) => [p.d, p.v]));
    return gross.map((p) => ({ t: ts(p.d), gross: p.v, net: n.get(p.d) ?? null }));
  }, [gross, net]);
  const dd = useMemo(() => drawdown.map((p) => ({ t: ts(p.d), dd: p.v * 100 })), [drawdown]);
  const years = useMemo(() => yearTicks(data.map((r) => r.t)), [data]);
  const vals = data.flatMap((r) => [r.gross, r.net ?? r.gross]);
  const yTicks = niceTicks(Math.min(...vals), Math.max(...vals), 0.05);
  const ddTicks = niceTicks(Math.min(...dd.map((r) => r.dd)), 0, 5);
  const domain = [data[0].t, data[data.length - 1].t];
  const last = data[data.length - 1];

  return (
    <>
      <Frame
        title={`Growth of ₹1, out of sample: ${last.gross.toFixed(2)}x before costs, ${(last.net ?? 0).toFixed(2)}x after`}
        height={300}
        legend={
          <Key
            items={[
              { label: "before costs", colour: BLUE },
              { label: "after costs", colour: AMBER },
            ]}
          />
        }
        caption="All parameters were fixed before each trading period began. The vertical gap between the two series is the cumulative transaction cost."
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 4, left: -8 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={domain}
              ticks={years}
              tickFormatter={(t: number) => `${new Date(t).getUTCFullYear()}`}
              {...axisProps}
            />
            <YAxis
              {...axisProps}
              axisLine={false}
              width={48}
              domain={[yTicks[0], yTicks[yTicks.length - 1]]}
              ticks={yTicks}
              tickFormatter={(v: number) => `${v.toFixed(2)}x`}
            />
            <ReferenceLine y={1} stroke={SLATE} />
            <Tooltip
              cursor={{ stroke: REF }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const r = payload[0].payload as { t: number; gross: number; net: number };
                return (
                  <Tip>
                    <div className="text-[11px] text-ink-dim">{fmtDay(r.t)}</div>
                    <div className="tnum mt-1 flex items-center gap-2 text-[11.5px]">
                      <i aria-hidden className="h-2 w-2 rounded-sm" style={{ background: BLUE }} />
                      <span className="text-ink-muted">before costs</span>
                      <span className="ml-auto text-ink">{r.gross.toFixed(3)}x</span>
                    </div>
                    <div className="tnum flex items-center gap-2 text-[11.5px]">
                      <i aria-hidden className="h-2 w-2 rounded-sm" style={{ background: AMBER }} />
                      <span className="text-ink-muted">after costs</span>
                      <span className="ml-auto text-ink">{r.net.toFixed(3)}x</span>
                    </div>
                  </Tip>
                );
              }}
            />
            <Line type="linear" dataKey="gross" stroke={BLUE} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="linear" dataKey="net" stroke={AMBER} strokeWidth={2} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Frame>

      <Frame
        title={`Drawdown after costs, worst ${Math.min(...dd.map((r) => r.dd)).toFixed(1)}%`}
        height={190}
        caption="Percentage decline of the after-cost series from its running maximum."
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dd} margin={{ top: 6, right: 8, bottom: 4, left: -8 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={domain}
              ticks={years}
              tickFormatter={(t: number) => `${new Date(t).getUTCFullYear()}`}
              {...axisProps}
            />
            <YAxis
              {...axisProps}
              axisLine={false}
              width={48}
              domain={[ddTicks[0], 0]}
              ticks={ddTicks}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            />
            <ReferenceLine y={0} stroke={SLATE} />
            <Tooltip
              cursor={{ stroke: REF }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const r = payload[0].payload as { t: number; dd: number };
                return (
                  <Tip>
                    <div className="text-[11px] text-ink-dim">{fmtDay(r.t)}</div>
                    <div className="tnum mt-0.5 text-[12px] text-ink">{r.dd.toFixed(2)}%</div>
                  </Tip>
                );
              }}
            />
            <Area type="linear" dataKey="dd" stroke={AMBER} strokeWidth={1.4} fill={AMBER} fillOpacity={0.12} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Frame>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Calendar-year return                                             */
/* ------------------------------------------------------------------ */
export function AnnualChart({ rows }: { rows: AnnualRow[] }) {
  const data = rows.map((r) => ({
    ...r,
    label: `'${String(r.year).slice(2)}${r.days > 200 ? "" : "*"}`,
  }));
  const vals = data.flatMap((r) => [r.gross, r.net]);
  const ticks = niceTicks(Math.min(...vals), Math.max(...vals), 5);
  const partial = rows.find((r) => r.days <= 200);
  return (
    <Frame
      title="Return in each calendar year"
      height={260}
      legend={
        <Key
          items={[
            { label: "before costs", colour: BLUE, kind: "block" },
            { label: "after costs", colour: AMBER, kind: "block" },
          ]}
        />
      }
      caption={partial ? `* ${partial.year} covers January to June only.` : undefined}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 4, bottom: 4, left: -8 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" {...axisProps} interval={0} tick={{ fill: AXIS, fontSize: 10.5 }} />
          <YAxis
            {...axisProps}
            axisLine={false}
            width={44}
            domain={[ticks[0], ticks[ticks.length - 1]]}
            ticks={ticks}
            tickFormatter={(v: number) => `${v}%`}
          />
          <ReferenceLine y={0} stroke={SLATE} />
          <Tooltip
            cursor={{ fill: "#f1f5f9" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as AnnualRow;
              const f = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
              return (
                <Tip>
                  <div className="text-[11px] font-medium text-ink">
                    {r.year}
                    {r.days <= 200 ? ", Jan to Jun" : ""}
                  </div>
                  <div className="tnum mt-1 flex items-center gap-2 text-[11.5px]">
                    <i aria-hidden className="h-2 w-2 rounded-sm" style={{ background: BLUE }} />
                    <span className="text-ink-muted">before costs</span>
                    <span className="ml-auto text-ink">{f(r.gross)}</span>
                  </div>
                  <div className="tnum flex items-center gap-2 text-[11.5px]">
                    <i aria-hidden className="h-2 w-2 rounded-sm" style={{ background: AMBER }} />
                    <span className="text-ink-muted">after costs</span>
                    <span className="ml-auto text-ink">{f(r.net)}</span>
                  </div>
                </Tip>
              );
            }}
          />
          <Bar dataKey="gross" fill={BLUE} radius={[2, 2, 2, 2]} maxBarSize={18} isAnimationActive={false} />
          <Bar dataKey="net" fill={AMBER} radius={[2, 2, 2, 2]} maxBarSize={18} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Cost sensitivity                                                 */
/* ------------------------------------------------------------------ */
export function CostChart({
  rows,
  assumed,
  breakEven,
}: {
  rows: CostRow[];
  assumed: number;
  breakEven: number | null;
}) {
  const data = rows.map((r) => ({ bps: r.bps_per_leg, ann: r["ann_return_%"] }));
  const vals = data.map((r) => r.ann);
  const yTicks = niceTicks(Math.min(...vals), Math.max(...vals), 0.5);
  const maxBps = Math.max(...data.map((r) => r.bps));
  const atAssumed = data.find((r) => r.bps === assumed)?.ann;

  return (
    <Frame
      title="Annualised return at each cost level"
      height={260}
      legend={
        <Key
          items={[
            { label: "annualised return", colour: BLUE },
            ...(breakEven != null
              ? [{ label: `break-even, ${breakEven.toFixed(1)} bps`, colour: INK, kind: "dot" as const }]
              : []),
            {
              label: `assumed, ${assumed} bps${atAssumed != null ? ` (${atAssumed.toFixed(2)}% a year)` : ""}`,
              colour: SLATE_DARK,
              kind: "dash",
            },
          ]}
        />
      }
      caption="The same trades repriced at each cost level. The trades are unchanged because the signal does not depend on costs."
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 10, bottom: 18, left: -8 }}>
          <CartesianGrid stroke={GRID} />
          <XAxis
            type="number"
            dataKey="bps"
            {...axisProps}
            domain={[0, maxBps]}
            ticks={niceTicks(0, maxBps, 5)}
            label={{ value: "Cost, bps per leg", position: "insideBottom", offset: -12, fill: AXIS, fontSize: 11 }}
          />
          <YAxis
            {...axisProps}
            axisLine={false}
            width={48}
            domain={[yTicks[0], yTicks[yTicks.length - 1]]}
            ticks={yTicks}
            tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`}
          />
          <ReferenceLine y={0} stroke={SLATE} />
          <ReferenceLine x={assumed} stroke={SLATE_DARK} strokeDasharray="4 4" />
          <Tooltip
            cursor={{ stroke: REF }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { bps: number; ann: number };
              return (
                <Tip>
                  <div className="text-[11px] text-ink-dim">{p.bps} bps per leg</div>
                  <div className="tnum mt-0.5 text-[12px] font-semibold text-ink">
                    {p.ann >= 0 ? "+" : ""}
                    {p.ann.toFixed(2)}% a year
                  </div>
                </Tip>
              );
            }}
          />
          <Line
            type="linear"
            dataKey="ann"
            stroke={BLUE}
            strokeWidth={2}
            dot={{ r: 3.5, fill: BLUE, stroke: "#fff", strokeWidth: 1.5 }}
            isAnimationActive={false}
          />
          {breakEven != null && (
            <Scatter
              data={[{ bps: breakEven, ann: 0 }]}
              dataKey="ann"
              isAnimationActive={false}
              shape={(p: { cx?: number; cy?: number }) => (
                <circle cx={p.cx} cy={p.cy} r={5.5} fill={INK} stroke="#fff" strokeWidth={2} />
              )}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </Frame>
  );
}
