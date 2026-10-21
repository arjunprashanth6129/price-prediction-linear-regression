#!/usr/bin/env python3
"""Stage 7: how much of the first study was survivorship bias.

Three runs of the same frozen strategy, each written by stages 4 and 5 under
its own STRATEGY_SOURCE:

    survivor        Yahoo data, today's Nifty 500 names (the first study)
    pit-survivors   NSE data, today's Nifty 500 names
    pit             NSE data, every stock trading at each date

survivor -> pit-survivors is the change of data source; pit-survivors -> pit
is the survivorship bias. This stage sets them side by side and adds the
pre-registered sensitivity runs of the pit result: the exit-return bounds
(config.PIT_EXIT_BOUNDS) and universes of 200 and 1,000 stocks
(config.PIT_TOP_N_SENSITIVITY). None of them was used to choose anything.

    python3 scripts/strategy/07_survivorship.py
"""
import importlib.util
import json
import sys

from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
import config as C  # noqa: E402
import data  # noqa: E402
import engine as E  # noqa: E402
import metrics as M  # noqa: E402
import models  # noqa: E402

_spec = importlib.util.spec_from_file_location("bt", HERE / "04_backtest.py")
bt = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bt)

REPORT = ROOT / "results" / "strategy" / "survivorship.md"
JSON_OUT = ROOT / "data" / "strategy" / "survivorship.json"
RUNS = {"survivor": "Yahoo, today's Nifty 500 (first study)",
        "pit-survivors": "NSE, today's Nifty 500",
        "pit": "NSE, every stock trading at the time"}
P = C.PRIMARY
assert P == "M2", "the sensitivity runs below rebuild the composite directly"


def load(source: str) -> tuple[dict, dict]:
    _, d, _ = data.outputs(source)
    return (json.loads((d / "backtest.json").read_text()),
            json.loads((d / "robustness.json").read_text()))


def strategy_and_ew(panel: data.Panel, rf: pd.Series) -> dict:
    """The primary and EW on one panel, summarised by period."""
    idx = panel.adj.index
    dates, z, elig, terc, fwd = bt.build(panel)
    start = dates[dates < pd.Period(C.EVAL_START, "M").start_time].max()
    score = models.composite(z, C.SELECTED)
    prim = E.simulate(bt.live(E.quantile_weights(score), start), panel.returns, terc)
    ew = E.simulate(bt.live(E.equal_weights(elig), start), panel.returns, terc)
    end = idx.max().to_period("M")
    out = {}
    for k, (a, b) in bt.PERIODS.items():
        b = min(pd.Period(b, "M"), end).strftime("%Y-%m")
        s = M.summary(M.window(prim.net, a, b), rf, M.window(ew.net, a, b))
        e = M.summary(M.window(ew.net, a, b), rf)
        out[k] = {"cagr": s["cagr"], "sharpe": s["sharpe"], "ewCagr": e["cagr"],
                  "ewSharpe": e["sharpe"], "activeReturn": s["activeReturn"],
                  "activeT": s["activeT"], "alpha": s["alpha"], "alphaT": s["alphaT"]}
    return out


