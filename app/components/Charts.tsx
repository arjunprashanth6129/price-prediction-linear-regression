"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { useMounted } from "./useMounted";

// Recharts takes real colour values, not Tailwind classes, so the theme tokens
// are mirrored here. Keep in step with app/globals.css.
//
// POS and NEG are blue and amber rather than green and red. Nearly every chart
// in this file encodes a polarity, and green against red separates by a colour
// distance of only about 3.5 under deuteranopia, so roughly one man in twelve
// cannot tell the two bar colours apart. Blue against amber separates by about
// 25 in the worst case, and polarity is additionally carried by position in
// every one of these charts.
const POS = "#2563eb";
const NEG = "#b45309";
const AXIS = "#64748b";
const GRID = "#e2e8f0";
const REF = "#cbd5e1";
const SURFACE = "#ffffff";

const axisProps = {
  stroke: GRID,
  tick: { fill: AXIS, fontSize: 11 },
  tickLine: false,
} as const;

/** Reserve the final height so hydration never shifts the page. */
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
    <figure className="my-6 rounded-xl border border-line bg-surface p-4 sm:p-5">
      <figcaption className="mb-4 text-[13px] font-medium text-ink">
        {title}
      </figcaption>
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

/* ------------------------------------------------------------------ */
/* 1. R2 distribution                                                  */
/* ------------------------------------------------------------------ */

export interface R2Bucket {
  bucket: string;
  count: number;
  positive: boolean;
}

