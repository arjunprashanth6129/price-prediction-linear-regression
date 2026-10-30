#!/usr/bin/env python3
"""Stage 8: the display fields the site needs, in one small file.

Reads what stages 3 to 7 committed and writes data/strategy/site.json. Nothing
is recomputed: every value is copied or summed from those outputs, so the site
shows exactly the numbers in the results files and the paper.

    python3 scripts/strategy/08_site_data.py
"""
import json
import sys

from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
import config as C  # noqa: E402
import data  # noqa: E402

OUT = ROOT / "data" / "strategy" / "site.json"
P = C.PRIMARY
SIGNAL_LABELS = {
    "MOM_12_1": "12-1 momentum", "HIGH52": "Near 52-week high",
    "TREND_5": "5-day trend", "TREND_20": "20-day trend", "TREND_50": "50-day trend",
    "TREND_100": "100-day trend", "TREND_200": "200-day trend", "LOWVOL": "Low volatility",
    "REV_1M": "1-month reversal", "VOLSHOCK": "Volume surge",
}


def load(source: str) -> dict:
    res, dat, _ = data.outputs(source)
    return {"bt": json.loads((dat / "backtest.json").read_text()),
            "rb": json.loads((dat / "robustness.json").read_text()),
            "monthly": pd.read_csv(res / "monthly_returns.csv", index_col="month")}


def r(x, d=6):
    return None if x is None or (isinstance(x, float) and not np.isfinite(x)) else round(float(x), d)


def headline(run: dict) -> dict:
    out = {}
    for period, block in run["bt"]["stats"].items():
        rows = block["rows"]
        s, ew = rows[P], rows["EW"]
        out[period] = {
            "cagr": r(s["cagr"]), "sharpe": r(s["sharpe"], 2), "maxDrawdown": r(s["maxDrawdown"]),
            "ewCagr": r(ew["cagr"]), "ewSharpe": r(ew["sharpe"], 2), "ewMaxDrawdown": r(ew["maxDrawdown"]),
            "nifty500Cagr": r(rows["NIFTY500"]["cagr"]), "nifty500Sharpe": r(rows["NIFTY500"]["sharpe"], 2),
            "nifty500MaxDrawdown": r(rows["NIFTY500"]["maxDrawdown"]),
            "activeReturn": r(s["activeReturn"]), "activeT": r(s["activeT"], 2),
            "alpha": r(s["alpha"]), "alphaT": r(s["alphaT"], 2), "dsr": r(s["dsr"], 2),
            "costDrag": r(s["costDrag"]), "turnover": r(s["turnover"], 2),
            "breakEven": r(s["breakEvenCostMultiple"], 1), "names": round(s["names"]),
        }
        if "NIFTY500_MOM50" in rows:
            out[period]["mom50Cagr"] = r(rows["NIFTY500_MOM50"]["cagr"])
            out[period]["mom50Sharpe"] = r(rows["NIFTY500_MOM50"]["sharpe"], 2)
            out[period]["mom50MaxDrawdown"] = r(rows["NIFTY500_MOM50"]["maxDrawdown"])
    return out


def growth(monthly: pd.DataFrame, cols: dict) -> dict:
    return {k: [r(v, 3) for v in (1 + monthly[c]).cumprod()] for k, c in cols.items()}


def drawdown(monthly: pd.DataFrame, cols: dict) -> dict:
    """Fall from the previous month-end peak, as in the paper's growth figure, Panel B."""
    out = {}
    for k, c in cols.items():
        g = (1 + monthly[c]).cumprod()
        out[k] = [r(v, 4) for v in g / g.cummax() - 1]
    return out


