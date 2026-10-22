"use client";

import { useState } from "react";
import {
  Bar,
  ComposedChart,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS, Frame, NEG, POS, REF, TipBox, axisProps } from "./Charts";

const INK = "#0f172a";
const SLATE = "#94a3b8";

const fmtPct = (x: number, d = 1, signed = false) =>
  `${signed && x > 0 ? "+" : ""}${(x * 100).toFixed(d).replace("-", "−")}%`;

function Toggle<K extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly (readonly [K, string])[];
  value: K;
  onChange: (k: K) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-lg border border-line bg-paper p-0.5 text-[12.5px]"
    >
      {options.map(([k, lab]) => (
        <button
          key={k}
          type="button"
          aria-pressed={value === k}
          onClick={() => onChange(k)}
          className={`min-h-9 cursor-pointer rounded-md px-3 font-medium transition-colors duration-200 ${
            value === k ? "bg-accent text-paper" : "text-ink-muted hover:text-ink"
          }`}
        >
          {lab}
        </button>
      ))}
    </div>
  );
}

function Key({ items }: { items: { label: string; color: string; dash?: string; dot?: boolean; width?: number }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-ink-muted">
      {items.map((s) => (
        <li key={s.label} className="inline-flex items-center gap-1.5">
          <svg width="18" height="8" aria-hidden>
            {s.dot ? (
              <circle cx="9" cy="4" r="3" fill={s.color} />
            ) : (
              <line x1="0" y1="4" x2="18" y2="4" stroke={s.color} strokeWidth={s.width ?? 2} strokeDasharray={s.dash} />
            )}
          </svg>
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* VaR forecasts and breaches for 60/40, 2008 and 2020                 */
/* ------------------------------------------------------------------ */

export function BreachChart({
  windows,
}: {
  windows: { key: string; label: string; dates: string[]; ret: number[]; hs: number[]; garch: number[] }[];
}) {
  const [key, setKey] = useState(windows[0].key);
  const w = windows.find((x) => x.key === key) ?? windows[0];
  const data = w.dates.map((d, i) => {
    const r = w.ret[i] * 100;
    const h = w.hs[i] * 100;
    const g = w.garch[i] * 100;
    return { d, r, h, g, hitH: r < h ? r : null, hitG: r < g ? r : null };
  });
  const nH = data.filter((x) => x.hitH !== null).length;
  const nG = data.filter((x) => x.hitG !== null).length;
  const ticks = w.dates.filter((d, i) => i === 0 || d.slice(5, 7) !== w.dates[i - 1].slice(5, 7)).filter((d) =>
    ["01", "04", "07", "10"].includes(d.slice(5, 7)),
  );
  return (
    <Frame
      title="Tomorrow's 97.5% VaR forecast for 60/40, and the days it was breached"
      height={340}
      caption={
        <>
          Bars are daily returns of 60/40 (Nifty 50 and gilt). Each line is a forecast made the evening before.
          A dot marks a day the loss beat the forecast of the same colour:{" "}
          <strong className="font-semibold text-ink">
            {nH} for historical simulation, {nG} for the filtered model
          </strong>{" "}
          in this window. Historical simulation barely moves, so its breaches come in runs.
        </>
      }
    >
      <div className="flex h-full flex-col">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <Toggle
            label="Window"
            options={windows.map((x) => [x.key, x.label] as const)}
            value={key}
            onChange={setKey}
          />
          <Key
            items={[
              { label: "Historical simulation", color: NEG },
              { label: "Filtered (GARCH)", color: POS },
              { label: "Daily return", color: REF, width: 6 },
            ]}
          />
        </div>
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="d"
                {...axisProps}
                ticks={ticks}
                tickFormatter={(d: string) =>
                  new Date(d).toLocaleDateString("en-GB", { month: "short", year: "2-digit" })
                }
              />
              <YAxis {...axisProps} width={40} tickFormatter={(v: number) => `${v}%`} domain={[-12, 12]} ticks={[-10, -5, 0, 5, 10]} allowDataOverflow />
              <ReferenceLine y={0} stroke={REF} />
              <Tooltip
                cursor={{ stroke: REF }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as (typeof data)[number];
                  return (
                    <TipBox>
                      <div className="text-[11px] text-ink-dim">{label}</div>
                      <div className="tnum mt-0.5 text-[12px] text-ink">Return {p.r.toFixed(2).replace("-", "−")}%</div>
                      <div className="tnum text-[12px]" style={{ color: NEG }}>
                        HS VaR {p.h.toFixed(2).replace("-", "−")}%{p.hitH !== null ? " · breached" : ""}
                      </div>
                      <div className="tnum text-[12px]" style={{ color: POS }}>
                        Filtered VaR {p.g.toFixed(2).replace("-", "−")}%{p.hitG !== null ? " · breached" : ""}
                      </div>
                    </TipBox>
                  );
                }}
              />
              <Bar dataKey="r" fill="#cbd5e1" isAnimationActive={false} />
              <Line dataKey="h" stroke={NEG} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line dataKey="g" stroke={POS} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Scatter dataKey="hitH" fill={NEG} isAnimationActive={false} />
              <Scatter dataKey="hitG" fill={POS} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Growth and drawdown, with a toggle                                  */
/* ------------------------------------------------------------------ */

export interface GrowthSeries {
  key: string;
  label: string;
  color: string;
  width: number;
  dash?: string;
  values: number[];
}

export function GrowthDrawdown({
  title,
  dates,
  series,
  caption,
  shade,
  yearStep = 2,
  logTicks,
}: {
  title: string;
  dates: string[];
  series: GrowthSeries[];
  caption: React.ReactNode;
  shade?: { from: string; to: string; label: string };
  yearStep?: number;
  logTicks: number[];
}) {
  const [mode, setMode] = useState<"growth" | "drawdown">("growth");
  const peaks = series.map(() => 0);
  const data = dates.map((d, i) => {
    const row: Record<string, number | string> = { d };
    series.forEach((s, j) => {
      const v = s.values[i];
      peaks[j] = Math.max(peaks[j], v);
      row[s.key] = mode === "growth" ? v : (v / peaks[j] - 1) * 100;
    });
    return row;
  });
  const years = Array.from(new Set(dates.map((d) => d.slice(0, 4))));
  const ticks = years
    .filter((y) => Number(y) % yearStep === 0)
    .map((y) => dates.find((d) => d.startsWith(y)) as string)
    .filter(Boolean);
  const top = Math.max(...series.map((s) => Math.max(...s.values)));
  return (
    <Frame title={title} height={380} caption={caption}>
      <div className="flex h-full flex-col">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <Toggle
            label="View"
            options={[
              ["growth", "Growth"],
              ["drawdown", "Drawdown"],
            ] as const}
            value={mode}
            onChange={setMode}
          />
          <Key items={series.map((s) => ({ label: s.label, color: s.color, dash: s.dash, width: s.width }))} />
        </div>
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              {shade && (
                <ReferenceArea
                  x1={shade.from}
                  x2={shade.to}
                  fill="#f1f5f9"
                  fillOpacity={1}
                  label={{ value: shade.label, position: "insideTopLeft", fill: AXIS, fontSize: 11 }}
                />
              )}
              <XAxis dataKey="d" {...axisProps} ticks={ticks} tickFormatter={(d: string) => d.slice(0, 4)} />
              {mode === "growth" ? (
                <YAxis
                  {...axisProps}
                  scale="log"
                  domain={[logTicks[0], Math.max(top * 1.05, logTicks[logTicks.length - 1])]}
                  allowDataOverflow
                  ticks={logTicks}
                  tickFormatter={(v: number) => `${v}x`}
                  width={44}
                />
              ) : (
                <YAxis {...axisProps} width={44} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
              )}
              <Tooltip
                cursor={{ stroke: REF }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as Record<string, number>;
                  return (
                    <TipBox>
                      <div className="text-[11px] text-ink-dim">{label}</div>
                      {series.map((s) => (
                        <div key={s.key} className="tnum mt-0.5 flex justify-between gap-4 text-[12px]">
                          <span style={{ color: s.color === SLATE ? AXIS : s.color }}>{s.label}</span>
                          <span className="font-semibold text-ink">
                            {mode === "growth"
                              ? `${p[s.key].toFixed(2)}x`
                              : `${p[s.key].toFixed(1).replace("-", "−")}%`}
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
/* Realised tail loss against the budget                               */
/* ------------------------------------------------------------------ */

export function RollingES({
  dates,
  series,
  budget,
}: {
  dates: string[];
  series: { key: string; label: string; color: string; width: number; values: number[] }[];
  budget: number;
}) {
  const data = dates.map((d, i) => {
    const row: Record<string, number | string> = { d };
    series.forEach((s) => (row[s.key] = s.values[i] * 100));
    return row;
  });
  const ticks = Array.from(new Set(dates.map((d) => d.slice(0, 4))))
    .filter((y) => Number(y) % 2 === 0)
    .map((y) => dates.find((d) => d.startsWith(y)) as string)
    .filter(Boolean);
  return (
    <Frame
      title="Realised expected shortfall over the past year, measured after the fact"
      height={320}
      caption={
        <>
          The average loss on the worst 2.5% of days in the previous 250 sessions. The dashed line is the{" "}
          {fmtPct(budget)} budget. The budget portfolio stays near it except after the 2020 crash and in 2025;
          60/40 spends long stretches well above it.
        </>
      }
    >
      <div className="flex h-full flex-col">
        <div className="mb-3">
          <Key items={series.map((s) => ({ label: s.label, color: s.color, width: s.width }))} />
        </div>
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <XAxis dataKey="d" {...axisProps} ticks={ticks} tickFormatter={(d: string) => d.slice(0, 4)} />
              <YAxis {...axisProps} width={44} domain={[0.5, 4.5]} tickFormatter={(v: number) => `${v}%`} />
              <ReferenceLine
                y={budget * 100}
                stroke={INK}
                strokeDasharray="5 4"
                label={{ value: "budget", position: "insideBottomRight", fill: AXIS, fontSize: 11 }}
              />
              <Tooltip
                cursor={{ stroke: REF }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as Record<string, number>;
                  return (
                    <TipBox>
                      <div className="text-[11px] text-ink-dim">Year to {label}</div>
                      {series.map((s) => (
                        <div key={s.key} className="tnum mt-0.5 flex justify-between gap-4 text-[12px]">
                          <span style={{ color: s.color }}>{s.label}</span>
                          <span className="font-semibold text-ink">{p[s.key].toFixed(2)}%</span>
                        </div>
                      ))}
                    </TipBox>
                  );
                }}
              />
              {series.map((s) => (
                <Line key={s.key} dataKey={s.key} stroke={s.color} strokeWidth={s.width} dot={false} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* HTML charts: crash returns, and clustering across nine markets      */
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

export function CrashBars({
  title,
  rows,
  a,
  b,
  caption,
}: {
  title: string;
  rows: { key: string; label: string; a: number; b: number }[];
  a: string;
  b: string;
  caption?: React.ReactNode;
}) {
  const lo = Math.min(-0.3, ...rows.flatMap((r) => [r.a, r.b]));
  const hi = Math.max(0.1, ...rows.flatMap((r) => [r.a, r.b]));
  const span = hi - lo;
  const zero = (-lo / span) * 100;
  const bar = (v: number, color: string, lab: string) => (
    <div className="relative h-4" title={`${lab}: ${fmtPct(v, 1, true)}`}>
      <div
        className="absolute top-0 h-4 rounded-sm"
        style={{
          left: `${v < 0 ? zero + (v / span) * 100 : zero}%`,
          width: `${(Math.abs(v) / span) * 100}%`,
          background: color,
        }}
      />
    </div>
  );
  return (
    <Figure title={title} caption={caption}>
      <div className="space-y-4">
        {rows.map((r) => (
          <div key={r.key} className="grid grid-cols-[6.5rem_1fr_4.6rem] items-center gap-x-3 sm:grid-cols-[8rem_1fr_6rem]">
            <div className="text-[12.5px] font-medium text-ink">{r.label}</div>
            <div className="relative space-y-1">
              <div className="absolute inset-y-[-4px] w-px bg-line-strong" style={{ left: `${zero}%` }} aria-hidden />
              {bar(r.a, POS, a)}
              {bar(r.b, "#cbd5e1", b)}
            </div>
            <div className="tnum text-right text-[12px] leading-tight">
              <div className="font-semibold" style={{ color: POS }}>{fmtPct(r.a, 1, true)}</div>
              <div className="text-ink-dim">{fmtPct(r.b, 1, true)}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-4 text-[11.5px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: POS }} /> {a}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#cbd5e1]" /> {b}
        </span>
      </div>
    </Figure>
  );
}

export function ClusteringDumbbell({
  rows,
}: {
  rows: { key: string; label: string; sessions: number; hs: number; garch: number }[];
}) {
  const max = 0.22;
  const x = (v: number) => `${(v / max) * 100}%`;
  return (
    <Figure
      title="After a breach, how often the next day was a breach too (before April 2006)"
      caption={
        <>
          2.5% if breaches are independent (dashed). Every setting is unchanged from the Indian study and none of
          these years was used to build it. Filtering cuts the clustering by more than half everywhere, but never
          to 2.5%.
        </>
      }
    >
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.key} className="grid grid-cols-[1fr] gap-1 sm:grid-cols-[13rem_1fr] sm:items-center sm:gap-3">
            <div className="text-[12.5px] text-ink">
              {r.label}{" "}
              <span className="tnum text-[11px] text-ink-dim">{r.sessions.toLocaleString("en-IN")} days</span>
            </div>
            <div
              className="relative h-5"
              title={`${r.label}: historical simulation ${fmtPct(r.hs)}, filtered ${fmtPct(r.garch)}`}
            >
              <div className="absolute inset-y-0 w-px border-l border-dashed border-ink-dim" style={{ left: x(0.025) }} aria-hidden />
              <div
                className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-line-strong"
                style={{ left: x(Math.min(r.hs, r.garch)), width: `${(Math.abs(r.hs - r.garch) / max) * 100}%` }}
              />
              <div
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-paper"
                style={{ left: x(r.hs), background: NEG }}
              />
              <div
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-paper"
                style={{ left: x(r.garch), background: POS }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4 text-[11.5px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: NEG }} /> Historical simulation
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: POS }} /> Filtered (GARCH)
        </span>
        <span className="tnum text-ink-dim">Scale 0 to 22%</span>
      </div>
    </Figure>
  );
}
