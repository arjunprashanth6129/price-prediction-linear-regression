#!/usr/bin/env python3
"""Stage 3a: split the RELIANCE features into training and test sets.

Chronological split -- the first 80% of days train, the last 20% test.

Why the rows must NOT be shuffled
---------------------------------
The usual train_test_split(shuffle=True) is correct for independent samples
(photos, emails, patients) where row order carries no meaning. It is wrong
here, for two separate reasons:

1. It leaks the future into the past. Shuffling scatters days from 2026 into
   the training set and days from 2024 into the test set, so the model studies
   the future and is then examined on the past. Its test score would measure
   nothing, because in real use there IS no future to study.

2. Neighbouring rows are near-duplicates. ma20 on Tuesday and ma20 on
   Wednesday share 19 of their 20 days. Shuffle, and Tuesday lands in train
   while Wednesday lands in test -- the model is tested on a row it has
   effectively already seen, which inflates the score further.

Splitting by date reproduces the only situation that matters: learn from the
past, predict a future you have never seen.

    python3 scripts/ml/03_split.py
"""
import pandas as pd

from pathlib import Path

import figstyle as fs
from figstyle import (AXIS, BLUE, GRID, INK, INK_MUTED, INK_SECONDARY, ORANGE,
                      SURFACE)

fs.use_style()

import matplotlib.dates as mdates
import matplotlib.pyplot as plt

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
CSV_IN = HERE / "reliance_features.csv"
PNG_OUT = ROOT / "docs" / "figures" / "train-test-split.png"

FEATURES = ["ma5", "ma20", "ret", "ma_ratio"]
TARGET = "target"

# 04_model.py repeats this fraction. The split is purely positional, so both
# scripts land on identical rows; each prints its split date to prove it.
TRAIN_FRAC = 0.8

# Train is blue, test is orange - the same two hues the rest of the figure set
# uses, defined once in figstyle.py.
TRAIN_COLOR = BLUE
TEST_COLOR = ORANGE


def chronological_split(df: pd.DataFrame, frac: float = TRAIN_FRAC):
    """First `frac` of rows by date -> train, remainder -> test."""
    cut = int(len(df) * frac)
    return df.iloc[:cut], df.iloc[cut:]


def plot_split(train: pd.DataFrame, test: pd.DataFrame) -> None:
    fig, ax = plt.subplots(figsize=(12, 5))
    fig.patch.set_facecolor(SURFACE)
    ax.set_facecolor(SURFACE)

    ax.plot(train.index, train["close"], color=TRAIN_COLOR, linewidth=2,
            label=f"Training ({len(train)} days)")
    ax.plot(test.index, test["close"], color=TEST_COLOR, linewidth=2,
            label=f"Test ({len(test)} days)")

    split_date = test.index[0]
    ax.axvline(split_date, color=INK_SECONDARY, linestyle="--", linewidth=1.5)
    ax.annotate(
        f"split  {split_date.date()}",
        xy=(split_date, ax.get_ylim()[1]),
        xytext=(6, -12),
        textcoords="offset points",
        color=INK_SECONDARY,
        fontsize=10,
    )

    ax.set_title("RELIANCE close - chronological train/test split",
                 color=INK, fontsize=14, fontweight="bold", loc="left", pad=12)
    ax.set_ylabel("Close (₹)", color=INK_MUTED, fontsize=10)
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

    legend = ax.legend(frameon=False, loc="upper left", fontsize=10)
    for text in legend.get_texts():
        text.set_color(INK_SECONDARY)

    fig.tight_layout()
    PNG_OUT.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(PNG_OUT)
    plt.close(fig)


def main() -> int:
    if not CSV_IN.exists():
        raise SystemExit(f"Missing {CSV_IN.name} - run 02_features.py first.")

    df = pd.read_csv(CSV_IN, index_col="Date", parse_dates=True)
    train, test = chronological_split(df)

    print(f"Features: {FEATURES}")
    print(f"Target  : {TARGET}\n")

    print(f"Total rows: {len(df)}  ({TRAIN_FRAC:.0%} train / "
          f"{1 - TRAIN_FRAC:.0%} test, split by date, not shuffled)\n")

    print(f"Training set: {train.index.min().date()} -> "
          f"{train.index.max().date()}   {len(train)} rows")
    print(f"Test set    : {test.index.min().date()} -> "
          f"{test.index.max().date()}   {len(test)} rows")
    print(f"\nSplit date (first test day): {test.index[0].date()}")

    plot_split(train, test)
    print(f"\nWrote {PNG_OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
