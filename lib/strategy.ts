// Typed access to the monthly strategy's results (scripts/strategy/08_site_data.py).
//
// The file holds display fields only, copied from the outputs the strategy
// pipeline committed, so the page shows exactly the numbers in the results
// memo and the paper. Imported by server components; charts receive only the
// arrays they draw.

import siteJson from "@/data/strategy/site.json";

export type Period = "development" | "holdout" | "full";

export interface Headline {
  cagr: number;
  sharpe: number;
  maxDrawdown: number;
  ewCagr: number;
  ewSharpe: number;
  ewMaxDrawdown: number;
  nifty500Cagr: number;
  nifty500Sharpe: number;
  nifty500MaxDrawdown: number;
  mom50Cagr?: number;
  mom50Sharpe?: number;
  mom50MaxDrawdown?: number;
  activeReturn: number;
  activeT: number;
  alpha: number;
  alphaT: number;
  dsr: number;
  costDrag: number;
  turnover: number;
  breakEven: number;
  names: number;
}

export interface StrategySite {
  periods: Record<Period, [string, string]>;
  headline: { pit: Record<Period, Headline>; survivor: Record<Period, Headline> };
  growth: {
    months: string[];
    pit: { strategy: number[]; ew: number[]; nifty500: number[]; mom50: number[] };
    survivor: { strategy: number[]; ew: number[] };
  };
  survivorship: {
    key: string;
    label: string;
    cagr: number;
    ewCagr: number;
    activeReturn: number;
    activeT: number;
    ewVsIndex: number;
  }[];
  signals: { key: string; label: string; t: number; selected: boolean; tNse: number }[];
  random: { edges: number[]; counts: number[]; strategy: number; p95: number; n: number };
  skill: Record<Period, { ic: number; icT: number; randomPct: number; placeboPct: number; canary: number }>;
  factors: { activeAlpha: number; activeAlphaT: number; activeWml: number; wmlCorr: number };
  terciles: { label: string; alpha: number; alphaT: number; active: number; activeT: number }[];
  universeSize: { label: string; active: number; activeT: number }[];
  byYear: { year: string; strategy: number; ew: number }[];
  costs: { mult: number; active: number }[];
  quintiles: number[];
  data: { stocksEver: number; perMonth: number; yahooWithin1pct: number; exitsInUniverse: number };
}

export function getStrategy(): StrategySite {
  return siteJson as unknown as StrategySite;
}

/** 0.2385 -> "23.8%"; signed adds a "+" to positive values. */
export function pct(x: number, d = 1, signed = false): string {
  const s = (x * 100).toFixed(d);
  return `${signed && x > 0 ? "+" : ""}${s.replace("-", "−")}%`;
}
