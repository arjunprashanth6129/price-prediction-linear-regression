#!/usr/bin/env python3
"""Stage 6: every strategy figure, drawn from the JSON that stages 3-5 wrote.

Uses the same style module as the regression study (scripts/ml/figstyle.py):
blue for the strategy and for positive values, orange for negative values,
neutral greys for benchmarks, so the two figure sets read as one system.

    python3 scripts/strategy/06_figures.py      -> docs/figures/strategy-*.png
"""
import json
import sys

from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / "scripts" / "ml"))
import config as C  # noqa: E402
import figstyle as fs  # noqa: E402
from figstyle import (AXIS, BLUE, GRID, INK_MUTED, INK_SECONDARY, ORANGE,  # noqa: E402
                      SURFACE)

fs.use_style()

import matplotlib.pyplot as plt  # noqa: E402
import matplotlib.ticker as mtick  # noqa: E402

DATA = ROOT / "data" / "strategy"
OUT = ROOT / "docs" / "figures"
BT = json.loads((DATA / "backtest.json").read_text())
RB = json.loads((DATA / "robustness.json").read_text())
DEV = json.loads((DATA / "signals-dev.json").read_text())
P = BT["primary"]
LABEL = {P: "Strategy (composite, top quintile)", "EW": "Equal-weight universe",
         "NIFTY500": "Nifty 500 (price index)"}
HOLDOUT_SHADE = "#efeee9"


def monthly(name: str) -> pd.Series:
    idx = pd.PeriodIndex(BT["months"], freq="M").to_timestamp(how="end")
    return pd.Series(BT["monthly"][name], idx)


def shade_holdout(ax) -> None:
    if not BT["holdoutUnlocked"]:
        return
    a = pd.Period(C.HOLDOUT_START, "M").start_time
    ax.axvspan(a, monthly(P).index.max(), color=HOLDOUT_SHADE, zorder=0, lw=0)
    ax.text(a, 1.0, "  holdout", transform=ax.get_xaxis_transform(), va="top",
            ha="left", color=INK_MUTED, fontsize=8.5)


def equity() -> None:
    fig, ax = plt.subplots(figsize=(9, 4.8))
    fs.style(ax)
    shade_holdout(ax)
    styles = {P: (BLUE, 2.0, "-"), "EW": (INK_SECONDARY, 1.4, "-"),
              "NIFTY500": (INK_MUTED, 1.4, (0, (4, 3)))}
    for name, (color, lw, ls) in styles.items():
        nav = (1 + monthly(name)).cumprod()
        ax.plot(nav.index, nav, color=color, lw=lw, ls=ls, label=LABEL[name])
        ax.annotate(f"{nav.iloc[-1]:.1f}x", (nav.index[-1], nav.iloc[-1]),
                    xytext=(4, 0), textcoords="offset points", va="center",
                    color=INK_SECONDARY, fontsize=8.5)
    ax.set_yscale("log")
    ax.yaxis.set_major_formatter(mtick.FuncFormatter(lambda v, _: f"{v:g}x"))
    ax.set_ylabel("Growth of one rupee, net of costs (log scale)")
    fs.title(ax, "The strategy against its benchmarks",
             "Monthly rebalance, one-session execution lag, Indian delivery costs. The "
             "equal-weight universe shares the strategy's survivorship bias; the index does not.")
    fs.legend(ax, loc="upper left")
    fs.save(fig, OUT / "strategy-equity.png")


def drawdowns() -> None:
    fig, ax = plt.subplots(figsize=(9, 3.6))
    fs.style(ax)
    shade_holdout(ax)
    for name, color, lw in ((P, BLUE, 1.8), ("EW", INK_SECONDARY, 1.3)):
        nav = (1 + monthly(name)).cumprod()
        dd = nav / nav.cummax() - 1
        ax.plot(dd.index, dd, color=color, lw=lw, label=LABEL[name])
    ax.yaxis.set_major_formatter(mtick.PercentFormatter(1.0, decimals=0))
    ax.set_ylabel("Drawdown from previous peak")
    fs.title(ax, "Drawdowns", "Month-end values, net of costs.")
    fs.legend(ax, loc="lower left")
    fs.save(fig, OUT / "strategy-drawdowns.png")