def main() -> int:
    pit, surv = load("pit"), load("survivor")
    sv = json.loads((ROOT / "data" / "strategy" / "survivorship.json").read_text())
    dev_surv = json.loads((ROOT / "data" / "strategy" / "signals-dev.json").read_text())
    dev_pit = json.loads((ROOT / "data" / "strategy" / "pit" / "signals-dev.json").read_text())
    dq = json.loads((ROOT / "data" / "strategy" / "pit" / "data_quality.json").read_text())
    rb = pit["rb"]

    months = list(pit["monthly"].index)
    assert months == list(surv["monthly"].index)

    sharpes = np.array(rb["random"]["full"]["sharpes"])
    edges = np.round(np.arange(np.floor(sharpes.min() * 100) / 100, sharpes.max() + 0.01, 0.01), 2)
    counts, _ = np.histogram(sharpes, bins=edges)

    labels = {"survivor": "Today's Nifty 500, Yahoo", "pit-survivors": "Today's Nifty 500, NSE",
              "pit": "Every stock trading then, NSE"}
    site = {
        "periods": pit["bt"]["periods"],
        "headline": {"pit": headline(pit), "survivor": headline(surv)},
        "growth": {
            "months": months,
            "pit": growth(pit["monthly"], {"strategy": P, "ew": "EW", "nifty500": "NIFTY500",
                                           "mom50": "NIFTY500_MOM50", "nifty500ew": "NIFTY500_EW"}),
            "survivor": growth(surv["monthly"], {"strategy": P, "ew": "EW"}),
        },
        "drawdown": drawdown(pit["monthly"], {"strategy": P, "ew": "EW"}),
        "survivorship": [
            {"key": k, "label": labels[k], "cagr": r(v["full"]["cagr"]),
             "ewCagr": r(v["full"]["ewCagr"]), "activeReturn": r(v["full"]["activeReturn"]),
             "activeT": r(v["full"]["activeT"], 2),
             "ewVsIndex": r(v["ewAgainstNifty500EW"]["ewCagr"] - v["ewAgainstNifty500EW"]["indexCagr"])}
            for k, v in sv["runs"].items()],
        "signals": [
            {"key": k, "label": SIGNAL_LABELS[k], "t": r(v["icT"], 2), "selected": bool(v["selected"]),
             "tNse": r(dev_pit["signals"][k]["icT"], 2)}
            for k, v in sorted(dev_surv["signals"].items(), key=lambda kv: -kv[1]["icT"])],
        "random": {"edges": [r(e, 2) for e in edges], "counts": counts.tolist(),
                   "strategy": r(rb["random"]["full"]["strategyGrossSharpe"], 2),
                   "p95": r(rb["random"]["full"]["randomSharpe95"], 2),
                   "n": int(len(sharpes))},
        "skill": {p: {"ic": r(rb["ic"][p]["meanIC"]), "icT": r(rb["ic"][p]["t"], 2),
                      "randomPct": r(rb["random"][p]["percentile"], 3),
                      "placeboPct": r(rb["placebo"][p]["percentile"], 3),
                      "canary": r(rb["canary"][p]["forwardReturnSharpe"], 1)} for p in rb["ic"]},
        "factors": {"activeAlpha": r(rb["attribution"]["full"]["active"]["alpha"]),
                    "activeAlphaT": r(rb["attribution"]["full"]["active"]["alphaT"], 2),
                    "activeWml": r(rb["attribution"]["full"]["active"]["WML"], 2),
                    "wmlCorr": r(rb["wmlCheck"]["corr"], 3)},
        "terciles": [{"label": lab, "alpha": r(rb["byTercile"][str(i)]["full"]["alpha"]),
                      "alphaT": r(rb["byTercile"][str(i)]["full"]["alphaT"], 2),
                      "active": r(rb["byTercile"][str(i)]["full"]["activeReturn"]),
                      "activeT": r(rb["byTercile"][str(i)]["full"]["activeT"], 2)}
                     for i, lab in enumerate(["Most liquid", "Middle", "Least liquid"])],
        "universeSize": [{"label": lab, "active": r(sv["sensitivity"][k]["full"]["activeReturn"]
                                                   if k else sv["runs"]["pit"]["full"]["activeReturn"]),
                          "activeT": r(sv["sensitivity"][k]["full"]["activeT"]
                                       if k else sv["runs"]["pit"]["full"]["activeT"], 2)}
                         for lab, k in [("Top 200", "top 200"), ("Top 500", None),
                                        ("Top 1,000", "top 1000")]],
        "byYear": [{"year": y, "strategy": r(v["primary"]), "ew": r(v["EW"])}
                   for y, v in rb["byYear"].items()],
        "costs": [{"mult": float(m), "active": r(v["full"]["activeReturn"])}
                  for m, v in rb["costs"].items()],
        "quintiles": [r(x, 5) for x in rb["quintiles"]["full"]],
        "data": {"stocksEver": dq["coverage"]["everEligible"], "perMonth": 400,
                 "yahooWithin1pct": r(dq["againstYahoo"]["2010-2026"]["within1pct"], 3),
                 "exitsInUniverse": dq["exits"]["everEligible"], "exits": sv["exitCensus"]},
    }
    OUT.write_text(json.dumps(site, separators=(",", ":")) + "\n")
    print(f"{OUT.relative_to(ROOT)}: {OUT.stat().st_size:,} bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
