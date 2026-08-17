#!/usr/bin/env python3
"""Stage 1: pull daily closes for the whole universe.

The ticker list is read from data/universe.json rather than hard-coded here, so
the pipeline and the site can never disagree about what was in scope. That file
holds 100 NSE names spanning large, mid and small caps.

It lands two artifacts next to this file:

    raw_prices.csv                    Date-indexed closes, one column per ticker
    docs/figures/universe-closes.png  Small multiples of every ticker's close

The window is fixed at 2019-06-01 to 2026-06-30, not a trailing period, so the
dataset is reproducible: re-running this next year reproduces the same table
rather than quietly sliding forward. raw_prices.csv is committed for the same
reason - stages 2 to 6 can be re-run offline against the exact series the
published results were computed from.

Why auto_adjust=True
--------------------
The adjusted series folds in splits and bonus issues, so a return computed off
two adjacent closes is a real return rather than a corporate-action artifact.
Without it, a 5:1 split reads as an 80% overnight crash and every return
computed after it is wrong.

It does NOT correct demergers, and this window contains two: Raymond
(2025-05-14, -65%) and Tata Motors (2025-10-14, -40%). Both are corporate
actions rather than market moves, both land inside the test period, and neither
is repaired here. main() reports them, and the write-up lists them as a known
limitation rather than hiding the patch.

Dead tickers are dropped, not fatal
-----------------------------------
Across 100 names some will have been renamed, delisted or suspended. yfinance
signals this by returning a full-length column of NaN rather than an error, so
those columns are detected and dropped here, and reported at the end. Stage 5
does the stricter per-ticker quality gating.

    python3 scripts/ml/01_fetch_data.py
"""
import json
import math

import matplotlib

matplotlib.use("Agg")  # write a PNG; never try to open a window

import matplotlib.pyplot as plt
import pandas as pd
import yfinance as yf

from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
UNIVERSE = ROOT / "data" / "universe.json"
CSV_OUT = HERE / "raw_prices.csv"
PNG_OUT = ROOT / "docs" / "figures" / "universe-closes.png"

# Explicit window, not a trailing period, so the dataset is reproducible.
#
# Seven years rather than two is a deliberate choice. It buys roughly 1,750
# trading days per stock instead of 500, which means a test set of around 350
# days spanning several market regimes rather than 96 days inside one. A result
# measured across a crash, a recovery and a rate-hike cycle cannot be an
# artifact of a single mood the way a one-regime result can.
START = "2019-06-01"
END = "2026-06-30"

# Yahoo symbols that no longer match the NSE ticker. Tata Motors demerged in
# Oct 2025 and the surviving listing was renamed Tata Motors Passenger
# Vehicles; Yahoo moved the full history to TMPV.NS and now 404s on
# TATAMOTORS.NS, returning a silent all-NaN column rather than an error.
RENAMES = {"TATAMOTORS": "TMPV"}

SERIES = "#2a78d6"
SURFACE = "#fcfcfb"
INK = "#0b0b0b"
INK_MUTED = "#898781"
GRID = "#e1e0d9"


def load_symbols() -> tuple[list[str], dict[str, str]]:
    """NSE tickers -> Yahoo symbols, applying known renames."""
    universe = sorted(json.loads(UNIVERSE.read_text()))
    mapping = {t: f"{RENAMES.get(t, t)}.NS" for t in universe}
    return universe, mapping


def fetch_closes(symbols: list[str]) -> pd.DataFrame:
    """Daily auto-adjusted closes for `symbols`."""
    raw = yf.download(
        symbols,
        start=START,
        end=END,
        interval="1d",
        auto_adjust=True,
        progress=False,
        threads=False,
    )
    if raw is None or raw.empty:
        raise SystemExit("yfinance returned no data - check the network.")

    closes = raw["Close"] if isinstance(raw.columns, pd.MultiIndex) else raw[["Close"]]
    closes.index.name = "Date"
    return closes


