// Typed access to the CVaR portfolio optimiser's saved output.
//
// The analysis itself lives in its own repository
// (github.com/arjunprashanth6129/cvar-portfolio-optimizer), which owns the
// Python pipeline, the full-resolution data and the figures. What is vendored
// into data/cvar/ here is that pipeline's committed JSON output, so this site
// recomputes nothing and cannot disagree with the source of record.
//
// The only transformation applied on the way in is a weekly downsample of the
// out-of-sample equity curves: the originals carry 2,240 daily points per
// strategy, which is far more than a chart needs and would ship 550 KB to the
// browser for no visible gain.

import portfoliosJson from "@/data/cvar/portfolios.json";
import backtestJson from "@/data/cvar/backtest.json";
import riskJson from "@/data/cvar/risk_table.json";
import scenariosJson from "@/data/cvar/scenarios.json";
import crisisJson from "@/data/cvar/crisis_replay.json";

/** The five allocation strategies, in the order they are presented. */
export const STRATEGIES = [
  "equal_weight",
  "min_variance",
  "max_sharpe",
  "risk_parity",
  "min_cvar",
] as const;
export type Strategy = (typeof STRATEGIES)[number];

/** Buy-and-hold references, shown for contrast and never optimised. */
export const BENCHMARKS = ["BH_nifty", "BH_equal_weight"] as const;
export type SeriesKey = Strategy | (typeof BENCHMARKS)[number];

export const STRATEGY_LABEL: Record<SeriesKey, string> = {
  equal_weight: "Equal weight",
  min_variance: "Min variance",
  max_sharpe: "Max Sharpe",
  risk_parity: "Risk parity",
  min_cvar: "Min CVaR",
  BH_nifty: "Nifty buy and hold",
  BH_equal_weight: "Equal weight, never rebalanced",
};

/** What each strategy actually optimises, and what it needs to be told. */
export const STRATEGY_SPEC: Record<Strategy, { optimises: string; inputs: string }> = {
  equal_weight: { optimises: "nothing", inputs: "none" },
  min_variance: { optimises: "w'Σw", inputs: "covariance" },
  max_sharpe: {
    optimises: "(μ'w - rf) / vol",
    inputs: "covariance and expected returns",
  },
  risk_parity: { optimises: "equal risk contribution", inputs: "covariance" },
  min_cvar: { optimises: "CVaR 95% of daily loss", inputs: "the raw return sample" },
};

export const ASSET_SHORT: Record<string, string> = {
  "NIFTYBEES.NS": "Nifty 50",
  "RELIANCE.NS": "Reliance",
  "HDFCBANK.NS": "HDFC Bank",
  "INFY.NS": "Infosys",
  "GOLDBEES.NS": "Gold (INR)",
  GLD: "Gold (USD)",
  SPY: "S&P 500",
  VT: "World eq.",
  EEM: "EM equity",
  TLT: "US 20y+",
  AGG: "US agg bond",
  "BTC-USD": "Bitcoin",
};

export const ASSET_CLASS: Record<string, string> = {
  "NIFTYBEES.NS": "India equity",
  "RELIANCE.NS": "India equity",
  "HDFCBANK.NS": "India equity",
  "INFY.NS": "India equity",
  "GOLDBEES.NS": "Gold",
  GLD: "Gold",
  SPY: "Global equity",
  VT: "Global equity",
  EEM: "Global equity",
  TLT: "Bonds",
  AGG: "Bonds",
  "BTC-USD": "Crypto",
};

export const CLASS_ORDER = [
  "India equity",
  "Gold",
  "Global equity",
  "Bonds",
  "Crypto",
] as const;

/**
 * Asset colours, by class rather than one flat category each.
 *
 * Twelve separate hues cannot be told apart. The source project used four
 * near-identical teals for its four Indian equity holdings, and they separate by
 * a colour distance of only about 7 units even for a reader with full colour
 * vision, so they read as one block. Here each class gets one clearly separated
 * hue and its members step in lightness within it. Every chart using these also
 * labels its segments or sits beside a table, so colour is never the only
 * channel carrying a value.
 *
 * Lives here rather than in the chart components because the pages compute the
 * mapping during server render and hand it down as a prop.
 */
const CLASS_RAMP: Record<string, string[]> = {
  "India equity": ["#1f8d86", "#2aa8a0", "#45c2ba", "#7ad7d1"],
  Gold: ["#b9862a", "#dcae56"],
  "Global equity": ["#3b6fd4", "#5b95f0", "#8fb8f7"],
  Bonds: ["#7a5cd6", "#a98cf5"],
  Crypto: ["#f2794f"],
};

export function assetColours(assets: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const cls of CLASS_ORDER) {
    const members = assets.filter((a) => ASSET_CLASS[a] === cls);
    const ramp = CLASS_RAMP[cls] ?? ["#7c8aa4"];
    members.forEach((a, i) => {
      out[a] = ramp[Math.min(i, ramp.length - 1)];
    });
  }
  return out;
}

/** Strategy series colours, shared by the charts and the table swatches. */
export const STRATEGY_COLOUR: Record<SeriesKey, string> = {
  equal_weight: "#5b95f0",
  min_variance: "#a98cf5",
  max_sharpe: "#d9a233",
  risk_parity: "#34c9c0",
  min_cvar: "#f2794f",
  BH_nifty: "#5f6b80",
  BH_equal_weight: "#485366",
};

export interface PortfolioStats {
  "exp_return_%": number;
  "geo_return_%": number;
  "ann_vol_%": number;
  sharpe: number;
  "VaR95_%": number;
  "CVaR95_%": number;
  "max_drawdown_%": number;
  n_holdings: number;
}

