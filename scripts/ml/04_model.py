#!/usr/bin/env python3
"""Stage 3b: train two linear regressions on RELIANCE and compare them.

Version 1 predicts tomorrow's PRICE. Version 2 predicts tomorrow's RETURN.
Same features, same split, same algorithm -- only the target changes, and the
whole point of running both is to see how differently they score.

    python3 scripts/ml/04_model.py
"""
import json

import numpy as np
import pandas as pd

from pathlib import Path

import figstyle as fs
from figstyle import (AXIS, BLUE, GRID, INK, INK_MUTED, INK_SECONDARY, ORANGE,
                      SURFACE)

fs.use_style()

import matplotlib.dates as mdates
import matplotlib.pyplot as plt
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import StandardScaler

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
CSV_IN = HERE / "reliance_features.csv"
FIGURES = ROOT / "docs" / "figures"
PNG_PRICE = FIGURES / "reliance-price-fit.png"
PNG_RETURN = FIGURES / "reliance-return-fit.png"
DETAIL_OUT = ROOT / "data" / "reliance-model-detail.json"

FEATURES = ["ma5", "ma20", "ret", "ma_ratio"]

# Must match 03_split.py. The split is positional and deterministic, so both
# scripts select the same rows; the printed split date below confirms it.
TRAIN_FRAC = 0.8

# Actual is blue, predicted is orange - the same two hues the rest of the
# figure set uses, defined once in figstyle.py.
ACTUAL_COLOR = BLUE
PRED_COLOR = ORANGE


