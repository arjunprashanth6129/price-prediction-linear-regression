"use client";

import { useState } from "react";
import {
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
import { AXIS, Frame, NEG, POS, REF, TipBox, axisProps } from "./Charts";

const INK = "#0f172a";
const SLATE = "#94a3b8";

const fmtPct = (x: number, d = 1, signed = false) =>
  `${signed && x > 0 ? "+" : ""}${(x * 100).toFixed(d).replace("-", "−")}%`;

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
  const last = data[data.length - 1];
  const top = mode === "pit" ? 50 : 150;
  const ticks = [1, 2, 5, 10, 20, 50, 100].filter((t) => t <= top);
  const xTicks = months.filter((m) => m.endsWith("-01") && Number(m.slice(0, 4)) % 2 === 0);

  const series = [
    { key: "s", label: "Strategy", color: POS, width: 2.6, dash: undefined },
    { key: "e", label: "Equal-weight benchmark", color: INK, width: 1.5, dash: undefined },
    { key: "k", label: "Nifty500 Momentum 50", color: NEG, width: 1.5, dash: "2 3" },
    { key: "n", label: "Nifty 500", color: SLATE, width: 1.5, dash: "6 4" },
  ] as const;

  return (
    <Frame
      title="Growth of ₹1 invested in March 2009, net of costs (log scale)"
      height={380}
      caption={
        mode === "pit" ? (
          <>
            Every NSE stock trading at the time, including those that later failed.{" "}
            <strong className="font-semibold text-ink">
              ₹1 became ₹{last.s.toFixed(1)}
            </strong>{" "}
            against ₹{last.e.toFixed(1)} for the benchmark and ₹{last.n.toFixed(1)}{" "}
            for the Nifty 500. Indices pay no trading costs.
          </>
        ) : (
          <>
            Today&apos;s Nifty 500 only, so every stock survived.{" "}
            <strong className="font-semibold text-ink">
              ₹1 appears to become ₹{last.s.toFixed(0)}
            </strong>
            , and the benchmark ₹{last.e.toFixed(0)}. Both are inflated by
            survivorship bias.
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
                ["pit", "Corrected universe"],
                ["survivor", "Survivors only"],
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
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-ink-muted">
            {series.map((s) => (
              <li key={s.key} className="inline-flex items-center gap-1.5">
                <svg width="18" height="6" aria-hidden>
                  <line
                    x1="0" y1="3" x2="18" y2="3"
                    stroke={s.color}
                    strokeWidth={s.width}
                    strokeDasharray={s.dash}
                  />
                </svg>
                {s.label}
              </li>
            ))}
          </ul>
        </div>
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <ReferenceArea
                x1={holdoutStart}
                x2={months[months.length - 1]}
                fill="#f1f5f9"
                fillOpacity={1}
                label={{ value: "Holdout", position: "insideTopLeft", fill: AXIS, fontSize: 11 }}
              />
              <XAxis
                dataKey="m"
                {...axisProps}
                ticks={xTicks}
                tickFormatter={(m: string) => m.slice(0, 4)}
              />
              <YAxis
                {...axisProps}
                scale="log"
                domain={[1, top]}
                allowDataOverflow
                ticks={ticks}
                tickFormatter={(v: number) => `${v}x`}
                width={42}
              />
              <Tooltip
                cursor={{ stroke: REF }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as (typeof data)[number];
                  return (
                    <TipBox>
                      <div className="text-[11px] text-ink-dim">{label}</div>
                      {series.map((s) => (
                        <div key={s.key} className="tnum mt-0.5 flex justify-between gap-4 text-[12px]">
                          <span style={{ color: s.color === SLATE ? AXIS : s.color }}>{s.label}</span>
                          <span className="font-semibold text-ink">
                            {(d[s.key as "s" | "e" | "n" | "k"] as number).toFixed(2)}x
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
                  isAnimationActive={false}
                />
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
      title="Which signals predicted next month's return, 2006 to 2018"
      height={360}
      caption={
        <>
          Newey-West t-statistic of each signal&apos;s monthly rank correlation with the next
          month&apos;s return. The four beyond ±2 (dashed) were chosen and frozen before any
          backtest. The 200-day trend enters inverted: a price above its 200-day average
          scores well.
        </>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={signals}
          layout="vertical"
          margin={{ top: 4, right: 40, bottom: 4, left: 4 }}
          barCategoryGap={6}
        >
          <XAxis type="number" {...axisProps} domain={[-3, 3]} ticks={[-3, -2, -1, 0, 1, 2, 3]} />
          <YAxis type="category" dataKey="label" {...axisProps} width={150} interval={0} />
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
                    t = {d.t.toFixed(2)} {d.selected ? "· selected" : "· not selected"}
                  </div>
                  <div className="tnum text-[11px] text-ink-dim">
                    t on survivorship-free data: {d.tNse.toFixed(2)}
                  </div>
                </TipBox>
              );
            }}
          />
          <Bar dataKey="t" radius={2} isAnimationActive={false}>
            {signals.map((d) => (
              <Cell key={d.key} fill={d.selected ? (d.t > 0 ? POS : NEG) : "#cbd5e1"} />
            ))}
            <LabelList
              dataKey="t"
              position="right"
              fill={AXIS}
              fontSize={11}
              formatter={(v: unknown) => (Number(v) > 0 ? "+" : "") + Number(v).toFixed(2)}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Random portfolios                                                   */
/* ------------------------------------------------------------------ */

export function RandomHistogram({
  edges,
  counts,
  strategy,
  n,
}: {
  edges: number[];
  counts: number[];
  strategy: number;
  n: number;
}) {
  // Extend the bins with empty ones out to the strategy's Sharpe ratio, so the
  // gap between the best random portfolio and the strategy is drawn to scale.
  const step = edges[1] - edges[0];
  const rows: { bin: string; count: number; mark: boolean }[] = [];
  const stop = Math.ceil((strategy + step) / step) * step;
  for (let x = edges[0], i = 0; x < stop - 1e-9; x += step, i++) {
    rows.push({
      bin: x.toFixed(2),
      count: i < counts.length ? counts[i] : 0,
      mark: strategy >= x && strategy < x + step,
    });
  }
  const markBin = rows.find((r) => r.mark)?.bin;
  return (
    <Frame
      title={`Strategy against ${n.toLocaleString("en-IN")} random portfolios, before costs`}
      height={280}
      caption={
        <>
          Each random portfolio holds the same number of stocks, drawn at random from the
          same eligible stocks every month.{" "}
          <strong className="font-semibold text-ink">None comes close.</strong>
        </>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 24, right: 8, bottom: 18, left: 0 }} barCategoryGap={1}>
          <XAxis
            dataKey="bin"
            {...axisProps}
            interval={1}
            label={{ value: "Sharpe ratio, 2009 to 2026", position: "insideBottom", offset: -12, fill: AXIS, fontSize: 11 }}
          />
          <YAxis {...axisProps} allowDecimals={false} width={36} />
          <Tooltip
            cursor={{ fill: "rgba(15,23,42,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof rows)[number];
              return (
                <TipBox>
                  <div className="text-[11px] text-ink-dim">Sharpe {d.bin} to {(Number(d.bin) + step).toFixed(2)}</div>
                  <div className="tnum mt-0.5 text-sm font-semibold text-ink">
                    {d.count} random portfolios
                  </div>
                </TipBox>
              );
            }}
          />
          {markBin && (
            <ReferenceLine
              x={markBin}
              stroke={POS}
              strokeWidth={2.5}
              label={{ value: `Strategy ${strategy.toFixed(2)}`, position: "top", fill: POS, fontSize: 12, fontWeight: 600 }}
            />
          )}
          <Bar dataKey="count" fill="#cbd5e1" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
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
  const behind = data.filter((d) => d.diff < 0).length;
  return (
    <Frame
      title="Strategy minus benchmark, by calendar year (percentage points)"
      height={260}
      caption={
        <>
          Behind in {behind} of {data.length} years. The worst was 2009 (from March), cut off
          here: the strategy trailed by {Math.abs(data[0].diff).toFixed(0)} points as the
          stocks that had fallen furthest led the rebound.
        </>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
                    Strategy {fmtPct(d.strategy, 1, true)} · benchmark {fmtPct(d.ew, 1, true)}
                  </div>
                  <div className={`tnum text-[12px] font-semibold ${d.diff > 0 ? "text-accent" : "text-[#b45309]"}`}>
                    {d.diff > 0 ? "+" : "−"}
                    {Math.abs(d.diff).toFixed(1)} points
                  </div>
                </TipBox>
              );
            }}
          />
          <Bar dataKey="shown" radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.year} fill={d.diff > 0 ? POS : NEG} />
            ))}
          </Bar>
        </BarChart>
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
      title="One strategy, three universes: compound annual return, 2009 to 2026, net of costs"
      caption={
        <>
          The first two universes are today&apos;s Nifty 500, so every stock in them survived.
          The third is rebuilt each month from every stock trading at the time.
        </>
      }
    >
      <div className="space-y-5">
        {rows.map((r) => (
          <div key={r.key} className="grid grid-cols-[1fr_auto] items-center gap-x-4 sm:grid-cols-[11rem_1fr_auto]">
            <div className="col-span-2 text-[12.5px] font-medium text-ink sm:col-span-1">{r.label}</div>
            <div className="space-y-1.5">
              {[
                { v: r.cagr, c: POS, lab: "Strategy" },
                { v: r.ewCagr, c: "#cbd5e1", lab: "Benchmark" },
              ].map((b) => (
                <div key={b.lab} className="flex items-center gap-2" title={`${b.lab}: ${fmtPct(b.v)} a year`}>
                  <div
                    className="h-4 rounded-r transition-[width] duration-500"
                    style={{ width: `${(b.v / max) * 100}%`, background: b.c }}
                  />
                  <span className="tnum shrink-0 text-[12px] text-ink-muted">{fmtPct(b.v)}</span>
                </div>
              ))}
            </div>
            <div className="tnum text-right text-[15px] font-semibold text-accent">
              +{((r.cagr - r.ewCagr) * 100).toFixed(1)}
              <div className="text-[10.5px] font-normal text-ink-dim">gap</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-4 text-[11.5px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: POS }} /> Strategy
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#cbd5e1]" /> Equal-weight benchmark
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
  const max = 0.12;
  return (
    <Figure
      title="Return over the matching equal-weight benchmark, a year, 2009 to 2026"
      caption={
        <>
          t-statistics in brackets. Within the most liquid third, and among the 200 most
          traded stocks, the edge is too small to tell from noise.
        </>
      }
    >
      <div className="grid gap-6 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="eyebrow mb-3">{g.title}</p>
            <div className="space-y-2.5">
              {g.rows.map((r) => (
                <div key={r.label} title={`${r.label}: ${fmtPct(r.value, 1, true)} a year, t = ${r.t.toFixed(2)}`}>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-ink">{r.label}</span>
                    <span className="tnum text-ink-muted">
                      {fmtPct(r.value, 1, true)} <span className="text-ink-dim">({r.t.toFixed(2)})</span>
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