def quintiles() -> None:
    periods = [k for k in ("development", "holdout") if k in RB["quintiles"]]
    fig, axes = plt.subplots(1, len(periods), figsize=(4.6 * len(periods), 3.8),
                             sharey=True, squeeze=False)
    for ax, k in zip(axes[0], periods):
        fs.style(ax, grid_axis="y")
        vals = np.array(RB["quintiles"][k]) * 100
        x = np.arange(1, len(vals) + 1)
        ax.bar(x, vals, width=0.62, color=[BLUE if v >= 0 else ORANGE for v in vals])
        for xi, v in zip(x, vals):
            ax.annotate(f"{v:.2f}%", (xi, v), xytext=(0, 3), textcoords="offset points",
                        ha="center", color=INK_SECONDARY, fontsize=8.5)
        ax.set_xticks(x, [f"Q{i}" for i in x])
        ax.set_xlabel("Quintile of the composite score (Q5 highest)")
        a, b = BT["periods"][k]
        ax.set_title(f"{k.capitalize()}, {a} to {b}", loc="left", fontsize=10.5)
    axes[0][0].set_ylabel("Mean return over the next month, %")
    fig.suptitle("Next-month return by score quintile", x=0.01, ha="left",
                 fontweight="bold", fontsize=13)
    fig.text(0.01, 0.9, "Equal weight within each quintile, before costs.",
             color=INK_MUTED, fontsize=9.5)
    fig.tight_layout(rect=(0, 0, 1, 0.89))
    fs.save(fig, OUT / "strategy-quintiles.png")


def ic_series() -> None:
    ic = pd.Series(RB["icSeries"])
    ic.index = pd.PeriodIndex(ic.index, freq="M").to_timestamp(how="end")
    fig, ax = plt.subplots(figsize=(9, 3.6))
    fs.style(ax, grid_axis="y")
    shade_holdout(ax)
    ax.bar(ic.index, ic, width=20, color=[BLUE if v >= 0 else ORANGE for v in ic])
    roll = ic.rolling(12).mean()
    ax.plot(roll.index, roll, color=INK_SECONDARY, lw=1.6, label="12-month mean")
    ax.axhline(0, color=AXIS, lw=0.8)
    ax.set_ylabel("Rank IC")
    fs.title(ax, "Monthly rank IC of the composite score",
             "Spearman correlation across eligible stocks between the score and the next "
             "month's return.")
    fs.legend(ax, loc="lower left")
    fs.save(fig, OUT / "strategy-ic.png")


def selection() -> None:
    sig = DEV["signals"]
    names = list(sig)
    t = np.array([sig[n]["icT"] for n in names])
    order = np.argsort(t)
    fig, ax = plt.subplots(figsize=(7.5, 4.4))
    fs.style(ax, grid_axis="x")
    for i, j in enumerate(order):
        chosen = sig[names[j]]["selected"]
        color = (BLUE if t[j] >= 0 else ORANGE) if chosen else GRID
        ax.barh(i, t[j], height=0.62, color=color)
        ax.annotate(f"{t[j]:+.2f}", (t[j], i), xytext=(4 if t[j] >= 0 else -4, 0),
                    textcoords="offset points", va="center",
                    ha="left" if t[j] >= 0 else "right", color=INK_SECONDARY, fontsize=8.5)
    for edge in (-C.IC_T_THRESHOLD, C.IC_T_THRESHOLD):
        ax.axvline(edge, color=INK_MUTED, lw=1, ls=(0, (3, 3)))
    ax.axvline(0, color=AXIS, lw=0.8)
    ax.set_yticks(range(len(names)), [names[j] for j in order])
    ax.set_xlabel("Newey-West t-statistic of the mean monthly rank IC")
    ax.set_xlim(-3.6, 3.6)
    fs.title(ax, "Signal selection on the development period",
             f"Signals beyond |t| = {C.IC_T_THRESHOLD:g} (dashed) were selected, coloured by "
             "sign; grey bars were not. Signal dates Jan 2006 to Oct 2018.")
    fs.save(fig, OUT / "strategy-signal-selection.png")