def main() -> int:
    runs = {s: load(s) for s in RUNS}
    tri = data.load_indices("pit")
    out: dict = {"runs": {}, "sensitivity": {}}

    for s, (b, r) in runs.items():
        block = {}
        for period, st in b["stats"].items():
            row, ew = st["rows"][P], st["rows"]["EW"]
            block[period] = {
                "cagr": row["cagr"], "sharpe": row["sharpe"], "maxDrawdown": row["maxDrawdown"],
                "ewCagr": ew["cagr"], "ewSharpe": ew["sharpe"],
                "activeReturn": row["activeReturn"], "activeT": row["activeT"],
                "alpha": row["alpha"], "alphaT": row["alphaT"], "dsr": row["dsr"],
                "costDrag": row["costDrag"],
                "factorAlphaActive": r["attribution"][period]["active"]["alpha"],
                "factorAlphaActiveT": r["attribution"][period]["active"]["alphaT"],
                "wmlActive": r["attribution"][period]["active"]["WML"],
                "randomPercentile": r["random"][period]["percentile"],
            }
        # The EW benchmark against NSE's equal-weight index, net of the same costs.
        months = pd.PeriodIndex(b["months"], freq="M")
        ew = pd.Series(b["monthly"]["EW"], index=months)
        lvl = tri["NIFTY500_EW"].dropna()
        im = lvl.groupby(lvl.index.to_period("M")).last().pct_change().reindex(months)
        yrs = len(ew) / 12
        block["ewAgainstNifty500EW"] = {
            "ewCagr": float((1 + ew).prod() ** (1 / yrs) - 1),
            "indexCagr": float((1 + im).prod() ** (1 / yrs) - 1),
            "corr": float(ew.corr(im)),
        }
        block["wmlCorr"] = r["wmlCheck"]["corr"]
        out["runs"][s] = block

    # ---- pre-registered sensitivity of the pit result ----
    iima = data.load_iima()
    for distress in C.PIT_EXIT_BOUNDS:
        panel = data.load_panel(source="pit", distress=distress)
        rf = M.risk_free(iima, pd.period_range(pd.Period(C.EVAL_START, "M"),
                                               panel.adj.index.max().to_period("M"), freq="M"))
        out["sensitivity"][f"distress {distress:+.0%}"] = strategy_and_ew(panel, rf)
    panel = data.load_panel(source="pit")
    for n in C.PIT_TOP_N_SENSITIVITY:
        p = data.Panel(adj=panel.adj, traded_value=panel.traded_value, traded=panel.traded,
                       industry=panel.industry, universe={**panel.universe, "top_n": n})
        out["sensitivity"][f"top {n}"] = strategy_and_ew(p, rf)

    # ---- which exits reached a portfolio ----
    # An exit return can only matter if the stock was held when it stopped
    # trading: in EW if it was eligible at the month-end before, in the
    # strategy if it was also in the top quintile.
    dates, z, elig, _, _ = bt.build(panel)
    held = E.quantile_weights(models.composite(z, C.SELECTED)) > 0
    exits = pd.DataFrame(panel.report["exits"], columns=["symbol", "last", "kind", "ret"])
    exits = exits[exits["last"] >= pd.Period(C.EVAL_START, "M").start_time]
    census = {"exits": 0, "inEW": 0, "inEWDistress": 0, "inStrategy": 0, "inStrategyDistress": 0}
    for e in exits.itertuples():
        before = dates[dates <= e.last]
        if not len(before) or e.symbol not in elig.columns:
            continue
        s = before[-1]
        census["exits"] += 1
        distress = e.kind.startswith("distress")
        if elig.loc[s, e.symbol]:
            census["inEW"] += 1
            census["inEWDistress"] += int(distress)
        if held.loc[s, e.symbol]:
            census["inStrategy"] += 1
            census["inStrategyDistress"] += int(distress)
    out["exitCensus"] = census

    JSON_OUT.write_text(json.dumps(out, indent=1) + "\n")

    L = ["# Survivorship: the same strategy on three universes", "",
         "Generated by `scripts/strategy/07_survivorship.py`. The strategy is the frozen primary "
         f"(`{P}`: the four selected signals, top quintile, long-only, net of costs) in every run; "
         "only the data and the universe change. The holdout of the first study had been seen "
         "before these runs, so the NSE runs are a replication on corrected data, not a new "
         "out-of-sample test.", ""]
    for period in ("development", "holdout", "full"):
        L += [f"## {period.capitalize()}", "",
              "| Universe | CAGR | Sharpe | EW CAGR | EW Sharpe | Over EW (t) | Alpha vs EW (t) | "
              "Four-factor alpha over EW (t) | WML loading over EW | DSR |",
              "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|"]
        for s, label in RUNS.items():
            v = out["runs"][s][period]
            L.append(f"| {label} | {v['cagr']:+.1%} | {v['sharpe']:.2f} | {v['ewCagr']:+.1%} | "
                     f"{v['ewSharpe']:.2f} | {v['activeReturn']:+.1%} ({v['activeT']:.2f}) | "
                     f"{v['alpha']:+.1%} ({v['alphaT']:.2f}) | {v['factorAlphaActive']:+.1%} "
                     f"({v['factorAlphaActiveT']:.2f}) | {v['wmlActive']:.2f} | {v['dsr']:.2f} |")
        L.append("")
    L += ["## The equal-weight benchmark against NSE's Nifty500 Equal Weight index", "",
          f"Monthly, {C.EVAL_START} to {C.EVAL_END}. The universe portfolio is net of costs; "
          "the index is a total return series on each date's actual members.", "",
          "| Universe | EW CAGR | Index CAGR | Gap a year | Correlation |", "|---|---:|---:|---:|---:|"]
    for s, label in RUNS.items():
        v = out["runs"][s]["ewAgainstNifty500EW"]
        L.append(f"| {label} | {v['ewCagr']:+.1%} | {v['indexCagr']:+.1%} | "
                 f"{v['ewCagr'] - v['indexCagr']:+.1%} | {v['corr']:.3f} |")
    L += ["", "## Pre-registered sensitivity of the survivorship-free result", "",
          "| Variant | Period | CAGR | Sharpe | EW CAGR | Over EW (t) | Alpha vs EW (t) |",
          "|---|---|---:|---:|---:|---:|---:|"]
    for name, block in out["sensitivity"].items():
        for period, v in block.items():
            L.append(f"| {name} | {period} | {v['cagr']:+.1%} | {v['sharpe']:.2f} | {v['ewCagr']:+.1%} | "
                     f"{v['activeReturn']:+.1%} ({v['activeT']:.2f}) | {v['alpha']:+.1%} ({v['alphaT']:.2f}) |")
    c = out["exitCensus"]
    L += ["", "## Exits that reached a portfolio", "",
          f"Of {c['exits']} stocks that stopped trading after {C.EVAL_START}, {c['inEW']} were in the "
          f"equal-weight benchmark at the month-end before ({c['inEWDistress']} classed as distress) "
          f"and {c['inStrategy']} were held by the strategy ({c['inStrategyDistress']} as distress). "
          "Failing companies leave the 500 most traded stocks before they stop trading, which is "
          "why the distress return barely moves the results."]
    REPORT.write_text("\n".join(L) + "\n")
    print("\n".join(L))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
