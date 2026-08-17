// Typed access to the model results (scripts/ml/05_generate_signals.py).
//
// A direct JSON import consumed by server components only. There is
// deliberately no API route in front of it: the data is static, it ships in the
// build, and only the display fields a chart actually needs should cross into a
// client component.
//
// Coverage is incomplete by design. Stocks that could not be modelled (too
// little price history, too illiquid, listed too late, delisted mid-window) are
// absent here and listed in data/ml-missing.json with the reason.

import mlJson from "@/data/ml-signals.json";
import workedExampleJson from "@/data/reliance-model-detail.json";

export type MlSignal = "positive" | "negative" | "neutral";

export interface MlRecord {
  mlSignal: MlSignal;
  mlEdge: number; // directional accuracy minus naive baseline
  dirAccuracy: number;
  naiveBaseline: number; // always-predict-up accuracy
  r2Return: number;
  maRatioWeight: number;
  topFeature: string;
  weights: Record<string, number>;
  goldenCrossDays: number;
  deathCrossDays: number;
  testDays: number;
  dataQuality: "full" | "partial";
  marketCapCategory: string;
}

const signals = mlJson as Record<string, MlRecord>;

/** One stock's record, or undefined when it was never modelled. */
export function getMlSignal(id: string): MlRecord | undefined {
  return signals[id];
}

export function getAllMlSignals(): Record<string, MlRecord> {
  return signals;
}

/**
 * One stock's run in full, exported by scripts/ml/04_model.py.
 *
 * Carries all three scorecards - the price model, the naive "tomorrow = today"
 * rule, and the return model - because the point of the worked example is the
 * comparison, not any single number.
 */
export interface ModelScore {
  mae: number;
  rmse: number;
  r2: number;
  dirAccuracy: number;
  naiveDirAccuracy?: number;
  /** Coefficients in the model's own units (rupees for price, fraction for return). */
  featureWeights?: Record<string, number>;
  /**
   * The same coefficients divided by the scale of what the model predicts, so
   * the two models can share an axis. Raw, they differ by ~15,000x purely
   * because one is denominated in rupees and the other in fractions.
   */
  featureWeightsPctOfTarget?: Record<string, number>;
  meanTestClose?: number;
}

/** One test day as the price model saw it: both sides in rupees. */
export interface PriceFitRow {
  date: string;
  actual: number;
  predicted: number;
}

/**
 * One test day as the return model saw it. Carries the post-StandardScaler
 * feature values, since the 3D slice has to plot the inputs in the model's own
 * coordinates rather than in rupees.
 */
export interface ReturnFitRow {
  date: string;
  ma5Scaled: number;
  ma20Scaled: number;
  actualReturn: number;
  predictedReturn: number;
  residual: number;
}

export interface PriceModel extends ModelScore {
  testPeriodData: PriceFitRow[];
}

export interface ReturnModel extends ModelScore {
  testPeriodData: ReturnFitRow[];
}

export interface WorkedExample {
  trainDateRange: { start: string; end: string };
  testDateRange: { start: string; end: string };
  featureWeights: Record<string, number>;
  metrics: {
    r2Return: number;
    dirAccuracy: number;
    naiveBaseline: number;
    edge: number;
    testDays: number;
  };
  priceModel: PriceModel;
  naiveModel: ModelScore;
  returnModel: ReturnModel;
  pricePeriodData: PriceFitRow[];
  testPeriodData: { date: string; actualReturn: number; predictedReturn: number }[];
}

export function getWorkedExample(): WorkedExample {
  return workedExampleJson as WorkedExample;
}

export interface MlSummary {
  total: number;
  positiveEdge: number;
  avgR2: number;
  avgEdge: number;
  avgDirAccuracy: number;
  avgNaive: number;
  avgTestDays: number;
  maRatioPositive: number;
  maRatioNegative: number;
  maRatioTopFeature: number;
  avgAbsMaRatioWeight: number;
  byCap: {
    category: string;
    n: number;
    avgEdge: number;
    avgDirAccuracy: number;
    avgAbsMaRatioWeight: number;
  }[];
}

const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

/** Every headline figure the page quotes, computed at build time. */
export function getMlSummary(): MlSummary {
  const rows = Object.values(signals);

  const byCap = ["Large", "Mid", "Small"]
    .map((category) => {
      const g = rows.filter((r) => r.marketCapCategory === category);
      return {
        category,
        n: g.length,
        avgEdge: mean(g.map((r) => r.mlEdge)),
        avgDirAccuracy: mean(g.map((r) => r.dirAccuracy)),
        avgAbsMaRatioWeight: mean(g.map((r) => Math.abs(r.maRatioWeight))),
      };
    })
    .filter((g) => g.n > 0);

  return {
    total: rows.length,
    positiveEdge: rows.filter((r) => r.mlEdge > 0).length,
    avgR2: mean(rows.map((r) => r.r2Return)),
    avgEdge: mean(rows.map((r) => r.mlEdge)),
    avgDirAccuracy: mean(rows.map((r) => r.dirAccuracy)),
    avgNaive: mean(rows.map((r) => r.naiveBaseline)),
    avgTestDays: mean(rows.map((r) => r.testDays)),
    maRatioPositive: rows.filter((r) => r.maRatioWeight > 0).length,
    maRatioNegative: rows.filter((r) => r.maRatioWeight < 0).length,
    maRatioTopFeature: rows.filter((r) => r.topFeature === "ma_ratio").length,
    avgAbsMaRatioWeight: mean(rows.map((r) => Math.abs(r.maRatioWeight))),
    byCap,
  };
}

/**
 * Standard error of a directional-accuracy figure, treating each test day as a
 * coin flip. Two of these is the band inside which a single stock's edge is
 * indistinguishable from luck - the page needs it to say honestly how much of
 * the ranked table is noise.
 */
export function directionalStandardError(testDays: number): number {
  return testDays > 0 ? 0.5 / Math.sqrt(testDays) : 0;
}