def costs() -> None:
    period = "full" if "full" in RB["costs"]["1.0"] else "development"
    mults = sorted(RB["costs"], key=float)
    x = [float(m) for m in mults]
    fig, ax = plt.subplots(figsize=(7.5, 4))
    fs.style(ax)
    for key, color, label in (("activeReturn", BLUE, "Return over the equal-weight universe"),
                              ("alpha", INK_SECONDARY, "Alpha against the equal-weight universe")):
        y = [RB["costs"][m][period][key] for m in mults]
        ax.plot(x, y, color=color, lw=2, marker="o", ms=5, label=label)
    ax.axhline(0, color=AXIS, lw=0.8)
    ax.axvline(1, color=INK_MUTED, lw=1, ls=(0, (3, 3)))
    ax.annotate("base schedule", (1, 1), xycoords=("data", "axes fraction"), xytext=(4, -12),
                textcoords="offset points", color=INK_MUTED, fontsize=8.5)
    ax.yaxis.set_major_formatter(mtick.PercentFormatter(1.0, decimals=0))
    ax.xaxis.set_major_formatter(mtick.FuncFormatter(lambda v, _: f"{v:g}x"))
    ax.set_xlabel("Multiple of the cost schedule (the benchmark pays the same multiple)")
    ax.set_ylabel("Per year")
    a, b = BT["periods"][period]
    fs.title(ax, "How much cost the result can absorb", f"{a} to {b}.")
    fs.legend(ax, loc="upper right")
    fs.save(fig, OUT / "strategy-costs.png")


def random_portfolios() -> None:
    periods = [k for k in ("development", "holdout") if k in RB["random"]]
    fig, axes = plt.subplots(1, len(periods), figsize=(4.6 * len(periods), 3.6), squeeze=False)
    for ax, k in zip(axes[0], periods):
        fs.style(ax, grid_axis="y")
        r = RB["random"][k]
        ax.hist(r["sharpes"], bins=40, color=AXIS, edgecolor=SURFACE, linewidth=0.6)
        ax.axvline(r["strategyGrossSharpe"], color=BLUE, lw=2)
        ax.annotate(f"strategy {r['strategyGrossSharpe']:.2f}\nbeats {r['percentile']:.0%}",
                    (r["strategyGrossSharpe"], 1), xycoords=("data", "axes fraction"),
                    xytext=(-4, -4), textcoords="offset points", ha="right", va="top",
                    color=INK_SECONDARY, fontsize=8.5)
        a, b = BT["periods"][k]
        ax.set_title(f"{k.capitalize()}, {a} to {b}", loc="left", fontsize=10.5)
        ax.set_xlabel("Sharpe ratio before costs")
    axes[0][0].set_ylabel("Random portfolios")
    fig.suptitle(f"The strategy against {C.N_RANDOM:,} random portfolios", x=0.01,
                 ha="left", fontweight="bold", fontsize=13)
    fig.text(0.01, 0.885, "Same size, drawn from the same eligible stocks each month.",
             color=INK_MUTED, fontsize=9.5)
    fig.tight_layout(rect=(0, 0, 1, 0.87))
    fs.save(fig, OUT / "strategy-random-portfolios.png")


def by_year() -> None:
    yrs = RB["byYear"]
    years = list(yrs)
    x = np.arange(len(years))
    fig, ax = plt.subplots(figsize=(10, 3.8))
    fs.style(ax, grid_axis="y")
    ax.bar(x - 0.2, [yrs[y]["primary"] for y in years], width=0.38, color=BLUE,
           label=LABEL[P])
    ax.bar(x + 0.2, [yrs[y]["EW"] for y in years], width=0.38, color=AXIS,
           label=LABEL["EW"])
    ax.axhline(0, color=INK_MUTED, lw=0.8)
    ax.set_xticks(x, [f"\u2019{y[2:]}" + ("*" if y == years[0] else "") for y in years])
    ax.yaxis.set_major_formatter(mtick.PercentFormatter(1.0, decimals=0))
    fs.title(ax, "Calendar-year returns, net of costs",
             f"* {years[0]} starts in {pd.Period(C.EVAL_START, 'M').strftime('%B')}"
             f"{'; 2026 ends in June' if years[-1] == '2026' else ''}.")
    fs.legend(ax, loc="upper right")
    fs.save(fig, OUT / "strategy-by-year.png")


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    for fig in (equity, drawdowns, quintiles, ic_series, selection, costs,
                random_portfolios, by_year):
        fig()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