def style(ax) -> None:
    ax.set_facecolor(SURFACE)
    ax.grid(True, color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_color(AXIS)
    ax.tick_params(colors=INK_MUTED, labelsize=9)
    locator = mdates.AutoDateLocator()
    ax.xaxis.set_major_locator(locator)
    ax.xaxis.set_major_formatter(mdates.ConciseDateFormatter(locator))


def line_plot(index, actual, predicted, title, ylabel, path, zero_line=False):
    fig, ax = plt.subplots(figsize=(12, 5))
    fig.patch.set_facecolor(SURFACE)
    style(ax)

    if zero_line:
        ax.axhline(0, color=AXIS, linewidth=1)
    ax.plot(index, actual, color=ACTUAL_COLOR, linewidth=2, label="Actual")
    ax.plot(index, predicted, color=PRED_COLOR, linewidth=2, label="Predicted")

    ax.set_title(title, color=INK, fontsize=14, fontweight="bold",
                 loc="left", pad=12)
    ax.set_ylabel(ylabel, color=INK_MUTED, fontsize=10)
    legend = ax.legend(frameon=False, loc="upper left", fontsize=10)
    for text in legend.get_texts():
        text.set_color(INK_SECONDARY)

    fig.tight_layout()
    FIGURES.mkdir(parents=True, exist_ok=True)
    fig.savefig(path)
    plt.close(fig)


def directional_accuracy(pred_change, actual_change) -> float:
    """Share of days where predicted up/down matched actual up/down."""
    return float(((pred_change > 0) == (actual_change > 0)).mean())


def main() -> int:
    if not CSV_IN.exists():
        raise SystemExit(f"Missing {CSV_IN.name} - run 02_features.py first.")

    df = pd.read_csv(CSV_IN, index_col="Date", parse_dates=True)

    # Version 2's target: tomorrow's return -- the same idea as the price
    # target, one row forward.
    #
    # The obvious way to write this is df["ret"].shift(-1). This is that same
    # quantity, reached by division instead: target is tomorrow's close and
    # close is today's, so target/close - 1 IS tomorrow's return. The two
    # agree to within floating-point noise (~1e-16) on every row.
    #
    # Division is used because shift(-1) would blank the final row -- not
    # because tomorrow's return is unknowable there, but as a leftover of
    # 02_features.py having already trimmed a row. Keeping it means all 478
    # rows survive and the split below lands exactly where 03_split.py put it.
    df["ret_target"] = df["target"] / df["close"] - 1

    cut = int(len(df) * TRAIN_FRAC)
    train, test = df.iloc[:cut], df.iloc[cut:]

    print(f"Train: {train.index.min().date()} -> {train.index.max().date()}"
          f"   {len(train)} rows")
    print(f"Test : {test.index.min().date()} -> {test.index.max().date()}"
          f"   {len(test)} rows")
    print(f"Split date (first test day): {test.index[0].date()}")

    # ------------------------------------------------------------------
    # Scaling: fit on TRAIN ONLY, then transform both.
    # ------------------------------------------------------------------
    # StandardScaler subtracts the mean and divides by the standard deviation.
    # Those two numbers must be learned from the training set alone. Calling
    # fit() on the full dataset -- or on the test set -- would let the test
    # period's mean and spread influence how training data is transformed,
    # which is data leakage: information from days the model is supposed to
    # have never seen quietly enters its training. The test score would then
    # be optimistic in a way that never reproduces in live use, where future
    # data genuinely does not exist yet.
    #
    # Note fit_transform() on train, but plain transform() on test -- test is
    # rescaled using the TRAINING mean and deviation, never its own.
    # ------------------------------------------------------------------
    scaler = StandardScaler()
    X_train = scaler.fit_transform(train[FEATURES])
    X_test = scaler.transform(test[FEATURES])

    results = {}

    # ==================================================================
    # VERSION 1 -- predict tomorrow's PRICE
    # ==================================================================
    print("\n" + "=" * 70)
    print("VERSION 1 - PRICE LEVEL MODEL (target = tomorrow's close)")
    print("=" * 70)

    y_train, y_test = train["target"], test["target"]
    model_price = LinearRegression().fit(X_train, y_train)
    pred_price = model_price.predict(X_test)

    mae = mean_absolute_error(y_test, pred_price)
    rmse = float(np.sqrt(mean_squared_error(y_test, pred_price)))
    r2 = r2_score(y_test, pred_price)

    # The naive baseline: no model at all, just "tomorrow = today".
    naive_price = test["close"].to_numpy()
    naive_mae = mean_absolute_error(y_test, naive_price)
    naive_rmse = float(np.sqrt(mean_squared_error(y_test, naive_price)))
    naive_r2 = r2_score(y_test, naive_price)

    today = test["close"].to_numpy()
    actual_change = y_test.to_numpy() - today
    model_dir = directional_accuracy(pred_price - today, actual_change)

    # The naive baseline predicts EXACTLY today's price, so its predicted
    # change is always 0 -- it never says "up". Scored the same way as the
    # model, it therefore gets credit only on days the price fell, which is
    # why its directional accuracy equals the share of down days. It has no
    # directional opinion at all; the number is reported for completeness.
    naive_dir = directional_accuracy(naive_price - today, actual_change)
    share_down = float((actual_change <= 0).mean())

    print(f"\n{'':22}{'TRAINED MODEL':>16}{'NAIVE (today)':>16}")
    print(f"{'MAE (Rs)':22}{mae:>16.2f}{naive_mae:>16.2f}")
    print(f"{'RMSE (Rs)':22}{rmse:>16.2f}{naive_rmse:>16.2f}")
    print(f"{'R2':22}{r2:>16.4f}{naive_r2:>16.4f}")
    print(f"{'Directional acc.':22}{model_dir:>15.1%}{naive_dir:>16.1%}")

    verdict = "BEATS" if mae < naive_mae else "LOSES TO"
    print(f"\n  -> On MAE the trained model {verdict} the naive baseline "
          f"({mae:.2f} vs {naive_mae:.2f}).")
    print(f"  -> Naive directional accuracy is just the share of DOWN days "
          f"({share_down:.1%}); it never predicts 'up'.")

    # ------------------------------------------------------------------
    # Coefficients. Because every feature was scaled to the same units
    # (standard deviations), these weights are directly comparable: a larger
    # absolute weight means that feature shifts the prediction more for the
    # same sized move. The SIGN says direction -- positive pushes the
    # prediction up when the feature rises, negative pushes it down.
    # Without scaling this comparison would be meaningless, since a
    # coefficient on a feature measured in rupees is not comparable to one on
    # a feature measured in fractions of a percent.
    # ------------------------------------------------------------------
    print("\n  Learned weights (on scaled features):")
    for name, coef in zip(FEATURES, model_price.coef_):
        print(f"    {name:6} {coef:+10.3f}")
    print(f"    {'(bias)':6} {model_price.intercept_:+10.3f}")

    span = f"{test.index.min():%b %Y} - {test.index.max():%b %Y}"
    line_plot(test.index, y_test.to_numpy(), pred_price,
              f"RELIANCE - actual vs predicted close · test set {span}",
              "Close (₹)", PNG_PRICE)

    results["price"] = (r2, model_dir, naive_dir)

    # ==================================================================
    # VERSION 2 -- predict tomorrow's RETURN
    # ==================================================================
    print("\n" + "=" * 70)
    print("VERSION 2 - RETURN MODEL (target = tomorrow's return)")
    print("=" * 70)

    yr_train, yr_test = train["ret_target"], test["ret_target"]
    model_ret = LinearRegression().fit(X_train, yr_train)
    pred_ret = model_ret.predict(X_test)

    r2_ret = r2_score(yr_test, pred_ret)
    mae_ret = mean_absolute_error(yr_test, pred_ret)
    dir_ret = directional_accuracy(pred_ret, yr_test.to_numpy())

    # Naive baseline for direction: always guess "up". Its accuracy is simply
    # the share of days that actually rose.
    always_up = float((yr_test.to_numpy() > 0).mean())

    # ------------------------------------------------------------------
    # Why an R2 near zero here is the HONEST answer, not a failure.
    # ------------------------------------------------------------------
    # R2 asks: how much better is this model than always guessing the target's
    # average? For Version 1 that bar is trivially low -- the average price
    # over the test window is a terrible guess for any specific day, so almost
    # any model clears it and R2 looks superb. For Version 2 the bar is
    # brutal: the average daily return is roughly zero, and "tomorrow will be
    # about flat" is genuinely hard to beat.
    #
    # An R2 near 0 therefore means the model adds nothing beyond that, which
    # is the well-documented result for daily price prediction from public
    # data. A near-zero score here is the model correctly reporting that these
    # three features do not forecast tomorrow's move. A LARGE positive R2 in
    # this setting would be the alarming outcome -- it would point to leakage
    # rather than to insight.
    # ------------------------------------------------------------------
    print(f"\n  R2 on test set        : {r2_ret:>9.4f}")
    print(f"  MAE (return)          : {mae_ret:>9.5f}")
    print(f"  Directional accuracy  : {dir_ret:>9.1%}")
    print(f"  Naive 'always up'     : {always_up:>9.1%}")

    edge = dir_ret - always_up
    print(f"\n  -> Model is {edge:+.1%} vs the always-up baseline "
          f"({len(yr_test)} test days).")

    print("\n  Learned weights (on scaled features):")
    for name, coef in zip(FEATURES, model_ret.coef_):
        print(f"    {name:6} {coef:+10.6f}")
    print(f"    {'(bias)':6} {model_ret.intercept_:+10.6f}")

    line_plot(test.index, yr_test.to_numpy(), pred_ret,
              f"RELIANCE - actual vs predicted daily return · test set {span}",
              "Return (fraction)", PNG_RETURN, zero_line=True)

    results["return"] = (r2_ret, dir_ret, always_up)

    # ==================================================================
    # SIDE BY SIDE
    # ==================================================================
    # ------------------------------------------------------------------
    # Which metric matters more?
    # ------------------------------------------------------------------
    # DIRECTIONAL ACCURACY, compared against its own baseline -- not R2.
    #
    # R2 on the price model is inflated by the target being a price level: it
    # is mostly rewarding the model for knowing Reliance costs about Rs 1300,
    # which required no learning. Read alone it says "excellent" about a model
    # that may add nothing.
    #
    # Direction is what a decision actually depends on: buy or not. And it
    # must always be read against its baseline, because a bare "54% correct"
    # is meaningless -- if 54% of days rose, then always guessing "up" scores
    # the same while knowing nothing. The number that carries information is
    # the GAP between the model and its baseline, and on a test set of ~95
    # days a gap of a few points is still comfortably inside noise.
    # ------------------------------------------------------------------
    print("\n" + "=" * 70)
    print("PRICE LEVEL MODEL vs RETURN MODEL COMPARISON")
    print("=" * 70)
    header = (f"{'Model':<15}| {'Target':<8}| {'R2':<7}| "
              f"{'Dir. Accuracy':<14}| Naive Baseline Dir. Acc.")
    print(header)
    print("-" * len(header))
    r2_p, dir_p, ndir_p = results["price"]
    r2_r, dir_r, ndir_r = results["return"]
    print(f"{'Price level':<15}| {'price':<8}| {r2_p:<7.2f}| "
          f"{dir_p:<14.0%}| {ndir_p:.0%}")
    print(f"{'Return':<15}| {'return':<8}| {r2_r:<7.2f}| "
          f"{dir_r:<14.0%}| {ndir_r:.0%}")

    # ------------------------------------------------------------------
    # Machine-readable export of the return model, for the /quant page.
    # Only the return model is exported: the price model exists to show why
    # its R2 cannot be trusted, so publishing its numbers would invite the
    # exact misreading Stage 3 was written to prevent.
    # ------------------------------------------------------------------
    detail = {
        "trainDateRange": {
            "start": str(train.index.min().date()),
            "end": str(train.index.max().date()),
        },
        "testDateRange": {
            "start": str(test.index.min().date()),
            "end": str(test.index.max().date()),
        },
        "featureWeights": {
            **{n: round(float(w), 6) for n, w in zip(FEATURES, model_ret.coef_)},
            "bias": round(float(model_ret.intercept_), 6),
        },
        "testPeriodData": [
            {
                "date": str(d.date()),
                "actualReturn": round(float(a), 6),
                "predictedReturn": round(float(p), 6),
            }
            for d, a, p in zip(test.index, yr_test.to_numpy(), pred_ret)
        ],
        "metrics": {
            "r2Return": round(float(r2_ret), 6),
            "dirAccuracy": round(float(dir_ret), 6),
            "naiveBaseline": round(float(always_up), 6),
            "edge": round(float(dir_ret - always_up), 6),
            "testDays": int(len(yr_test)),
        },
        # The three-way comparison the /quant worked example is built on. The
        # price model and the naive "tomorrow = today" rule are scored on the
        # same rupee scale so MAE and RMSE are directly comparable; the return
        # model is on a different scale and is only comparable on R2 and
        # direction, which is stated on the page rather than left implicit.
        "priceModel": {
            "mae": round(float(mae), 4),
            "rmse": round(float(rmse), 4),
            "r2": round(float(r2), 6),
            "dirAccuracy": round(float(model_dir), 6),
        },
        "naiveModel": {
            "mae": round(float(naive_mae), 4),
            "rmse": round(float(naive_rmse), 4),
            "r2": round(float(naive_r2), 6),
            "dirAccuracy": round(float(naive_dir), 6),
        },
        "returnModel": {
            "mae": round(float(mae_ret), 6),
            "rmse": round(float(np.sqrt(mean_squared_error(yr_test, pred_ret))), 6),
            "r2": round(float(r2_ret), 6),
            "dirAccuracy": round(float(dir_ret), 6),
            "naiveDirAccuracy": round(float(always_up), 6),
        },
        "pricePeriodData": [
            {
                "date": str(d.date()),
                "actual": round(float(a), 2),
                "predicted": round(float(p), 2),
            }
            for d, a, p in zip(test.index, y_test.to_numpy(), pred_price)
        ],
    }

    # ------------------------------------------------------------------
    # Feature weights for both models, in two forms.
    #
    # The raw coefficients are not comparable across the two models: the price
    # model's are rupees per standard deviation, the return model's are a
    # fraction of price per standard deviation. Raw, they differ by about
    # 15,000x, which on a shared axis would render the return chart blank.
    #
    # Dividing the price weights by the mean test close converts them into the
    # same unit the return model already uses -- share of the target per 1 SD
    # of the feature -- since a return IS a change divided by price. On that
    # footing the two are honestly comparable and both visible.
    # ------------------------------------------------------------------
    mean_close = float(test["close"].mean())

    def weights(model, scale: float) -> dict:
        return {
            "raw": {
                **{n: round(float(w), 6) for n, w in zip(FEATURES, model.coef_)},
                "bias": round(float(model.intercept_), 6),
            },
            "pctOfTarget": {
                n: round(float(w) / scale * 100, 4)
                for n, w in zip(FEATURES, model.coef_)
            },
        }

    price_w = weights(model_price, mean_close)
    return_w = weights(model_ret, 1.0)

    detail["priceModel"]["featureWeights"] = price_w["raw"]
    detail["priceModel"]["featureWeightsPctOfTarget"] = price_w["pctOfTarget"]
    detail["priceModel"]["meanTestClose"] = round(mean_close, 2)

    # Predicted-vs-actual and the 3D slice both need the model's own view of
    # the inputs, which is the post-StandardScaler values rather than the raw
    # rupee averages. X_test columns follow FEATURES order.
    ma5_scaled = X_test[:, FEATURES.index("ma5")]
    ma20_scaled = X_test[:, FEATURES.index("ma20")]

    detail["priceModel"]["testPeriodData"] = detail["pricePeriodData"]

    detail["returnModel"]["featureWeights"] = return_w["raw"]
    detail["returnModel"]["featureWeightsPctOfTarget"] = return_w["pctOfTarget"]
    detail["returnModel"]["testPeriodData"] = [
        {
            "date": str(d.date()),
            "ma5Scaled": round(float(x5), 4),
            "ma20Scaled": round(float(x20), 4),
            "actualReturn": round(float(a), 6),
            "predictedReturn": round(float(p), 6),
            "residual": round(float(a - p), 6),
        }
        for d, x5, x20, a, p in zip(
            test.index, ma5_scaled, ma20_scaled, yr_test.to_numpy(), pred_ret
        )
    ]
    DETAIL_OUT.write_text(json.dumps(detail, indent=2))

    print(f"\nSaved {PNG_PRICE.name} and {PNG_RETURN.name} to "
          f"{FIGURES.relative_to(ROOT)}")
    print(f"Wrote {DETAIL_OUT.relative_to(ROOT)} "
          f"({len(detail['testPeriodData'])} test rows)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