export interface FrontierPoint {
  "target_return_%": number;
  "ann_return_%": number;
  "cvar95_%": number;
  "ann_vol_%": number;
  "max_drawdown_%": number;
  n_holdings: number;
  weights: Record<string, number>;
}

interface PortfoliosFile {
  meta: {
    assets: string[];
    n_days: number;
    start: string;
    end: string;
    alpha: number;
    risk_free_annual: number;
    base_currency: string;
  };
  portfolios: Record<Strategy, { weights: Record<string, number>; stats: PortfolioStats }>;
  frontier: FrontierPoint[];
}

export interface BacktestMetrics {
  "total_return_%": number;
  "ann_return_%": number;
  "ann_vol_%": number;
  sharpe: number;
  "CVaR95_%": number;
  "max_drawdown_%": number;
  "avg_turnover_%": number;
}

interface BacktestFile {
  meta: {
    train_window: number;
    rebalance: string;
    cost_bps_per_traded_notional: number;
    oos_start: string;
    oos_end: string;
    oos_days: number;
    n_rebalances: number;
  };
  metrics_gross: Record<SeriesKey, BacktestMetrics>;
  metrics_net: Record<SeriesKey, BacktestMetrics>;
  equity_curves_net: Record<SeriesKey, Record<string, number>>;
}

export interface AssetRisk {
  "ann_return_%": number;
  "ann_vol_%": number;
  "VaR95_%": number;
  "CVaR95_%": number;
  "max_drawdown_%": number;
  "CVaR/VaR": number;
}

export interface AssetNormality {
  "CVaR_hist_%": number;
  "CVaR_normal_%": number;
  understated_by_x: number;
  skew: number;
  excess_kurt: number;
  "worst_day_%": number;
}

interface RiskFile {
  meta: { start: string; end: string; n_days: number; alpha: number };
  per_asset: Record<string, AssetRisk>;
  normality: Record<string, AssetNormality>;
}

interface ScenariosFile {
  meta: { n_scenarios: number; block_len: number; assets: string[] };
  student_t_fit: {
    df: number;
    loglik_t: number;
    loglik_normal: number;
    stress_df: number;
    fitted_vol_vs_sample_vol: number;
    crisis_correlation: Record<string, number> | number;
  };
  scenario_set_properties: Record<string, Record<string, number>>;
  min_cvar_reoptimised: {
    weights: Record<string, Record<string, number>>;
    "turnover_vs_historical_%": Record<string, number>;
    "cvar_grid_%": Record<string, Record<string, number>>;
    n_holdings: Record<string, number>;
  };
  stress_test: Record<string, Record<string, number>>;
}

interface CrisisFile {
  episodes: Record<
    string,
    {
      label: string;
      start: string;
      end: string;
      n_days: number;
      contagion_corr: number;
      portfolios: Record<string, Record<string, number>>;
    }
  >;
  headline: Record<
    Strategy,
    {
      "GFC_drop_%": number;
      "GFC_beta3_%": number;
      "COVID_%": number;
      "OOS_maxDD_%": number;
    }
  >;
  currency_effect_lehman?: Record<string, number>;
}

const portfolios = portfoliosJson as unknown as PortfoliosFile;
const backtest = backtestJson as unknown as BacktestFile;
const risk = riskJson as unknown as RiskFile;
const scenarios = scenariosJson as unknown as ScenariosFile;
const crisis = crisisJson as unknown as CrisisFile;

export const getPortfolios = () => portfolios;
export const getBacktest = () => backtest;
export const getRisk = () => risk;
export const getScenarios = () => scenarios;
export const getCrisis = () => crisis;

/** Assets ordered by class, then by their order in the source universe. */
export function assetsByClass(assets: string[]): string[] {
  return [...assets].sort((a, b) => {
    const ca = CLASS_ORDER.indexOf(ASSET_CLASS[a] as (typeof CLASS_ORDER)[number]);
    const cb = CLASS_ORDER.indexOf(ASSET_CLASS[b] as (typeof CLASS_ORDER)[number]);
    return ca !== cb ? ca - cb : assets.indexOf(a) - assets.indexOf(b);
  });
}

/** Headline numbers the page quotes, read from the data rather than typed in. */
export function getCvarHeadline() {
  const net = backtest.metrics_net;
  const ins = portfolios.portfolios;
  const best = (Object.keys(net) as SeriesKey[])
    .filter((k) => (STRATEGIES as readonly string[]).includes(k))
    .reduce((a, b) => (net[b].sharpe > net[a].sharpe ? b : a));
  const shallowest = (STRATEGIES as readonly Strategy[]).reduce((a, b) =>
    net[b]["max_drawdown_%"] < net[a]["max_drawdown_%"] ? b : a,
  );
  const shifts = Object.fromEntries(
    (STRATEGIES as readonly Strategy[]).map((k) => [
      k,
      net[k].sharpe - ins[k].stats.sharpe,
    ]),
  ) as Record<Strategy, number>;
  const worstShift = (STRATEGIES as readonly Strategy[]).reduce((a, b) =>
    shifts[b] < shifts[a] ? b : a,
  );

  return {
    bestSharpe: { key: best as Strategy, value: net[best].sharpe },
    shallowestDrawdown: {
      key: shallowest,
      value: net[shallowest]["max_drawdown_%"],
    },
    gfc: crisis.headline.min_cvar["GFC_drop_%"],
    gfcEqualWeight: crisis.headline.equal_weight["GFC_drop_%"],
    worstShift: { key: worstShift, value: shifts[worstShift] },
    shifts,
  };
}
