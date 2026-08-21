// Typed access to the pairs-trading backtester's committed output.
//
// The analysis lives in its own repository
// (github.com/arjunprashanth6129/pairs-trading-backtester), which owns the
// pipeline, the tests and the full-resolution artifacts. What is vendored here
// is that pipeline's exported dashboard payload, so this site renders results
// and recomputes nothing.

import payload from "@/data/pairs/dashboard.json";

export interface Meta {
  universe: string[];
  traded: string[];
  benchmark: string;
  start: string;
  end: string;
  oos_start: string;
  oos_end: string;
  n_windows: number;
  formation_months: number;
  trading_months: number;
  entry_z: number;
  exit_z: number;
  stop_z: number;
  max_holding_days: number;
  bps_per_leg: number;
  pvalue_threshold: number;
  max_pairs: number;
  candidate_pairs: number;
}

export interface Perf {
  "total_return_%": number;
  "ann_return_%": number;
  "ann_vol_%": number;
  sharpe: number;
  "max_drawdown_%": number;
  days: number;
}

export interface TradeStats {
  n_trades: number;
  "win_rate_%": number;
  avg_holding_days: number;
  avg_pnl_net: number;
  total_cost: number;
}

export interface Neutrality {
  beta_to_market: number;
  corr_to_market: number;
  r_squared: number;
  overlap_days: number;
}

export interface Summary {
  gross: Perf;
  net: Perf;
  benchmark_universe: Perf;
  benchmark_nifty: Perf;
  trades: TradeStats;
  neutrality_net: Neutrality;
  neutrality_gross: Neutrality;
  selection: {
    pair_windows: number;
    avg_pairs_per_window: number;
    median_pvalue: number | null;
    median_half_life_days: number | null;
    unique_pairs: number;
  };
}

export interface Point {
  d: string;
  v: number;
}
export interface CostRow {
  bps_per_leg: number;
  "ann_return_%": number;
  sharpe: number;
  "max_drawdown_%": number;
}
export interface TopPair {
  pair: string;
  times_selected: number;
  median_pvalue: number;
  median_half_life: number;
}
export interface ExampleTrade {
  entry: string;
  exit: string;
  side: string;
  entry_z: number;
  exit_z: number;
  reason: string;
  pnl_net: number;
}
export interface Example {
  pair: string;
  y: string;
  x: string;
  beta: number;
  pvalue: number;
  half_life: number;
  mean: number;
  std: number;
  window: number;
  series: { d: string; spread: number; z: number }[];
  trades: ExampleTrade[];
}

interface Payload {
  meta: Meta;
  summary: Summary;
  equity: {
    gross: Point[];
    net: Point[];
    benchmark: Point[];
    drawdown_net: Point[];
  };
  cost_sensitivity: CostRow[];
  trades_by_reason: Record<string, number>;
  top_pairs: TopPair[];
  example: Example | null;
}

const d = payload as unknown as Payload;

export const getPairsMeta = () => d.meta;
export const getPairsSummary = () => d.summary;
export const getPairsEquity = () => d.equity;
export const getCostSensitivity = () => d.cost_sensitivity;
export const getTradesByReason = () => d.trades_by_reason;
export const getTopPairs = () => d.top_pairs;
export const getExamplePair = () => d.example;

/**
 * Where the cost curve crosses zero, interpolated between the two grid points
 * that straddle it. This is the project's headline number, so it is derived
 * from the committed grid rather than typed in.
 */
export function breakEvenBps(): number | null {
  const rows = [...d.cost_sensitivity].sort(
    (a, b) => a.bps_per_leg - b.bps_per_leg,
  );
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    if (a["ann_return_%"] >= 0 && b["ann_return_%"] <= 0) {
      const span = a["ann_return_%"] - b["ann_return_%"];
      if (span === 0) return a.bps_per_leg;
      return (
        a.bps_per_leg +
        ((b.bps_per_leg - a.bps_per_leg) * a["ann_return_%"]) / span
      );
    }
  }
  return null;
}