def plot_closes(closes: pd.DataFrame) -> None:
    """One small panel per ticker - a whole-universe eyeball test.

    At 100 panels the tick labels would be illegible, so they are dropped:
    the job here is spotting broken shapes (flat lines, cliffs, stubs), which
    reads fine from the curve alone.
    """
    tickers = list(closes.columns)
    ncols = 10
    nrows = math.ceil(len(tickers) / ncols)

    fig, axes = plt.subplots(nrows, ncols, figsize=(ncols * 2.2, nrows * 1.7))
    fig.patch.set_facecolor(SURFACE)
    flat = axes.flatten()

    for ax, ticker in zip(flat, tickers):
        series = closes[ticker].dropna()
        ax.set_facecolor(SURFACE)
        if not series.empty:
            ax.plot(series.index, series, color=SERIES, linewidth=1.1)
        ax.set_title(ticker, color=INK, fontsize=8, fontweight="bold", pad=3)
        ax.grid(True, color=GRID, linewidth=0.5)
        ax.set_axisbelow(True)
        for side in ("top", "right", "left", "bottom"):
            ax.spines[side].set_visible(False)
        ax.set_xticks([])
        ax.set_yticks([])

    for i in range(len(tickers), flat.size):
        flat[i].set_visible(False)

    fig.suptitle(
        f"Daily close {START} to {END} (auto-adjusted) - {len(tickers)} tickers",
        color=INK, fontsize=15, fontweight="bold", x=0.01, ha="left",
    )
    fig.tight_layout(rect=(0, 0, 1, 0.98))
    PNG_OUT.parent.mkdir(parents=True, exist_ok=True)
    # 110 dpi, not the 300 the rest of the set uses: this is 100 panels of
    # eyeball test rather than a figure anyone reads values off.
    fig.savefig(PNG_OUT, dpi=110, facecolor=SURFACE)
    plt.close(fig)


def main() -> int:
    universe, mapping = load_symbols()
    print(f"Universe: {len(universe)} tickers from {UNIVERSE.relative_to(ROOT)}")
    for src, dst in RENAMES.items():
        print(f"  rename: {src} -> {dst} (Yahoo no longer serves the old symbol)")

    closes = fetch_closes(sorted(mapping.values()))

    # Map Yahoo symbols back to NSE tickers, keeping the universe order.
    out = pd.DataFrame(index=closes.index)
    never_fetched: list[str] = []
    for ticker in universe:
        symbol = mapping[ticker]
        if symbol in closes.columns and not closes[symbol].isna().all():
            out[ticker] = closes[symbol]
        else:
            never_fetched.append(ticker)

    out.index.name = "Date"
    out.to_csv(CSV_OUT)
    plot_closes(out)

    rows, cols = out.shape
    print(f"\nShape: {rows} rows x {cols} columns")
    print(f"Date range: {out.index.min().date()} -> {out.index.max().date()}")

    missing = out.isna().sum()
    incomplete = missing[missing > 0].sort_values(ascending=False)
    print(f"\nTickers with a complete series: {(missing == 0).sum()} / {cols}")
    if not incomplete.empty:
        print(f"Tickers with gaps ({len(incomplete)}):")
        for ticker, n in incomplete.items():
            print(f"    {ticker:12} {n:4} missing of {rows}")

    if never_fetched:
        print(f"\nNo data at all ({len(never_fetched)}): "
              f"{', '.join(never_fetched)}")
        print("  (renamed, delisted or suspended - Stage 5 logs these)")

    # auto_adjust handles splits and dividends but not demergers. Flag every
    # one-day move beyond 25% as a CANDIDATE for review -- the threshold cannot
    # tell a corporate action from a genuine shock, and over this window it
    # catches both: Raymond and Tata Motors are demerger artifacts, while the
    # 2020-03-23 cluster is the real COVID crash low and ZEEL's jump is real
    # merger news. Only the first kind needs repairing.
    breaks = []
    for ticker in out.columns:
        moves = out[ticker].pct_change().dropna()
        if moves.empty:
            continue
        worst = moves.abs().idxmax()
        if abs(moves.loc[worst]) > 0.25:
            breaks.append((ticker, moves.loc[worst], worst.date()))
    if breaks:
        print(f"\nLarge single-day moves ({len(breaks)}) - review for corporate "
              f"actions; genuine shocks appear here too:")
        for ticker, move, when in sorted(breaks, key=lambda b: b[1]):
            print(f"    {ticker:12} {move * 100:+7.2f}% on {when}")

    print(f"\nWrote {CSV_OUT.name} and {PNG_OUT.name} to {HERE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
