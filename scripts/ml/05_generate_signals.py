#!/usr/bin/env python3
"""Stage 5: run the return model across the whole universe.

For every ticker: engineer features -> chronological split -> scale on train
only -> LinearRegression on tomorrow's return -> evaluate against an
always-guess-up baseline.

Only the RETURN model runs here. Stage 4 settled the price model: it scores well
by exploiting the fact prices barely move overnight, and still loses to a
"tomorrow = today" baseline. Directional accuracy against the always-up baseline
is the metric that carries information.

Prices come from raw_prices.csv rather than re-fetching per ticker -
01_fetch_data.py already pulled them in one batch with auto_adjust=True, and one
batch request is far kinder to Yahoo than 100 sequential ones. It also makes
this stage deterministic: re-running it reproduces the published numbers
exactly, with no network involved.

Every figure in the summary below is computed from the results rather than typed
in, so the write-up cannot drift from the data when the window changes.

Outputs:
    data/ml-signals.json            per-ticker results
    data/ml-missing.json            skipped tickers, reasons, available range
    results/full_analysis.txt       the printed summary
    results/per-stock.csv           the same table, machine-readable

    python3 scripts/ml/05_generate_signals.py
"""
import csv
import json
import traceback

import numpy as np
import pandas as pd

from pathlib import Path
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score
from sklearn.preprocessing import StandardScaler

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
CSV_IN = HERE / "raw_prices.csv"
UNIVERSE = ROOT / "data" / "universe.json"
CAPS = ROOT / "data" / "market-caps.json"
SIGNALS_OUT = ROOT / "data" / "ml-signals.json"
MISSING_OUT = ROOT / "data" / "ml-missing.json"
ANALYSIS_OUT = ROOT / "results" / "full_analysis.txt"
TABLE_OUT = ROOT / "results" / "per-stock.csv"

FEATURES = ["ma5", "ma20", "ret", "ma_ratio"]
TRAIN_FRAC = 0.8

MIN_ROWS = 100
MAX_MISSING_FRAC = 0.05


# ----------------------------------------------------------------------
# Features and model
# ----------------------------------------------------------------------
def build_features(close: pd.Series) -> pd.DataFrame:
    f = pd.DataFrame({"close": close})
    f["ma5"] = close.rolling(window=5).mean()
    f["ma20"] = close.rolling(window=20).mean()
    f["ret"] = close.pct_change()
    f["ma_ratio"] = f["ma5"] / f["ma20"]
    f["target"] = close.shift(-1)
    f["ret_target"] = f["target"] / f["close"] - 1
    return f.dropna()


def run_model(close: pd.Series) -> dict:
    """Fit and evaluate one ticker's return model."""
    feats = build_features(close)
    if len(feats) < MIN_ROWS:
        raise ValueError(f"only {len(feats)} rows after features "
                         f"(need {MIN_ROWS})")

    # Chronological split - never shuffled. Shuffling would scatter 2026 days
    # into the training set and 2024 days into the test set, so the model would
    # study the future and be examined on the past; its score would measure
    # nothing, because in live use there is no future to study. It would also
    # split near-duplicate neighbouring rows (ma20 on consecutive days shares 19
    # of 20 inputs) across train and test, inflating the score further.
    cut = int(len(feats) * TRAIN_FRAC)
    train, test = feats.iloc[:cut], feats.iloc[cut:]
    if len(test) < 20:
        raise ValueError(f"test set only {len(test)} rows")

    # Scaler is fitted on train alone: letting it see the test period's mean and
    # spread would leak future information into the transform.
    scaler = StandardScaler()
    X_train = scaler.fit_transform(train[FEATURES])
    X_test = scaler.transform(test[FEATURES])

    model = LinearRegression().fit(X_train, train["ret_target"])
    pred = model.predict(X_test)
    actual = test["ret_target"].to_numpy()

    dir_acc = float(((pred > 0) == (actual > 0)).mean())
    naive = float((actual > 0).mean())          # always predict "up"
    edge = dir_acc - naive

    weights = {f: float(w) for f, w in zip(FEATURES, model.coef_)}
    top_feature = max(weights, key=lambda k: abs(weights[k]))

    if edge > 0 and dir_acc > 0.51:
        signal = "positive"
    elif dir_acc < naive:
        signal = "negative"
    else:
        signal = "neutral"

    golden = int((test["ma_ratio"] > 1.0).sum())

    return {
        "mlSignal": signal,
        "mlEdge": round(edge, 4),
        "dirAccuracy": round(dir_acc, 4),
        "naiveBaseline": round(naive, 4),
        "r2Return": round(float(r2_score(actual, pred)), 6),
        "maRatioWeight": round(weights["ma_ratio"], 6),
        "topFeature": top_feature,
        "weights": {k: round(v, 6) for k, v in weights.items()},
        "goldenCrossDays": golden,
        "deathCrossDays": int(len(test) - golden),
        "testDays": int(len(test)),
    }


