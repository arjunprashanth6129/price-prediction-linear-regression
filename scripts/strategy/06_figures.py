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

import data  # noqa: E402

_, DATA, PREFIX = data.outputs()
OUT = ROOT / "docs" / "figures"
BT = json.loads((DATA / "backtest.json").read_text())
RB = json.loads((DATA / "robustness.json").read_text())
DEV = json.loads((DATA / "signals-dev.json").read_text())
P = BT["primary"]
LABEL = {P: "Strategy (composite, top quintile)", "EW": "Equal-weight universe",
         "NIFTY500": data.INDEX_LABELS["NIFTY500"]}
EQUITY_NOTE = ("equal-weight universe shares the strategy's survivorship bias; the index does not."
               if data.SOURCE == "survivor" else
               "universe is rebuilt each month from every NSE stock trading then, including "
               "those that later failed.")
HOLDOUT_SHADE = "#efeee9"


RESULTS = data.outputs()[0]
MONTHLY = pd.read_csv(RESULTS / "monthly_returns.csv", index_col="month")
MONTHLY.index = pd.PeriodIndex(MONTHLY.index, freq="M").to_timestamp(how="end")
NAMES = {"MOM_12_1": "12-1 momentum", "HIGH52": "Near 52-week high", "TREND_5": "5-day trend",
         "TREND_20": "20-day trend", "TREND_50": "50-day trend", "TREND_100": "100-day trend",
         "TREND_200": "200-day trend", "LOWVOL": "Low volatility", "REV_1M": "1-month reversal",
         "VOLSHOCK": "Volume surge"}


def monthly(name: str) -> pd.Series:
    return MONTHLY[name]


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
    if "NIFTY500_MOM50" in MONTHLY:
        styles["NIFTY500_MOM50"] = (ORANGE, 1.3, (0, (1, 1.5)))
        LABEL["NIFTY500_MOM50"] = data.INDEX_LABELS["NIFTY500_MOM50"]
    ends = []
    for name, (color, lw, ls) in styles.items():
        nav = (1 + monthly(name)).cumprod()
        ax.plot(nav.index, nav, color=color, lw=lw, ls=ls, label=LABEL[name])
        ends.append((nav.iloc[-1], nav.index[-1]))
    # Spread the end labels so close finishes do not print on top of each other.
    ends.sort()
    for i, (v, d) in enumerate(ends):
        ax.annotate(f"{v:.1f}x", (d, v), xytext=(5, (i - (len(ends) - 1) / 2) * 3),
                    textcoords="offset points", va="center", color=INK_SECONDARY, fontsize=8.5)
    ax.set_yscale("log")
    ax.yaxis.set_major_formatter(mtick.FuncFormatter(lambda v, _: f"{v:g}x"))
    ax.set_ylabel("Growth of one rupee, net of costs (log scale)")
    fs.title(ax, "The strategy against its benchmarks",
             "Monthly rebalance, one-session execution lag, Indian delivery costs. The "
             + EQUITY_NOTE)
    fs.legend(ax, loc="upper left")
    fs.save(fig, OUT / f"{PREFIX}equity.png")


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
    fs.save(fig, OUT / f"{PREFIX}drawdowns.png")


def quintiles() -> None:
    k = "full" if "full" in RB["quintiles"] else "development"
    fig, ax = plt.subplots(figsize=(7.2, 4))
    fs.style(ax, grid_axis="y")
    vals = np.array(RB["quintiles"][k]) * 100
    x = np.arange(1, len(vals) + 1)
    ax.bar(x, vals, width=0.62, color=[AXIS] * (len(vals) - 1) + [BLUE])
    for xi, v in zip(x, vals):
        ax.annotate(f"{v:.2f}%", (xi, v), xytext=(0, 4), textcoords="offset points",
                    ha="center", color=INK_SECONDARY, fontsize=9.5)
    ax.set_xticks(x, ["Q1\nlowest score", "Q2", "Q3", "Q4", "Q5\nheld by the strategy"])
    ax.set_ylim(0, vals.max() * 1.18)
    ax.set_ylabel("Mean return over the next month, %")
    a, b = BT["periods"][k]
    fs.title(ax, "Higher score, higher next-month return",
             f"Equal weight within each quintile of the score, before costs, {a} to {b}.")
    fs.save(fig, OUT / f"{PREFIX}quintiles.png")


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
    fs.save(fig, OUT / f"{PREFIX}ic.png")


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
        ax.annotate(f"{t[j]:+.2f}".replace("-", "−"), (t[j], i),
                    xytext=(5 if t[j] >= 0 else -5, 0), textcoords="offset points",
                    va="center", ha="left" if t[j] >= 0 else "right", zorder=4,
                    color=INK_SECONDARY, fontsize=8.5,
                    bbox=dict(boxstyle="square,pad=0.15", fc=SURFACE, ec="none"))
    for edge in (-C.IC_T_THRESHOLD, C.IC_T_THRESHOLD):
        ax.axvline(edge, color=INK_MUTED, lw=1, ls=(0, (3, 3)), zorder=1)
    ax.axvline(0, color=AXIS, lw=0.8)
    ax.set_yticks(range(len(names)), [NAMES[names[j]] for j in order])
    ax.set_xlabel("Newey-West t-statistic of the mean monthly rank IC")
    lim = np.ceil(np.abs(t).max() + 0.9)
    ax.set_xlim(-lim, lim)
    note = ("" if data.SOURCE == "survivor" else
            " Reported only: the strategy keeps the four signals chosen in the first study.")
    fs.title(ax, "Signal selection on the development period",
             f"Signals beyond |t| = {C.IC_T_THRESHOLD:g} (dashed) are selected, coloured by "
             "sign; grey bars are not. Signal dates Jan 2006 to Oct 2018." + note)
    fs.save(fig, OUT / f"{PREFIX}signal-selection.png")


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
    fs.save(fig, OUT / f"{PREFIX}costs.png")