export function R2Histogram({
  data,
  aboveZero,
  total,
}: {
  data: R2Bucket[];
  aboveZero: number;
  total: number;
}) {
  return (
    <Frame
      title={`R² distribution across ${total} stocks`}
      height={300}
      caption={
        <>
          <strong className="font-semibold text-ink">
            {aboveZero} of {total}
          </strong>{" "}
          stocks achieved R² above zero. Everything left of the marked line
          predicted next-day returns worse than simply guessing the average.
        </>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 28, right: 8, bottom: 4, left: 0 }}>
          {/* Five categories inside a 375px viewport leaves ~65px each, so the
              tick font drops a step to keep the bucket labels from colliding. */}
          <XAxis
            dataKey="bucket"
            {...axisProps}
            interval={0}
            tick={{ fill: AXIS, fontSize: 9.5 }}
          />
          <YAxis
            {...axisProps}
            allowDecimals={false}
            label={{
              value: "Stocks",
              angle: -90,
              position: "insideLeft",
              fill: AXIS,
              fontSize: 11,
            }}
          />
          <Tooltip
            cursor={{ fill: "rgba(15,23,42,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as R2Bucket;
              return (
                <TipBox>
                  <div className="text-[11px] text-ink-dim">R² {d.bucket}</div>
                  <div className="tnum mt-0.5 text-sm font-semibold text-ink">
                    {d.count} {d.count === 1 ? "stock" : "stocks"}
                  </div>
                </TipBox>
              );
            }}
          />
          {/* Boundary between "worse than the mean" and "better". The full
              sentence lives in the caption - a long label overflows at 375px. */}
          <ReferenceLine
            x="-0.01 to 0"
            stroke={REF}
            strokeDasharray="4 4"
            label={{
              value: "R² = 0",
              position: "top",
              fill: AXIS,
              fontSize: 10,
            }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={78}>
            {data.map((d) => (
              <Cell key={d.bucket} fill={d.positive ? POS : NEG} />
            ))}
            <LabelList
              dataKey="count"
              position="top"
              fill={AXIS}
              fontSize={11}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Model vs naive baseline scatter                                  */
/* ------------------------------------------------------------------ */

export interface ScatterPoint {
  ticker: string;
  name: string;
  naive: number; // percent
  model: number; // percent
  edge: number; // percent
  r2: number;
  maRatioWeight: number;
  topFeature: string;
  beats: boolean;
}

const DOMAIN: [number, number] = [35, 70];

export function AccuracyScatter({
  data,
  above,
  below,
}: {
  data: ScatterPoint[];
  above: number;
  below: number;
}) {
  const [picked, setPicked] = useState<ScatterPoint | null>(null);

  return (
    <>
      <Frame
        title="Model vs naive baseline - one dot per stock"
        height={340}
        caption={
          <>
            <span className="text-accent">{above} stocks above baseline</span>
            {" · "}
            <span className="text-[#b45309]">{below} stocks below baseline</span>. Any
            dot under the diagonal is a stock where always guessing “up” beat the
            model. Click a dot for that stock&apos;s full metrics.
          </>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 12, bottom: 28, left: 4 }}>
            <XAxis
              type="number"
              dataKey="naive"
              domain={DOMAIN}
              ticks={[35, 40, 45, 50, 55, 60, 65, 70]}
              {...axisProps}
              label={{
                value: "Naive baseline accuracy (%)",
                position: "insideBottom",
                offset: -16,
                fill: AXIS,
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              dataKey="model"
              domain={DOMAIN}
              ticks={[35, 40, 45, 50, 55, 60, 65, 70]}
              {...axisProps}
              label={{
                value: "Model accuracy (%)",
                angle: -90,
                position: "insideLeft",
                offset: 12,
                fill: AXIS,
                fontSize: 11,
              }}
            />
            <ZAxis range={[46, 46]} />
            {/* y = x: the model exactly matching the naive baseline. */}
            <ReferenceLine
              segment={[
                { x: DOMAIN[0], y: DOMAIN[0] },
                { x: DOMAIN[1], y: DOMAIN[1] },
              ]}
              stroke={REF}
              strokeDasharray="5 5"
              label={{
                value: "model = naive baseline",
                position: "insideTopLeft",
                fill: AXIS,
                fontSize: 10,
              }}
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: REF }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as ScatterPoint;
                return (
                  <TipBox>
                    <div className="text-[12px] font-semibold text-ink">
                      {d.ticker}
                    </div>
                    <div className="mt-1 space-y-0.5 text-[11px]">
                      <div className="text-ink-muted">
                        Model:{" "}
                        <span className="tnum text-ink">
                          {d.model.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-ink-muted">
                        Naive:{" "}
                        <span className="tnum text-ink">
                          {d.naive.toFixed(1)}%
                        </span>
                      </div>
                      <div className={d.beats ? "text-accent" : "text-[#b45309]"}>
                        Edge: {d.edge >= 0 ? "+" : ""}
                        {d.edge.toFixed(1)} pts
                      </div>
                    </div>
                  </TipBox>
                );
              }}
            />
            <Scatter
              data={data}
              onClick={(p: unknown) => setPicked(p as ScatterPoint)}
              className="cursor-pointer"
            >
              {data.map((d) => (
                <Cell
                  key={d.ticker}
                  fill={d.beats ? POS : NEG}
                  fillOpacity={0.75}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </Frame>

      {picked && <StockModal point={picked} onClose={() => setPicked(null)} />}
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-line/60 py-2 first:border-t-0">
      <span className="text-[12px] text-ink-muted">{label}</span>
      <span className="tnum text-[13px] font-medium text-ink">{value}</span>
    </div>
  );
}

function StockModal({
  point: p,
  onClose,
}: {
  point: ScatterPoint;
  onClose: () => void;
}) {
  // The close button is labelled Esc, so the key has to actually work.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${p.ticker} model metrics`}
      className="fixed inset-0 z-50 grid place-items-center bg-ink/25 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-line-strong bg-surface-2 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[15px] font-semibold text-ink">{p.ticker}</div>
            <div className="text-[12px] text-ink-dim">{p.name}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md border border-line px-2 py-1 text-[12px] text-ink-muted transition-colors duration-200 hover:border-line-strong hover:text-ink"
          >
            Esc
          </button>
        </div>

        <div className="mt-4">
          <Row label="Model directional accuracy" value={`${p.model.toFixed(1)}%`} />
          <Row label="Naive baseline" value={`${p.naive.toFixed(1)}%`} />
          <Row
            label="Edge"
            value={
              <span className={p.beats ? "text-accent" : "text-[#b45309]"}>
                {p.edge >= 0 ? "+" : ""}
                {p.edge.toFixed(1)} pts
              </span>
            }
          />
          <Row label="R² on returns" value={p.r2.toFixed(4)} />
          <Row label="MA ratio weight" value={p.maRatioWeight.toFixed(5)} />
          <Row label="Largest weight" value={p.topFeature} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. MA ratio coefficient sign                                        */
/* ------------------------------------------------------------------ */

export function MaRatioSigns({
  positive,
  negative,
  total,
}: {
  positive: number;
  negative: number;
  total: number;
}) {
  const data = [
    { label: "Positive weight", count: positive, positive: true },
    { label: "Negative weight", count: negative, positive: false },
  ];
  const majority = positive >= negative ? positive : negative;
  const share = Math.round((majority / total) * 100);
  const leaning = positive >= negative ? "higher" : "lower";

  return (
    <Frame
      title={`MA ratio (golden cross) coefficient direction across ${total} stocks`}
      height={280}
      caption={
        <>
          {share}% of fits lean one way - golden cross territory nudging the
          prediction {leaning} - and the rest lean the other. A signal carrying
          real information would point the same way for most stocks and would
          earn a meaningful weight; this one splits and its average weight is
          near zero. The signal is real and easy to compute. The edge is not
          there.
        </>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 24, right: 8, bottom: 20, left: 0 }}>
          <XAxis
            dataKey="label"
            {...axisProps}
            interval={0}
            label={{
              value: "Coefficient direction",
              position: "insideBottom",
              offset: -12,
              fill: AXIS,
              fontSize: 11,
            }}
          />
          <YAxis
            {...axisProps}
            allowDecimals={false}
            label={{
              value: "Number of stocks",
              angle: -90,
              position: "insideLeft",
              fill: AXIS,
              fontSize: 11,
            }}
          />
          <Tooltip
            cursor={{ fill: "rgba(15,23,42,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof data)[number];
              return (
                <TipBox>
                  <div className="text-[11px] text-ink-dim">{d.label}</div>
                  <div className="tnum mt-0.5 text-sm font-semibold text-ink">
                    {d.count} stocks
                  </div>
                </TipBox>
              );
            }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={120}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.positive ? POS : NEG} />
            ))}
            <LabelList
              dataKey="count"
              position="top"
              fill={AXIS}
              fontSize={12}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Worked example: the price model that looks right and isn't       */
/* ------------------------------------------------------------------ */

export interface FitPoint {
  date: string;
  actual: number;
  predicted: number;
}

const ACCENT = "#4d8dff";
const ORANGE = "#eb6834";

export function PriceFit({ data, span }: { data: FitPoint[]; span: string }) {
  // Month ticks only - 347 daily labels would be unreadable.
  const ticks = (() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const d of data) {
      const key = d.date.slice(0, 7);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(d.date);
      }
    }
    return out.filter((_, i) => i % 3 === 0);
  })();

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });

  return (
    <Frame
      title={`RELIANCE - actual vs predicted close, test set ${span}`}
      height={320}
      caption={
        <>
          This is the chart that looks like success. The prediction tracks the
          real price so closely the two lines are hard to separate - and it is
          worthless, because the model is mostly reporting yesterday&apos;s
          price back at you. The table above is what settles it.
        </>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 22, left: 4 }}>
          <XAxis
            dataKey="date"
            ticks={ticks}
            tickFormatter={fmt}
            {...axisProps}
          />
          <YAxis
            {...axisProps}
            domain={["dataMin - 30", "dataMax + 30"]}
            tickFormatter={(v: number) => `₹${Math.round(v)}`}
            width={54}
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3", stroke: REF }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as FitPoint;
              return (
                <TipBox>
                  <div className="text-[11px] text-ink-dim">{fmt(d.date)}</div>
                  <div className="tnum mt-0.5 text-[12px]" style={{ color: ACCENT }}>
                    actual ₹{d.actual.toFixed(2)}
                  </div>
                  <div className="tnum text-[12px]" style={{ color: ORANGE }}>
                    predicted ₹{d.predicted.toFixed(2)}
                  </div>
                </TipBox>
              );
            }}
          />
          <Legend
            verticalAlign="top"
            align="left"
            height={26}
            iconType="plainline"
            wrapperStyle={{ fontSize: 11, color: AXIS }}
          />
          <Line
            type="monotone"
            dataKey="actual"
            name="Actual"
            stroke={ACCENT}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="predicted"
            name="Predicted"
            stroke={ORANGE}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* 6. Worked example: the return model that looks wrong and isn't      */