def main() -> int:
    if not CSV_IN.exists():
        raise SystemExit(f"Missing {CSV_IN.name} - run 01_fetch_data.py first.")

    ANALYSIS_OUT.parent.mkdir(parents=True, exist_ok=True)

    prices = pd.read_csv(CSV_IN, index_col="Date", parse_dates=True)
    universe = sorted(json.loads(UNIVERSE.read_text()))
    caps = json.loads(CAPS.read_text())

    results: dict[str, dict] = {}
    skipped: dict[str, dict] = {}

    for ticker in universe:
        try:
            if ticker not in prices.columns:
                skipped[ticker] = {
                    "reason": "no data returned (renamed, delisted or suspended)",
                    "dateRange": None,
                    "tradingDays": 0,
                }
                continue

            col = prices[ticker]
            valid = col.dropna()
            date_range = (f"{valid.index.min().date()} -> {valid.index.max().date()}"
                          if not valid.empty else None)

            if len(valid) < MIN_ROWS:
                skipped[ticker] = {
                    "reason": f"insufficient history: {len(valid)} trading days "
                              f"(need {MIN_ROWS})",
                    "dateRange": date_range,
                    "tradingDays": len(valid),
                }
                continue

            # Gaps are measured only across the span the stock actually traded.
            # A late listing leaves the whole pre-IPO stretch empty, and over a
            # seven-year window that dwarfs the 5% limit - PAYTM listed in Nov
            # 2021 and shows 610 empty days with zero interior gaps and 1,141
            # clean ones. Counting those as missing data would reject a stock
            # for not having existed yet, which is not a quality problem.
            traded = col.loc[valid.index.min():valid.index.max()]
            gap_frac = 1 - len(valid) / len(traded)

            if gap_frac > MAX_MISSING_FRAC:
                skipped[ticker] = {
                    "reason": f"illiquid: {gap_frac:.1%} of days untraded within "
                              f"its listed span (limit {MAX_MISSING_FRAC:.0%})",
                    "dateRange": date_range,
                    "tradingDays": len(valid),
                }
                continue

            record = run_model(valid)
            record.update({
                # "full" means it traded every session across the whole window;
                # a late listing or any interior gap makes it "partial".
                "dataQuality": (
                    "full" if gap_frac == 0 and len(valid) == len(col) else "partial"
                ),
                "marketCapCategory": caps.get(ticker, "Unknown"),
            })
            results[ticker] = record

        except Exception as exc:              # noqa: BLE001 - skip, never stop
            skipped[ticker] = {
                "reason": f"{type(exc).__name__}: {exc}",
                "dateRange": None,
                "tradingDays": None,
                "traceback": traceback.format_exc(limit=1).strip().splitlines()[-1],
            }

    SIGNALS_OUT.write_text(json.dumps(results, indent=2, sort_keys=True))
    MISSING_OUT.write_text(json.dumps(skipped, indent=2, sort_keys=True))

    # ------------------------------------------------------------------
    # Machine-readable table, for checking the numbers without parsing JSON.
    # ------------------------------------------------------------------
    cols = ["ticker", "marketCapCategory", "testDays", "dirAccuracy",
            "naiveBaseline", "mlEdge", "r2Return", "topFeature",
            "maRatioWeight", "goldenCrossDays", "deathCrossDays",
            "mlSignal", "dataQuality"]
    with TABLE_OUT.open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(cols)
        for ticker, r in sorted(results.items(), key=lambda kv: -kv[1]["mlEdge"]):
            w.writerow([ticker] + [r[c] for c in cols[1:]])

    # ------------------------------------------------------------------
    # Summary. Every figure below is computed, never typed in.
    # ------------------------------------------------------------------
    rows = list(results.values())
    L: list[str] = []

    def emit(line: str = "") -> None:
        L.append(line)

    def avg(items, key) -> float:
        return float(np.mean([r[key] for r in items])) if items else float("nan")

    rule = "=" * 104

    emit(rule)
    emit("MOMENTUM SIGNAL STUDY - FULL ANALYSIS")
    emit(rule)
    emit(f"Universe {len(universe)} | modelled {len(rows)} | skipped {len(skipped)}")
    emit(f"Features {FEATURES} | LinearRegression on tomorrow's return")
    emit(f"Split: first {TRAIN_FRAC:.0%} train / last {1-TRAIN_FRAC:.0%} test, "
         f"chronological, never shuffled")
    emit()

    # ---- 1. ranked by edge ----
    emit(rule)
    emit("1. RANKED BY DIRECTIONAL EDGE (descending)")
    emit(rule)
    head = (f"{'Ticker':<12}| {'Cap':<6}| {'Dir acc':>8} | {'Naive':>7} | "
            f"{'Edge':>7} | {'R2':>10} | {'Top feature':<11}| Days")
    emit(head)
    emit("-" * len(head))
    for ticker, r in sorted(results.items(), key=lambda kv: -kv[1]["mlEdge"]):
        emit(f"{ticker:<12}| {r['marketCapCategory']:<6}| "
             f"{r['dirAccuracy']:>7.1%} | {r['naiveBaseline']:>6.1%} | "
             f"{r['mlEdge']:>+6.1%} | {r['r2Return']:>+10.4f} | "
             f"{r['topFeature']:<11}| {r['testDays']}")
    emit()

    # ---- 2. findings ----
    pos = [r for r in rows if r["mlSignal"] == "positive"]
    neg = [r for r in rows if r["mlSignal"] == "negative"]
    neu = [r for r in rows if r["mlSignal"] == "neutral"]
    large = [r for r in rows if r["marketCapCategory"] == "Large"]
    mid = [r for r in rows if r["marketCapCategory"] == "Mid"]
    small = [r for r in rows if r["marketCapCategory"] == "Small"]
    top_ma = [r for r in rows if r["topFeature"] == "ma_ratio"]

    emit(rule)
    emit("2. FINDINGS")
    emit(rule)
    emit(f"Processed successfully      : {len(rows)}")
    emit(f"Skipped                     : {len(skipped)}")
    emit()
    emit(f"Signal positive             : {len(pos)} ({len(pos)/len(rows):.0%})")
    emit(f"Signal negative             : {len(neg)} ({len(neg)/len(rows):.0%})")
    emit(f"Signal neutral              : {len(neu)} ({len(neu)/len(rows):.0%})")
    emit()
    emit(f"Average directional edge    : {avg(rows, 'mlEdge'):+.2%}")
    emit(f"Average directional accuracy: {avg(rows, 'dirAccuracy'):.1%}")
    emit(f"Average naive baseline      : {avg(rows, 'naiveBaseline'):.1%}")
    emit(f"Average R2 (return)         : {avg(rows, 'r2Return'):+.4f}")
    emit(f"Stocks with R2 above zero   : "
         f"{sum(1 for r in rows if r['r2Return'] > 0)} of {len(rows)}")
    emit(f"Stocks beating own baseline : "
         f"{sum(1 for r in rows if r['mlEdge'] > 0)} of {len(rows)}")
    emit()
    emit(f"{'segment':<12}{'n':>5}{'avg edge':>11}{'avg dir acc':>14}"
         f"{'avg |ma_ratio wt|':>20}")
    for label, grp in (("Large", large), ("Mid", mid), ("Small", small)):
        if grp:
            aw = float(np.mean([abs(r["maRatioWeight"]) for r in grp]))
            emit(f"{label:<12}{len(grp):>5}{avg(grp, 'mlEdge'):>+11.2%}"
                 f"{avg(grp, 'dirAccuracy'):>14.1%}{aw:>20.5f}")
    emit()

    ma_pos = sum(1 for r in rows if r["maRatioWeight"] > 0)
    ma_neg = sum(1 for r in rows if r["maRatioWeight"] < 0)
    ma_abs = float(np.mean([abs(r["maRatioWeight"]) for r in rows]))
    feature_counts = {f: sum(1 for r in rows if r["topFeature"] == f)
                      for f in FEATURES}

    emit(f"Largest-weight feature counts: "
         + ", ".join(f"{f} {n}" for f, n in feature_counts.items()))
    emit(f"ma_ratio was the largest weight for {len(top_ma)} of {len(rows)} stocks")
    if top_ma:
        emit(f"  their average directional accuracy: {avg(top_ma, 'dirAccuracy'):.1%} "
             f"(edge {avg(top_ma, 'mlEdge'):+.1%})")
    emit(f"ma_ratio sign split              : {ma_pos} positive / {ma_neg} negative")
    emit(f"ma_ratio average absolute weight : {ma_abs:.5f}")
    emit()
    emit("Caveat on ma_ratio weights: ma_ratio is ma5/ma20, a deterministic")
    emit("function of two features already in the model. Near-redundant")
    emit("predictors let a linear fit trade large offsetting weights between them")
    emit("without changing its predictions, so the individual coefficients are")
    emit("unstable and a large one is not evidence the cross signal matters.")
    emit("Directional accuracy against the naive baseline is the column to trust.")
    emit()

    # ---- 3. conclusion ----
    beat = sum(1 for r in rows if r["mlEdge"] > 0)
    mean_edge = avg(rows, "mlEdge")
    mean_r2 = avg(rows, "r2Return")
    mean_test = avg(rows, "testDays")
    mean_dir = avg(rows, "dirAccuracy")
    mean_naive = avg(rows, "naiveBaseline")
    # Standard error of a coin-flip proportion over the average test length,
    # for judging whether any single stock's edge is distinguishable from luck.
    se = 0.5 / np.sqrt(mean_test)

    # How the market itself behaved over the test window. The always-up baseline
    # is only as strong as the drift behind it, so this is needed to read the
    # edge numbers honestly. The reference split comes from the first modelled
    # ticker; the split is positional, so every full-history ticker lands on the
    # same dates.
    modelled = list(results)
    ref = build_features(prices[modelled[0]].dropna())
    ref = ref.iloc[int(len(ref) * TRAIN_FRAC):]
    test_start, test_end = ref.index.min().date(), ref.index.max().date()
    window = prices.loc[str(test_start):str(test_end), modelled]
    rise = (window.iloc[-1] / window.iloc[0] - 1).dropna()
    median_rise = float(rise.median())
    n_rose, n_total = int((rise > 0).sum()), int(len(rise))

    years = round((prices.index.max() - prices.index.min()).days / 365.25)
    ma_majority = max(ma_pos, ma_neg)
    ma_lean = "higher" if ma_pos >= ma_neg else "lower"

    emit(rule)
    emit("3. EFFICIENT MARKET HYPOTHESIS - CONCLUSION")
    emit(rule)
    emit()
    emit(f"Across {len(rows)} NSE stocks, a linear model given {years} years of")
    emit("daily prices and four of the most widely known technical inputs - two")
    emit("moving averages, their ratio, and the day's own return - predicted the")
    emit(f"direction of tomorrow's move {mean_dir:.1%} of the time, against a naive")
    emit(f"always-up baseline of {mean_naive:.1%}. The average edge was "
         f"{mean_edge:+.2%}, and")
    emit(f"{beat} of {len(rows)} stocks ({beat/len(rows):.0%}) finished above their "
         f"own baseline.")
    emit()
    emit(f"Read the accuracy figure on its own first: {mean_dir:.1%} is below a coin")
    emit("flip. The positive average edge is not skill, it is a weak benchmark.")
    emit(f"Over the test window ({test_start} to {test_end}) the always-up rule only")
    emit(f"scored {mean_naive:.1%}, because the window was close to flat: the median")
    emit(f"stock moved {median_rise:+.0%} and {n_rose} of {n_total} rose at all.")
    emit("Beating a poor benchmark from below a coin flip is not a result worth")
    emit("acting on.")
    emit()
    emit(f"Average R2 on returns was {mean_r2:+.4f}. Note the sign: on average the")
    emit("model predicted tomorrow's return slightly WORSE than simply guessing the")
    emit("mean return every day.")
    emit()
    emit(f"Test periods average {mean_test:.0f} days, so the standard error on a")
    emit(f"single stock's directional accuracy is roughly {se:.1%}. Two standard")
    emit(f"errors is about {2*se:.0%}, so any one stock's edge inside that band is")
    emit(f"indistinguishable from luck - and with {len(rows)} stocks ranked, a")
    emit("handful will clear it by chance alone. The top of the ranked table should")
    emit("be read as sampling variation, not discovered signal, until it survives")
    emit("an untouched second period.")
    emit()
    emit("This is the weak form of the efficient market hypothesis behaving exactly")
    emit("as advertised: information already contained in the public price history")
    emit("is already reflected in the price. Moving averages and lagged returns are")
    emit("the most heavily studied indicators in existence; any edge they carried")
    emit(f"would have been arbitraged away long before it reached a {years}-year")
    emit("sample of large, mid and small-cap NSE names.")
    emit()
    emit("The golden cross specifically - tested here as ma_ratio - was the largest")
    emit(f"weight for {len(top_ma)} of {len(rows)} stocks, and its average absolute")
    emit(f"weight was {ma_abs:.5f}, close enough to zero that the model is")
    emit(f"effectively ignoring it. Its sign split {ma_pos} positive to {ma_neg}")
    emit(f"negative, so {ma_majority/len(rows):.0%} of fits read golden-cross")
    emit(f"territory as nudging tomorrow {ma_lean} and the rest read it the other")
    emit("way. A signal carrying real directional information would point the same")
    emit("way for nearly every stock and would earn a weight large enough to act")
    emit("on. This one does neither.")
    emit()
    emit("Honest caveats. This tests linear relationships only, at a one-day")
    emit("horizon, on price-derived features alone; none of that rules out")
    emit("non-linear structure, longer horizons, or signals in volume,")
    emit("fundamentals, order flow or news. Dividends are excluded and transaction")
    emit("costs are ignored, both of which flatter the momentum side. Two")
    emit("uncorrected demergers (Raymond, Tata Motors) sit inside the test period.")
    emit(f"And {years} years is short for a question the literature answers over")
    emit("decades.")
    emit()
    emit("The finding is not that markets are unbeatable. It is the narrower and")
    emit("better-supported claim that these particular features, at this horizon,")
    emit("carry no exploitable information for this universe.")
    emit()

    text = "\n".join(L)
    ANALYSIS_OUT.write_text(text)
    print(text)

    print(rule)
    print(f"SKIPPED: {len(skipped)}")
    print(rule)
    for ticker, info in sorted(skipped.items()):
        rng = info.get("dateRange") or "no data"
        print(f"  {ticker:<12} {info['reason']:<62} [{rng}]")

    print(f"\nWrote {SIGNALS_OUT.relative_to(ROOT)}, {MISSING_OUT.relative_to(ROOT)},")
    print(f"      {ANALYSIS_OUT.relative_to(ROOT)} and {TABLE_OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
