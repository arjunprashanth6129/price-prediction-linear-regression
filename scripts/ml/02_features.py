#!/usr/bin/env python3
"""Stage 2 of the ML pipeline: build features for a single stock (RELIANCE).

Reads the closes saved by 01_fetch_data.py and turns one column of prices into
a table a model can learn from: three features describing what the stock has
done up to today, and a target holding what it did the next day.

    close   today's closing price (the source column, kept for reference)
    ma5     mean close over the last 5 trading days
    ma20    mean close over the last 20 trading days
    ret     today's return, (today - yesterday) / yesterday
    target  TOMORROW's closing price -- what a model would try to predict

Why moving averages
-------------------
A single day's close is noisy. A 5-day mean smooths that into "where has this
been trading lately", and the 20-day mean gives a slower baseline to compare it
against. The gap between the two is the usual way of saying whether a stock is
running above or below its own recent trend.

On lookahead
------------
Every feature uses only data up to and including today; only the target looks
forward. A rolling mean that peeked at tomorrow, or a target built with
shift(+1) instead of shift(-1), would leak the answer into the question and
produce a model that scores brilliantly here and fails completely in practice.
Worth re-checking whenever a feature is added.

    python3 scripts/ml/02_features.py
"""
import pandas as pd

from pathlib import Path

HERE = Path(__file__).resolve().parent
CSV_IN = HERE / "raw_prices.csv"
CSV_OUT = HERE / "reliance_features.csv"

# raw_prices.csv is keyed by plain NSE ticker (no .NS suffix); 01_fetch_data.py
# maps the Yahoo symbols back before writing it.
TICKER = "RELIANCE"


def build_features(close: pd.Series) -> pd.DataFrame:
    """Features describing today, plus tomorrow's close as the target."""
    feats = pd.DataFrame({"close": close})

    # rolling(n).mean() averages the current row and the n-1 before it, so the
    # first n-1 rows have too little history and come back NaN.
    feats["ma5"] = close.rolling(window=5).mean()
    feats["ma20"] = close.rolling(window=20).mean()

    # One number carrying the whole golden/death cross idea:
    #   > 1.0  golden cross territory (fast MA above slow -- bullish)
    #   < 1.0  death cross territory  (fast MA below slow -- bearish)
    #   crossing 1.0 is the cross EVENT firing, in either direction
    # Distance from 1.0 is signal strength: 1.08 is far more emphatic than
    # 1.001. Dividing rather than subtracting also makes it scale-free, so the
    # same value means the same thing on a Rs 300 stock and a Rs 3000 one --
    # which matters once this runs across a whole universe.
    feats["ma_ratio"] = feats["ma5"] / feats["ma20"]

    # Fractional, not percent: 0.023 means +2.3%. First row is NaN (no
    # yesterday to compare against).
    feats["ret"] = close.pct_change()

    # shift(-1) pulls each row's NEXT value back onto this row, so every row
    # reads "here is today, and here is what tomorrow closed at". The final row
    # has no tomorrow yet, so its target is NaN.
    feats["target"] = close.shift(-1)

    return feats


def main() -> int:
    if not CSV_IN.exists():
        raise SystemExit(f"Missing {CSV_IN.name} - run 01_fetch_data.py first.")

    prices = pd.read_csv(CSV_IN, index_col="Date", parse_dates=True)
    if TICKER not in prices.columns:
        raise SystemExit(f"{TICKER} not in {CSV_IN.name}")

    feats = build_features(prices[TICKER])

    # Drop the warm-up rows (19 at the top, where ma20 has no history) and the
    # final row (no tomorrow to predict). No interpolation: a made-up price is
    # worse than a missing one.
    before = len(feats)
    feats = feats.dropna()
    print(f"Dropped {before - len(feats)} rows with NaN ({before} -> {len(feats)})")

    feats.to_csv(CSV_OUT)

    pd.set_option("display.width", 120)
    pd.set_option("display.max_columns", None)

    rows, cols = feats.shape
    print(f"\nShape: {rows} rows x {cols} columns")
    print(f"Date range: {feats.index.min().date()} -> {feats.index.max().date()}")

    print("\nFirst 10 rows:")
    print(feats.head(10).round(4).to_string())

    # ------------------------------------------------------------------
    # Did the golden/death cross signal actually pay, historically?
    # ------------------------------------------------------------------
    # Split every day by which side of 1.0 ma_ratio sat on, then look at what
    # the NEXT day's return turned out to be in each group. If the signal
    # carries information, golden-cross days should be followed by better
    # returns than death-cross days. This is a plain historical tally, not a
    # model -- it says whether the raw signal was worth anything before any
    # learning is attempted.
    # ------------------------------------------------------------------
    next_ret = feats["target"] / feats["close"] - 1
    golden = feats["ma_ratio"] > 1.0
    death = ~golden

    print("\nGolden vs death cross territory (whole dataset):")
    print(f"  {'':22}{'days':>7}{'share':>9}{'avg next-day return':>22}")
    print(f"  {'golden (ma_ratio>1)':22}{golden.sum():>7}"
          f"{golden.mean():>9.1%}{next_ret[golden].mean():>21.4%}")
    print(f"  {'death  (ma_ratio<1)':22}{death.sum():>7}"
          f"{death.mean():>9.1%}{next_ret[death].mean():>21.4%}")

    spread = next_ret[golden].mean() - next_ret[death].mean()
    print(f"\n  Spread (golden minus death): {spread:+.4%} per day")
    print(f"  ma_ratio range: {feats['ma_ratio'].min():.4f} -> "
          f"{feats['ma_ratio'].max():.4f}")
    if abs(spread) < 0.0005:
        print("  -> Under 0.05%/day. Too small to call a signal on this stock.")

    # ------------------------------------------------------------------
    # What correlation means here
    # ------------------------------------------------------------------
    # Correlation scores how tightly two columns move together, from -1 to +1.
    # +1 is "when this goes up, that always goes up by a proportional amount",
    # 0 is "no straight-line relationship", -1 is the same but inverted.
    #
    # READ THE NUMBERS BELOW WITH SUSPICION. close, ma5 and ma20 are all price
    # LEVELS in rupees, and so is the target. Reliance trades near 1300 today,
    # so it will trade near 1300 tomorrow -- that alone forces a correlation of
    # about 0.99, and it would stay near 0.99 for any stock, in any period,
    # picked at random. It says the price is stable overnight. It does NOT say
    # these features predict anything, and a model fed only these will look
    # excellent while doing no better than guessing "tomorrow = today".
    #
    # ret is the honest one. It is a change rather than a level, so it has no
    # free head start, and its correlation will sit near 0 -- which is the real
    # and well-documented result that tomorrow's move is close to independent
    # of today's. That near-zero number is more informative than the 0.99s.
    #
    # The fix in Stage 3 is to judge the model against a "predict today's price
    # for tomorrow" baseline rather than against zero, and preferably to
    # predict the RETURN instead of the price level.
    # ------------------------------------------------------------------
    corr = feats.corr()

    print("\nCorrelation of each feature with the target:")
    print(corr["target"].drop("target").sort_values(ascending=False).to_string())

    print("\nFull correlation matrix:")
    print(corr.round(4).to_string())

    print(f"\nWrote {CSV_OUT.name} to {HERE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