def random_portfolios() -> None:
    k = "full" if "full" in RB["random"] else "development"
    r = RB["random"][k]
    fig, ax = plt.subplots(figsize=(7.2, 3.8))
    fs.style(ax, grid_axis="y")
    ax.hist(r["sharpes"], bins=30, color=AXIS, edgecolor=SURFACE, linewidth=0.6)
    s = r["strategyGrossSharpe"]
    ax.axvline(s, color=BLUE, lw=2.2)
    ax.annotate(f"strategy\n{s:.2f}", (s, 1), xycoords=("data", "axes fraction"),
                xytext=(-6, -4), textcoords="offset points", ha="right", va="top",
                color=BLUE, fontsize=9.5)
    ax.set_xlim(min(r["sharpes"]) - 0.05, s + 0.08)
    ax.set_xlabel("Sharpe ratio before costs")
    ax.set_ylabel("Random portfolios")
    a, b = BT["periods"][k]
    fs.title(ax, f"Better than all {C.N_RANDOM:,} random portfolios",
             f"Same number of stocks, drawn at random from the same eligible stocks each "
             f"month, {a} to {b}.")
    fs.save(fig, OUT / f"{PREFIX}random-portfolios.png")


def survivorship() -> None:
    """The same strategy on three universes (pit run only: it needs all three)."""
    path = data.ROOT / "data" / "strategy" / "survivorship.json"
    if data.SOURCE != "pit" or not path.exists():
        return
    import json as _json
    runs = _json.loads(path.read_text())["runs"]
    rows = [("Today's Nifty 500\nYahoo prices", runs["survivor"]),
            ("Today's Nifty 500\nNSE prices", runs["pit-survivors"]),
            ("Every stock trading\nat the time, NSE", runs["pit"])]
    y = np.arange(len(rows))[::-1].astype(float)
    fig, ax = plt.subplots(figsize=(8.2, 3.9))
    fs.style(ax, grid_axis="x")
    for yi, (lab, r) in zip(y, rows):
        s, e = 100 * r["full"]["cagr"], 100 * r["full"]["ewCagr"]
        ax.barh(yi + 0.19, s, height=0.36, color=BLUE)
        ax.barh(yi - 0.19, e, height=0.36, color=AXIS)
        ax.annotate(f"{s:.1f}%", (s, yi + 0.19), xytext=(4, 0), textcoords="offset points",
                    va="center", fontsize=9, color=INK_SECONDARY)
        ax.annotate(f"{e:.1f}%", (e, yi - 0.19), xytext=(4, 0), textcoords="offset points",
                    va="center", fontsize=9, color=INK_SECONDARY)
        ax.text(45, yi, f"+{s - e:.1f}", va="center", ha="right", fontsize=10.5,
                color=BLUE, fontweight="bold")
    ax.text(45, y[0] + 0.55, "gap", va="bottom", ha="right", fontsize=9, color=INK_MUTED)
    ax.set_yticks(y, [lab for lab, _ in rows])
    ax.set_xlim(0, 46)
    ax.set_ylim(-0.6, y[0] + 0.85)
    ax.xaxis.set_major_formatter(mtick.FuncFormatter(lambda v, _: f"{v:.0f}%"))
    ax.set_xlabel("Compound annual return, March 2009 to June 2026, net of costs")
    from matplotlib.patches import Patch
    ax.legend(handles=[Patch(color=BLUE, label="Strategy"),
                       Patch(color=AXIS, label="Equal-weight universe")],
              loc="lower right", bbox_to_anchor=(0.9, 0.0), frameon=False, fontsize=9)
    fs.title(ax, "Survivorship bias moved both bars, not the gap",
             "The same strategy and its benchmark on three universes. Dropping the stocks "
             "that later failed lowers both returns by about eight points a year.")
    fs.save(fig, OUT / f"{PREFIX}survivorship.png")


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
    fs.save(fig, OUT / f"{PREFIX}by-year.png")


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    for fig in (equity, drawdowns, quintiles, ic_series, selection, costs,
                random_portfolios, by_year, survivorship):
        fig()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