/* ------------------------------------------------------------------ */

export interface ReturnFitPoint {
  date: string;
  actualReturn: number;
  predictedReturn: number;
}

export function ReturnFit({
  data,
  span,
}: {
  data: ReturnFitPoint[];
  span: string;
}) {
  const ticks = (() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const d of data) {
      const key = d.date.slice(0, 7);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(d.date);
      }
    }
    return out.filter((_, i) => i % 3 === 0);
  })();

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

  return (
    <Frame
      title={`RELIANCE - actual vs predicted daily return, test set ${span}`}
      height={320}
      caption={
        <>
          The orange line predicts almost exactly zero, every day. That is not a
          broken model - it is a correct one with nothing to work with. When
          features carry no reliable signal, the best a linear fit can do is
          return the average of what it was trained on, and the average daily
          move of a stock is approximately nothing. The flat line is the model
          saying so.
        </>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 22, left: 4 }}>
          <XAxis
            dataKey="date"
            ticks={ticks}
            tickFormatter={fmt}
            {...axisProps}
          />
          <YAxis
            {...axisProps}
            domain={[-0.06, 0.06]}
            ticks={[-0.06, -0.04, -0.02, 0, 0.02, 0.04, 0.06]}
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            width={44}
          />
          <ReferenceLine y={0} stroke={REF} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3", stroke: REF }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as ReturnFitPoint;
              return (
                <TipBox>
                  <div className="text-[11px] text-ink-dim">{fmt(d.date)}</div>
                  <div className="tnum mt-0.5 text-[12px]" style={{ color: ACCENT }}>
                    actual {pct(d.actualReturn)}
                  </div>
                  <div className="tnum text-[12px]" style={{ color: ORANGE }}>
                    predicted {pct(d.predictedReturn)}
                  </div>
                </TipBox>
              );
            }}
          />
          <Legend
            verticalAlign="top"
            align="left"
            height={26}
            iconType="plainline"
            wrapperStyle={{ fontSize: 11, color: AXIS }}
          />
          <Line
            type="monotone"
            dataKey="actualReturn"
            name="Actual"
            stroke={ACCENT}
            strokeWidth={1.6}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="predictedReturn"
            name="Predicted"
            stroke={ORANGE}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* 8. Predicted against actual                                         */
