// Typed access to the tail-risk budget study (Part II of the CVaR project).
//
// data/cvar/tailrisk.json is written by src/tailrisk/13_site_data.py in the
// cvar-portfolio-optimizer repository from that pipeline's committed output,
// so the page shows exactly the numbers in its results memo and paper.
// Imported by server components; charts receive only the arrays they draw.

import siteJson from "@/data/cvar/tailrisk.json";

export type Period = "development" | "holdout" | "full";
export type Model = "HS" | "NORMAL" | "FHS_EWMA" | "FHS_GARCH" | "EVT";

export interface RuleMetrics {
  annReturn: number;
  vol: number;
  sharpe: number;
  maxDD: number;
  realisedES: number;
  worstMonth: number;
  exposure: number;
  breaches: number;
  turnover: number;
  cost: number;
}

type Rule =
  | "BUDGET_OPT"
  | "BUDGET_HS"
  | "STATIC_60_40"
  | "STATIC_EW"
  | "EW_SCALED"
  | "MATCHED_EW"
  | "RP_SCALED"
  | "MIN_CVAR";

export interface TailRiskSite {
  budget: number;
  alpha: number;
  periods: Record<Period, [string, string]>;
  headline: Record<Period, Record<Rule, RuleMetrics>>;
  ownForecast: Record<Period, Record<"BUDGET_OPT" | "BUDGET_HS", { hitRate: number; pCC: number }>>;
  h2: Record<
    Period,
    {
      esLow: number;
      esHigh: number;
      ddShareSmaller: number;
      lwP: number;
      pEsAbove: number;
      afterBreachP1: number;
      afterBreachP2: number;
    }
  >;
  power: Record<Period, { mde: number; observed: number; years: number; yearsNeeded: number }>;
  forecasts: Record<
    "development" | "holdout",
    Record<
      Model,
      {
        ccPass: number;
        z2Reject: number;
        hitRates: number[];
        fz0: number;
        fz0Diff: number | null;
        fz0HolmP: number | null;
        dqP: number;
        pooledHit: number;
      }
    >
  >;
  portfolios: string[];
  breach: { key: string; label: string; dates: string[]; ret: number[]; hs: number[]; garch: number[] }[];
  growth: { dates: string[] } & Record<"BUDGET_OPT" | "BUDGET_HS" | "STATIC_60_40" | "STATIC_EW", number[]>;
  rollingES: { dates: string[] } & Record<"BUDGET_OPT" | "BUDGET_HS" | "STATIC_60_40", number[]>;
  crises: ({ key: string; from: string; to: string } & Record<
    "BUDGET_OPT" | "BUDGET_HS" | "STATIC_60_40" | "STATIC_EW",
    number
  >)[];
  breakEven: Record<"holdout" | "full", number>;
  replication: {
    series: {
      key: string;
      label: string;
      sessions: number;
      hsHit: number;
      garchHit: number;
      hsAfter: number;
      garchAfter: number;
      evtZ2p: number;
    }[];
    joint: Record<Model, { pooledHit: number; dqP: number; fz0HolmP: number | null; ccPass: number; z2Reject: number }>;
    us: {
      metrics: Record<"unseen" | "overlap" | "all", Record<string, RuleMetrics>>;
      h2: Record<
        "unseen" | "overlap" | "all",
        {
          realisedES: number;
          pEsAbove: number;
          lwP: number;
          mde: number;
          ddShareSmaller: number;
          breachesP1: number;
          breachesP2: number;
          scaledP: number;
        }
      >;
      growth: { dates: string[] } & Record<"BUDGET_OPT" | "BUDGET_HS" | "STATIC_60_40", number[]>;
      crashes: { key: string; from: string; to: string; P1: number; S6040: number }[];
    };
  };
}

export function getTailRisk(): TailRiskSite {
  return siteJson as unknown as TailRiskSite;
}

/** 0.0169 -> "1.69%"; signed adds a "+" to positive values. */
export function pct(x: number, d = 1, signed = false): string {
  const s = (x * 100).toFixed(d);
  return `${signed && x > 0 ? "+" : ""}${s.replace("-", "−")}%`;
}

/** A p-value for prose: "p < 0.001" or "p = 0.033". */
export function pv(p: number | null | undefined, d = 3): string {
  if (p === null || p === undefined) return "";
  return p < 0.001 ? "p < 0.001" : `p = ${p.toFixed(d)}`;
}
