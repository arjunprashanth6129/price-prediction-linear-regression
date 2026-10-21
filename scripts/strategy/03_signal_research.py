#!/usr/bin/env python3
"""Stage 3: score every candidate signal on the development period and select.

For each candidate, on every signal date from January 2006 to the last whose
forward return ends by December 2018:

    rank IC        Spearman correlation, across eligible stocks, between the
                   signal and the return from the next fill to the fill one
                   month later
    IC decay       the same against 3, 6 and 12-month forward returns
    quintiles      the mean forward return of each signal quintile, equal
                   weight and before costs
    turnover       the share of the top quintile replaced each month

The selection rule in config.py is then applied: a signal enters the models if
the Newey-West t-statistic of its mean one-month IC is at least 2 in absolute
value, with the sign of that mean. The holdout lock keeps every price after
December 2018 out of this stage.

    python3 scripts/strategy/03_signal_research.py
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
import metrics as M  # noqa: E402
import signals as S  # noqa: E402

REPORT = ROOT / "results" / "strategy" / "signal_research.md"
JSON_OUT = ROOT / "data" / "strategy" / "signals-dev.json"


def rank_ic(score: pd.DataFrame, fwd: pd.DataFrame) -> pd.Series:
    """Cross-sectional Spearman correlation on each date."""
    ok = score.notna() & fwd.notna()
    a = score.where(ok).rank(axis=1)
    b = fwd.where(ok).rank(axis=1)
    a = a.sub(a.mean(axis=1), axis=0)
    b = b.sub(b.mean(axis=1), axis=0)
    ic = (a * b).sum(axis=1) / np.sqrt((a ** 2).sum(axis=1) * (b ** 2).sum(axis=1))
    return ic[ok.sum(axis=1) >= 30]


def quintile_returns(score: pd.DataFrame, fwd: pd.DataFrame) -> pd.DataFrame:
    ok = score.notna() & fwd.notna()
    q = np.ceil(score.where(ok).rank(axis=1, pct=True) * C.QUANTILES)
    out = {k: fwd.where(q == k).mean(axis=1) for k in range(1, C.QUANTILES + 1)}
    return pd.DataFrame(out).dropna()


def top_turnover(score: pd.DataFrame) -> float:
    top = score.rank(axis=1, pct=True) > 1 - 1 / C.QUANTILES
    stay = (top & top.shift(1, fill_value=False)).sum(axis=1)
    prev = top.shift(1, fill_value=False).sum(axis=1)
    return float((1 - stay / prev.replace(0, np.nan)).mean())


def main() -> int:
    assert not C.HOLDOUT_UNLOCKED, "signal research runs on the development period only"
    panel = data.load_panel()
    dates = S.signal_dates(panel.adj.index)
    raw = S.raw_signals(panel.adj, panel.traded_value, dates)
    elig, _ = S.eligibility(panel.adj, panel.traded, panel.traded_value, dates)
    z = {k: S.standardise(v, elig) for k, v in raw.items()}
    fwd = {h: S.forward_returns(panel.adj, dates, months=h).where(elig)
           for h in C.IC_HORIZONS}

    rows, ics, quint = {}, {}, {}
    for name in C.CANDIDATES:
        ic = {h: rank_ic(z[name], fwd[h]) for h in C.IC_HORIZONS}
        ics[name] = ic[1]
        mean, t = M.nw_mean(ic[1], C.NW_LAGS)
        qr = quintile_returns(z[name], fwd[1])
        quint[name] = qr.mean()
        spread = qr[C.QUANTILES] - qr[1]
        s_mean, s_t = M.nw_mean(spread, C.NW_LAGS)
        rows[name] = {
            "months": int(len(ic[1])),
            "firstDate": str(ic[1].index.min().date()),
            "lastDate": str(ic[1].index.max().date()),
            "meanIC": mean,
            "icT": t,
            "icIR": float(ic[1].mean() / ic[1].std(ddof=1)),
            "icPositive": float((ic[1] > 0).mean()),
            "decay": {str(h): M.nw_mean(ic[h], max(C.NW_LAGS, h))[0] for h in C.IC_HORIZONS},
            "decayT": {str(h): M.nw_mean(ic[h], max(C.NW_LAGS, h))[1] for h in C.IC_HORIZONS},
            "quintileMonthly": [float(quint[name][k]) for k in range(1, C.QUANTILES + 1)],
            "spreadMonthly": s_mean,
            "spreadT": s_t,
            "topTurnover": top_turnover(z[name]),
            "selected": bool(abs(t) >= C.IC_T_THRESHOLD),
            "sign": int(np.sign(mean)),
        }

    names = list(C.CANDIDATES)
    corr = pd.DataFrame(index=names, columns=names, dtype=float)
    for a in names:
        for b in names:
            corr.loc[a, b] = rank_ic(z[a], z[b]).mean()

    selected = {k: v["sign"] for k, v in rows.items() if v["selected"]}
    eligible_counts = elig.sum(axis=1)

    JSON_OUT.parent.mkdir(parents=True, exist_ok=True)
    JSON_OUT.write_text(json.dumps({
        "period": [rows[names[0]]["firstDate"], rows[names[0]]["lastDate"]],
        "rule": f"|NW t of mean 1-month rank IC| >= {C.IC_T_THRESHOLD}, {C.NW_LAGS} lags",
        "selected": selected,
        "signals": rows,
        "correlation": corr.round(4).to_dict(),
        "eligibleStocks": {"min": int(eligible_counts[eligible_counts > 0].min()),
                           "max": int(eligible_counts.max())},
    }, indent=2) + "\n")

    L = ["# Signal research, development period", "",
         "Generated by `scripts/strategy/03_signal_research.py`. Signal dates "
         f"{rows[names[0]]['firstDate']} to {rows[names[0]]['lastDate']}; no price "
         "after 31 December 2018 is loaded.", "",
         f"Eligible stocks per date: {eligible_counts[eligible_counts > 0].min()} to "
         f"{eligible_counts.max()}.", "",
         "Rank IC is the Spearman correlation across eligible stocks between the "
         "signal and the next month's return, fill to fill. t-statistics are "
         f"Newey-West with {C.NW_LAGS} lags (at least h for the h-month decay). "
         "Quintile returns are equal-weight, monthly and before costs.", "",
         "## Selection", "",
         "| Signal | Months | Mean IC | NW t | IC IR | IC > 0 | Q5−Q1 / month | t | Top-quintile turnover | Selected |",
         "|---|---:|---:|---:|---:|---:|---:|---:|---:|---|"]
    for k, v in rows.items():
        L.append(f"| `{k}` | {v['months']} | {v['meanIC']:+.4f} | {v['icT']:+.2f} | "
                 f"{v['icIR']:+.3f} | {v['icPositive']:.0%} | {v['spreadMonthly']:+.2%} | "
                 f"{v['spreadT']:+.2f} | {v['topTurnover']:.0%} | "
                 f"{('yes, sign ' + format(v['sign'], '+d')) if v['selected'] else 'no'} |")
    L += ["", "## IC decay (mean rank IC by forward horizon)", "",
          "| Signal | " + " | ".join(f"{h} mo" for h in C.IC_HORIZONS) + " |",
          "|---|" + "---:|" * len(C.IC_HORIZONS)]
    for k, v in rows.items():
        L.append(f"| `{k}` | " + " | ".join(
            f"{v['decay'][str(h)]:+.4f} ({v['decayT'][str(h)]:+.1f})" for h in C.IC_HORIZONS) + " |")
    L += ["", "## Quintile returns (mean monthly return, Q1 lowest signal)", "",
          "| Signal | " + " | ".join(f"Q{k}" for k in range(1, C.QUANTILES + 1)) + " |",
          "|---|" + "---:|" * C.QUANTILES]
    for k, v in rows.items():
        L.append(f"| `{k}` | " + " | ".join(f"{x:.2%}" for x in v["quintileMonthly"]) + " |")
    L += ["", "## Mean cross-sectional rank correlation between signals", "",
          "| | " + " | ".join(f"`{n}`" for n in names) + " |",
          "|---|" + "---:|" * len(names)]
    for a in names:
        L.append(f"| `{a}` | " + " | ".join(f"{corr.loc[a, b]:+.2f}" for b in names) + " |")
    L += ["", f"**Selected:** {', '.join(f'`{k}` ({s:+d})' for k, s in selected.items()) or 'none'}"]

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join(L) + "\n")
    print("\n".join(L))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