/* ------------------------------------------------------------------ */

export interface FitScatterPoint {
  date: string;
  predicted: number;
  actual: number;
}

/**
 * A parity plot. Both axes take the SAME domain, which is what makes the
 * reference line a true 45 degrees - give each axis its own range and the
 * "diagonal" becomes a lie about how close the predictions are.
 */
export function ParityScatter({
  title,
  data,
  domain,
  unit,
  caption,
}: {
  title: string;
  data: FitScatterPoint[];
  domain: [number, number];
  unit: "rupees" | "percent";
  caption: React.ReactNode;
}) {
  const fmt = (v: number) =>
    unit === "rupees" ? `₹${v.toFixed(0)}` : `${v.toFixed(2)}%`;
  const axisLabel = unit === "rupees" ? "(₹)" : "return (%)";

  return (
    <Frame title={title} height={300} caption={caption}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 14, bottom: 26, left: 4 }}>
          <XAxis
            type="number"
            dataKey="predicted"
            domain={domain}
            {...axisProps}
            tickFormatter={(v: number) => (unit === "rupees" ? `${v}` : `${v}`)}
            label={{
              value: `Predicted ${axisLabel}`,
              position: "insideBottom",
              offset: -16,
              fill: AXIS,
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            dataKey="actual"
            domain={domain}
            {...axisProps}
            width={unit === "rupees" ? 46 : 40}
            label={{
              value: `Actual ${axisLabel}`,
              angle: -90,
              position: "insideLeft",
              offset: 10,
              fill: AXIS,
              fontSize: 11,
            }}
          />
          <ZAxis range={[26, 26]} />
          <ReferenceLine
            segment={[
              { x: domain[0], y: domain[0] },
              { x: domain[1], y: domain[1] },
            ]}
            stroke={REF}
            strokeDasharray="5 5"
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3", stroke: REF }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as FitScatterPoint;
              const resid = d.actual - d.predicted;
              return (
                <TipBox>
                  <div className="text-[11px] text-ink-dim">{d.date}</div>
                  <div className="tnum mt-0.5 text-[11px] text-ink-muted">
                    predicted {fmt(d.predicted)}
                  </div>
                  <div className="tnum text-[11px] text-ink-muted">
                    actual {fmt(d.actual)}
                  </div>
                  <div
                    className={`tnum text-[11px] ${
                      Math.abs(resid) > 0 ? "text-ink" : "text-ink-dim"
                    }`}
                  >
                    residual {resid >= 0 ? "+" : ""}
                    {fmt(resid)}
                  </div>
                </TipBox>
              );
            }}
          />
          <Scatter data={data} fill={ACCENT} fillOpacity={0.5} />
        </ScatterChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* 9. Residuals over time                                              */
