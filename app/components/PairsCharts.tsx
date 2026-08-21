"use client";

import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { useMounted } from "./useMounted";
import type { CostRow, Example, Point } from "@/lib/pairs";

// Mirrors the design tokens in globals.css so the charts sit on the same
// surface as the page rather than looking pasted onto it.
const AXIS = "#64748b";
const GRID = "#e2e8f0";
const REF = "#cbd5e1";
const INK = "#0f172a";
const BLUE = "#2563eb";
const AMBER = "#b45309";
const TEAL = "#0f766e";
const VIOLET = "#6d28d9";
const SLATE = "#64748b";

const axisProps = {
  stroke: GRID,
  tick: { fill: AXIS, fontSize: 11 },
  tickLine: false,
} as const;

function Frame({
  title,
  height,
  children,
  caption,
}: {
  title: string;
  height: number;
  children: React.ReactNode;
  caption?: React.ReactNode;
}) {
  const mounted = useMounted();
  return (
    <figure className="my-7 rounded-xl border border-line bg-paper p-4 sm:p-5">
      <figcaption className="mb-4 text-[13px] font-semibold text-ink">
        {title}
      </figcaption>
      <div style={{ height }} className="w-full">
        {mounted ? (
          children
        ) : (
          <div className="h-full w-full rounded-lg border border-line bg-surface" />
        )}
      </div>
      {caption && (
        <p className="mt-4 text-[12.5px] leading-relaxed text-ink-dim">
          {caption}
        </p>
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

function Key({ items }: { items: { label: string; colour: string; dash?: boolean }[] }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((i) => (
        <span
          key={i.label}
          className="flex items-center gap-1.5 text-[11.5px] text-ink-muted"
        >
          <i
            aria-hidden
            className="h-0.5 w-4 shrink-0 rounded"
            style={{
              background: i.dash
                ? `repeating-linear-gradient(90deg, ${i.colour} 0 3px, transparent 3px 6px)`
                : i.colour,
            }}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { month: "short", year: "numeric" });

/* ------------------------------------------------------------------ */
/* 1. Equity, before and after costs                                   */
/* ------------------------------------------------------------------ */
export function EquityChart({
  gross,
  net,
  benchmark,
  drawdown,
}: {
  gross: Point[];
  net: Point[];
  benchmark: Point[];
  drawdown: Point[];
}) {
  const data = useMemo(() => {
    const m = new Map<string, Record<string, number | string>>();
    const put = (arr: Point[], k: string) =>
      arr.forEach((p) => {
        const row = m.get(p.d) ?? { d: p.d };
        row[k] = p.v;
        m.set(p.d, row);
      });
    put(gross, "gross");
    put(net, "net");
    put(benchmark, "bench");
    return [...m.values()].sort((a, b) =>
      String(a.d).localeCompare(String(b.d)),
    );
  }, [gross, net, benchmark]);

  const ddData = useMemo(
    () => drawdown.map((p) => ({ d: p.d, dd: p.v * 100 })),
    [drawdown],
  );

  const ticks = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of data) {
      const y = String(r.d).slice(0, 4);
      if (!seen.has(y)) {
        seen.add(y);
        out.push(String(r.d));
      }
    }
    return out;
  }, [data]);

  return (
    <>
      <Frame
        title="Out-of-sample equity, before and after costs"
        height={360}
        caption={
          <>
            Every day here was traded with parameters fixed before it began. The
            gap between the two strategy lines is transaction cost. Buy-and-hold
            of the same eleven banks is shown for contrast, and it is not close.
          </>
        }
      >
        <>
          <Key
            items={[
              { label: "Strategy, before costs", colour: BLUE },
              { label: "Strategy, after costs", colour: AMBER },
              { label: "Buy and hold the universe", colour: SLATE, dash: true },
            ]}
          />
          <ResponsiveContainer width="100%" height={314}>
            <ComposedChart data={data} margin={{ top: 6, right: 14, bottom: 18, left: 2 }}>
              <CartesianGrid stroke={GRID} />
              <XAxis
                dataKey="d"
                ticks={ticks}
                tickFormatter={(d: string) => d.slice(0, 4)}
                {...axisProps}
              />
              <YAxis
                {...axisProps}
                width={46}
                tickFormatter={(v: number) => `${v.toFixed(1)}x`}
              />
              <ReferenceLine y={1} stroke={REF} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3", stroke: REF }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <Tip>
                      <div className="text-[11px] text-ink-dim">
                        {fmtDate(String(label))}
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {payload.map((p) => (
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
                              {{ gross: "before costs", net: "after costs", bench: "buy and hold" }[
                                String(p.dataKey)
                              ]}
                            </span>
                            <span className="tnum ml-auto text-ink">
                              {Number(p.value).toFixed(2)}x
                            </span>
                          </div>
                        ))}
                      </div>
                    </Tip>
                  );
                }}
              />
              <Line type="monotone" dataKey="bench" stroke={SLATE} strokeWidth={1.4}
                strokeDasharray="3 3" dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="gross" stroke={BLUE} strokeWidth={1.9}
                dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="net" stroke={AMBER} strokeWidth={2.2}
                dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </>
      </Frame>

      <Frame
        title="Drawdown, after costs"
        height={220}
        caption="Depth below the running peak. The decline is not one bad episode; it is the steady arithmetic of paying four legs per round trip at a 4.7-day average holding period."
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={ddData} margin={{ top: 6, right: 14, bottom: 18, left: 2 }}>
            <CartesianGrid stroke={GRID} />
            <XAxis
              dataKey="d"
              ticks={ticks}
              tickFormatter={(d: string) => d.slice(0, 4)}
              {...axisProps}
            />
            <YAxis
              {...axisProps}
              width={46}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            />
            <ReferenceLine y={0} stroke={REF} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: REF }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <Tip>
                    <div className="text-[11px] text-ink-dim">
                      {fmtDate(String(label))}
                    </div>
                    <div className="tnum mt-0.5 text-[12px] text-ink">
                      {Number(payload[0].value).toFixed(2)}%
                    </div>
                  </Tip>
                );
              }}
            />
            <Area type="monotone" dataKey="dd" stroke={AMBER} strokeWidth={1.3}
              fill={AMBER} fillOpacity={0.14} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Frame>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Cost sensitivity                                                 */
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
  return (
    <Frame
      title="How much cost the strategy can carry"
      height={300}
      caption={
        <>
          The same trades, re-priced across a grid of cost assumptions. The signal
          never saw costs, so holding the strategy fixed and varying only the
          charge is the honest way to locate the break-even. The shaded band is
          the region where the strategy makes money.
        </>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 20, bottom: 26, left: 4 }}>
          <CartesianGrid stroke={GRID} />
          {breakEven != null && (
            <ReferenceArea x1={0} x2={breakEven} fill={TEAL} fillOpacity={0.07} />
          )}
          <XAxis
            type="number"
            dataKey="bps"
            {...axisProps}
            domain={[0, "dataMax"]}
            label={{
              value: "Transaction cost, bps per leg",
              position: "insideBottom",
              offset: -14,
              fill: AXIS,
              fontSize: 11,
            }}
          />
          <YAxis
            {...axisProps}
            width={46}
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
          />
          <ReferenceLine y={0} stroke={INK} strokeWidth={1.2} />
          <ReferenceLine
            x={assumed}
            stroke={AMBER}
            strokeDasharray="4 4"
            label={{
              value: `assumed ${assumed} bps`,
              position: "top",
              fill: AMBER,
              fontSize: 11,
              fontWeight: 600,
            }}
          />
          {breakEven != null && (
            <ReferenceLine
              x={breakEven}
              stroke={TEAL}
              label={{
                value: `break-even ${breakEven.toFixed(1)}`,
                position: "top",
                fill: TEAL,
                fontSize: 11,
                fontWeight: 600,
              }}
            />
          )}
          <Tooltip
            cursor={{ strokeDasharray: "3 3", stroke: REF }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { bps: number; ann: number };
              return (
                <Tip>
                  <div className="text-[11px] text-ink-dim">
                    {p.bps} bps per leg
                  </div>
                  <div className="tnum mt-0.5 text-[12px] font-semibold text-ink">
                    {p.ann >= 0 ? "+" : ""}
                    {p.ann.toFixed(2)}% a year
                  </div>
                </Tip>
              );
            }}
          />
          <Line type="monotone" dataKey="ann" stroke={BLUE} strokeWidth={2.2}
            dot={{ r: 3, fill: BLUE }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* 3. The mechanism: one pair's spread and z-score                     */
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
  const data = example.series.map((p) => ({ d: p.d, z: p.z, spread: p.spread }));
  const zAt = new Map(example.series.map((p) => [p.d, p.z]));
  const entries = example.trades.map((t) => ({
    d: t.entry, z: zAt.get(t.entry) ?? t.entry_z, side: t.side, reason: t.reason,
    pnl: t.pnl_net,
  }));
  const exits = example.trades.map((t) => ({
    d: t.exit, z: zAt.get(t.exit) ?? t.exit_z, reason: t.reason, pnl: t.pnl_net,
  }));

  const ticks = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of data) {
      const k = r.d.slice(0, 7);
      if (!seen.has(k)) {
        seen.add(k);
        out.push(r.d);
      }
    }
    return out;
  }, [data]);

  return (
    <Frame
      title={`The mechanism: ${example.y} against ${example.beta.toFixed(3)} x ${example.x}`}
      height={380}
      caption={
        <>
          The hedge ratio, the mean and the standard deviation behind this
          z-score were all fixed on the formation window before any of these days
          happened (Engle-Granger p = {example.pvalue.toFixed(4)}, half-life{" "}
          {example.half_life.toFixed(1)} days). Blue marks an entry, amber an
          exit. Nothing on this chart is re-estimated as it goes.
        </>
      }
    >
      <>
        <Key
          items={[
            { label: `entry at |z| = ${entryZ}`, colour: AMBER, dash: true },
            { label: `exit at |z| = ${exitZ}`, colour: TEAL, dash: true },
            { label: `stop at |z| = ${stopZ}`, colour: VIOLET, dash: true },
          ]}
        />
        <ResponsiveContainer width="100%" height={334}>
          <ComposedChart data={data} margin={{ top: 6, right: 14, bottom: 18, left: 2 }}>
            <CartesianGrid stroke={GRID} />
            <XAxis
              dataKey="d"
              ticks={ticks}
              tickFormatter={(d: string) =>
                new Date(d).toLocaleDateString("en-GB", { month: "short" })
              }
              {...axisProps}
            />
            <YAxis
              {...axisProps}
              width={44}
              domain={[-5, 5]}
              ticks={[-4, -2, 0, 2, 4]}
              tickFormatter={(v: number) => `${v}`}
              label={{
                value: "z-score",
                angle: -90,
                position: "insideLeft",
                offset: 12,
                fill: AXIS,
                fontSize: 11,
              }}
            />
            <ZAxis range={[52, 52]} />
            <ReferenceLine y={0} stroke={REF} />
            {[entryZ, -entryZ].map((v) => (
              <ReferenceLine key={`e${v}`} y={v} stroke={AMBER} strokeDasharray="4 4" />
            ))}
            {[exitZ, -exitZ].map((v) => (
              <ReferenceLine key={`x${v}`} y={v} stroke={TEAL} strokeDasharray="2 3" />
            ))}
            {[stopZ, -stopZ].map((v) => (
              <ReferenceLine key={`s${v}`} y={v} stroke={VIOLET} strokeDasharray="4 4" />
            ))}
            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: REF }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as { d: string; z: number; spread: number };
                return (
                  <Tip>
                    <div className="text-[11px] text-ink-dim">{row.d}</div>
                    <div className="tnum mt-0.5 text-[12px] text-ink">
                      z {row.z.toFixed(2)}
                    </div>
                    <div className="tnum text-[11px] text-ink-muted">
                      spread {row.spread.toFixed(2)}
                    </div>
                  </Tip>
                );
              }}
            />
            <Line type="monotone" dataKey="z" stroke={INK} strokeWidth={1.3}
              dot={false} isAnimationActive={false} />
            <Scatter data={entries} dataKey="z" fill={BLUE} shape="triangle" />
            <Scatter data={exits} dataKey="z" fill={AMBER} shape="circle" />
          </ComposedChart>
        </ResponsiveContainer>
      </>
    </Frame>
  );
}