/* ------------------------------------------------------------------ */

export interface ResidualPoint {
  date: string;
  residual: number; // percent
  t: number; // day index, for a numeric x axis
}

export function ResidualPlot({
  data,
  span,
}: {
  data: ResidualPoint[];
  span: string;
}) {
  const worst = Math.max(...data.map((d) => Math.abs(d.residual)));
  const bound = Math.ceil(worst);

  // Bigger misses read darker. Colour is redundant with vertical position
  // here, so it is emphasis rather than the only channel carrying the value.
  const shade = (r: number) => {
    const t = Math.min(Math.abs(r) / (worst || 1), 1);
    return `rgba(180, 83, 9, ${0.25 + 0.65 * t})`;
  };

  return (
    <Frame
      title={`The errors, day by day - residuals, test set ${span}`}
      height={290}
      caption={
        <>
          A residual is what the model missed by: actual minus predicted. A
          model with real signal leaves small residuals scattered evenly around
          zero with no shape to them. These span the entire range of daily
          moves, because the prediction was near zero every day - so the errors
          are essentially the returns themselves. Lay this over the raw return
          series and you would struggle to tell them apart, which is what a
          model that learned nothing looks like.
        </>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 14, bottom: 26, left: 4 }}>
          <XAxis
            type="number"
            dataKey="t"
            domain={[0, data.length - 1]}
            {...axisProps}
            ticks={data
              .filter((_, i) => i % Math.ceil(data.length / 6) === 0)
              .map((d) => d.t)}
            tickFormatter={(v: number) =>
              new Date(data[Math.round(v)]?.date ?? "").toLocaleDateString(
                "en-GB",
                { month: "short", year: "2-digit" },
              )
            }
          />
          <YAxis
            type="number"
            dataKey="residual"
            domain={[-bound, bound]}
            {...axisProps}
            width={44}
            tickFormatter={(v: number) => `${v}%`}
            label={{
              value: "Residual (%)",
              angle: -90,
              position: "insideLeft",
              offset: 10,
              fill: AXIS,
              fontSize: 11,
            }}
          />
          <ZAxis range={[24, 24]} />
          <ReferenceLine y={0} stroke={AXIS} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3", stroke: REF }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as ResidualPoint;
              return (
                <TipBox>
                  <div className="text-[11px] text-ink-dim">{d.date}</div>
                  <div className="tnum mt-0.5 text-[12px] text-ink">
                    missed by {d.residual >= 0 ? "+" : ""}
                    {d.residual.toFixed(2)}%
                  </div>
                </TipBox>
              );
            }}
          />
          <Scatter data={data}>
            {data.map((d) => (
              <Cell key={d.date} fill={shade(d.residual)} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* 7. Feature weights, both models, on one shared axis                 */
/* ------------------------------------------------------------------ */

export interface WeightBar {
  feature: string;
  /** The coefficient itself, plotted and labelled. */
  value: number;
}

export function WeightBars({
  title,
  data,
  domain,
  rawUnit,
  caption,
}: {
  title: string;
  data: WeightBar[];
  domain: [number, number];
  rawUnit: "rupees" | "fraction";
  caption: React.ReactNode;
}) {
  const label = (v: number) =>
    rawUnit === "rupees" ? `₹${v.toFixed(1)}` : v.toFixed(4);

  return (
    <Frame title={title} height={230} caption={caption}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 62, bottom: 22, left: 4 }}
        >
          {/* domain is passed in identically to both charts - letting recharts
              auto-scale would rescale the return model's tiny coefficients up
              to full width and destroy the whole comparison. */}
          <XAxis
            type="number"
            domain={domain}
            allowDataOverflow
            {...axisProps}
            tickFormatter={(v: number) => `${v}`}
            label={{
              value: "coefficient",
              position: "insideBottom",
              offset: -14,
              fill: AXIS,
              fontSize: 10,
            }}
          />
          <YAxis
            type="category"
            dataKey="feature"
            {...axisProps}
            width={62}
            tick={{ fill: AXIS, fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: "rgba(15,23,42,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as WeightBar;
              return (
                <TipBox>
                  <div className="text-[12px] font-semibold text-ink">
                    {d.feature}
                  </div>
                  <div className="tnum mt-0.5 text-[11px] text-ink-muted">
                    coefficient {label(d.value)}
                  </div>
                </TipBox>
              );
            }}
          />
          <ReferenceLine x={0} stroke={REF} />
          <Bar dataKey="value" isAnimationActive={false} barSize={18}>
            {data.map((d) => (
              <Cell key={d.feature} fill={d.value >= 0 ? POS : NEG} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              fill={AXIS}
              fontSize={10}
              formatter={(v: React.ReactNode) => label(Number(v))}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Per-stock edge, ranked                                           */
/* ------------------------------------------------------------------ */

export interface EdgeBar {
  rank: number;
  ticker: string;
  edge: number; // percentage points
}

export function EdgeRanked({
  data,
  negative,
  total,
  avgTestDays,
  noiseBand,
}: {
  data: EdgeBar[];
  negative: number;
  total: number;
  /** Mean test-set length, quoted in the caption rather than hard-coded. */
  avgTestDays: number;
  /** Two standard errors, in percentage points - the band that is pure chance. */
  noiseBand: number;
}) {
  return (
    <Frame
      title="Directional edge per stock - sorted ascending"
      height={520}
      caption={
        <>
          <strong className="font-semibold text-ink">
            {negative} of {total}
          </strong>{" "}
          stocks showed negative edge. The green bars do not survive significance
          testing at this sample size: with about {avgTestDays} test days per
          stock, anything inside roughly {noiseBand.toFixed(0)} points either way
          is what chance alone produces.
        </>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 12, bottom: 24, left: 4 }}
          barCategoryGap={0}
        >
          <XAxis
            type="number"
            {...axisProps}
            domain={[-30, 30]}
            ticks={[-30, -20, -10, 0, 10, 20, 30]}
            tickFormatter={(v: number) => `${v}`}
            label={{
              value: "Directional edge (percentage points)",
              position: "insideBottom",
              offset: -14,
              fill: AXIS,
              fontSize: 11,
            }}
          />
          <YAxis
            type="category"
            dataKey="rank"
            {...axisProps}
            width={30}
            interval={11}
            tickFormatter={(v: number) => `${v}`}
          />
          <Tooltip
            cursor={{ fill: "rgba(15,23,42,0.05)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as EdgeBar;
              return (
                <TipBox>
                  <div className="text-[12px] font-semibold text-ink">
                    {d.ticker}
                  </div>
                  <div
                    className={`tnum mt-0.5 text-[12px] ${
                      d.edge > 0 ? "text-accent" : "text-[#b45309]"
                    }`}
                  >
                    {d.edge >= 0 ? "+" : ""}
                    {d.edge.toFixed(1)} pts edge
                  </div>
                </TipBox>
              );
            }}
          />
          <ReferenceLine x={0} stroke={REF} />
          <Bar dataKey="edge" isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.ticker} fill={d.edge > 0 ? POS : NEG} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* 10. Accuracy and edge by market cap                                 */
/* ------------------------------------------------------------------ */

export interface CapRow {
  category: string;
  n: number;
  accuracy: number;
  baseline: number;
  edge: number;
}

/**
 * Accuracy by size band, drawn as a dumbbell rather than paired bars.
 *
 * The interesting range is 46 to 51%, and bars over that range would need a
 * truncated baseline, which breaks the "length is the value" contract a bar
 * makes and turns a two-point gap into an apparent doubling. Dots carry
 * position rather than length, so a non-zero scale is honest, and the
 * connecting segment is the edge itself.
 */
export function CapBreakdown({ data }: { data: CapRow[] }) {
  const lo = Math.min(...data.map((d) => d.baseline)) - 1.2;
  const hi = Math.max(...data.map((d) => d.accuracy), 50) + 1.2;

  return (
    <Frame
      title="Directional accuracy by market-cap band"
      height={300}
      caption={
        <>
          The hollow mark is the always-up baseline, the filled mark is the
          model, and the segment between them is the edge. Small caps show the
          largest edge, which is the direction the momentum literature predicts,
          but their model accuracy is identical to the large caps. The whole
          difference comes from the small-cap baseline being weaker, not from the
          model performing better on them.
        </>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 60, bottom: 26, left: 4 }}
        >
          <XAxis
            type="number"
            domain={[lo, hi]}
            {...axisProps}
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            label={{
              value: "Directional accuracy (%)",
              position: "insideBottom",
              offset: -16,
              fill: AXIS,
              fontSize: 11,
            }}
          />
          <YAxis
            type="category"
            dataKey="category"
            {...axisProps}
            width={96}
            tick={{ fill: AXIS, fontSize: 11 }}
            tickFormatter={(v: string) => {
              const row = data.find((d) => d.category === v);
              return row ? `${v} (n=${row.n})` : v;
            }}
          />
          <Tooltip
            cursor={{ fill: "rgba(15,23,42,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as CapRow;
              return (
                <TipBox>
                  <div className="text-[12px] font-semibold text-ink">
                    {d.category} caps · {d.n} stocks
                  </div>
                  <div className="mt-1 space-y-0.5 text-[11px] text-ink-muted">
                    <div>
                      model{" "}
                      <span className="tnum text-ink">
                        {d.accuracy.toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      baseline{" "}
                      <span className="tnum text-ink">
                        {d.baseline.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-accent">
                      edge {d.edge >= 0 ? "+" : ""}
                      {d.edge.toFixed(2)} pts
                    </div>
                  </div>
                </TipBox>
              );
            }}
          />
          {/* A coin flip, the number both bands should be read against first. */}
          <ReferenceLine
            x={50}
            stroke={AXIS}
            strokeDasharray="4 4"
            label={{
              value: "coin flip",
              position: "top",
              fill: AXIS,
              fontSize: 10,
            }}
          />
          <Bar
            dataKey={(d: CapRow) => [d.baseline, d.accuracy]}
            barSize={5}
            fill={REF}
            isAnimationActive={false}
          />
          <Scatter dataKey="baseline" shape={<CapHollow />} isAnimationActive={false} />
          <Scatter dataKey="accuracy" shape={<CapSolid />} isAnimationActive={false}>
            <LabelList
              dataKey="edge"
              position="right"
              fill={AXIS}
              fontSize={10.5}
              formatter={(v: React.ReactNode) =>
                `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(2)} pts`
              }
            />
          </Scatter>
        </ComposedChart>
      </ResponsiveContainer>
    </Frame>
  );
}

function CapHollow(props: { cx?: number; cy?: number }) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={5} fill={SURFACE} stroke={NEG} strokeWidth={2} />;
}

function CapSolid(props: { cx?: number; cy?: number }) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={5.5} fill={POS} />;
}
