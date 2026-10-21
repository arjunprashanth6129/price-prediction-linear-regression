#!/usr/bin/env python3
"""Stage 2b: check the survivorship-free panel before any strategy runs on it.

No signal is computed here and no strategy is run. The checks are on the data
and on the benchmark universe only, so that every data decision is made
before a strategy return on this data has been seen.

    coverage          sessions, stocks, and the size of the month-end universe
    adjustments       corporate actions applied and refused, repairs, and every
                      large one-day move kept as a real return
    against Yahoo     monthly returns of the stocks both sources carry; they
                      should agree once Yahoo's own defects are repaired
    against NSE       the equal-weight universe, before costs, against NSE's
                      Nifty500 Equal Weight total return index, which NSE
                      computes on each date's actual constituents. The same
                      comparison for the Yahoo universe measures its
                      survivorship bias directly
    exits             every stock that stopped trading while it was in the
                      universe, how it was classified and the return booked

    python3 scripts/strategy/02b_validate_nse.py
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
import engine as E  # noqa: E402
import metrics as M  # noqa: E402
import nse  # noqa: E402
import signals as S  # noqa: E402

RESULTS, DATA, _ = data.outputs("pit")
REPORT = RESULTS / "data_quality.md"
JSON_OUT = DATA / "data_quality.json"


def month_end_returns(adj: pd.DataFrame) -> pd.DataFrame:
    p = adj.ffill()
    last = p.groupby(p.index.to_period("M")).last()
    return last.pct_change(fill_method=None)


def ew_gross(panel: data.Panel) -> tuple[pd.Series, pd.DataFrame]:
    """Equal weight across each month's eligible stocks, before costs."""
    dates = S.signal_dates(panel.adj.index)
    elig, terc = S.eligibility(panel.adj, panel.traded, panel.traded_value, dates,
                               **panel.universe)
    start = dates[dates < pd.Period(C.EVAL_START, "M").start_time].max()
    w = E.equal_weights(elig).loc[lambda x: x.index >= start]
    return E.simulate(w, panel.returns, terc, cost_mult=0).gross, elig


def against_index(daily: pd.Series, index_level: pd.Series, a: str, b: str) -> dict:
    m = M.monthly(M.window(daily, a, b))
    lvl = index_level.dropna()
    im = lvl.groupby(lvl.index.to_period("M")).last().pct_change().reindex(m.index)
    yrs = len(m) / 12
    return {"months": len(m), "corr": float(m.corr(im)),
            "cagr": float((1 + m).prod() ** (1 / yrs) - 1),
            "indexCagr": float((1 + im).prod() ** (1 / yrs) - 1),
            "gapPerYear": float((1 + m).prod() ** (1 / yrs) - (1 + im).prod() ** (1 / yrs)),
            "trackingError": float((m - im).std() * np.sqrt(12))}


def calibrate_split_rule() -> dict:
    """How often the pre-2010 price rule would have been right on 2010-2026,
    where NSE's files say whether a bonus or split took place."""
    close, value = nse.read_field("close"), nse.read_field("value")
    value = value.reindex_like(close).where(lambda v: v > 0)
    traded = value.notna()
    acts = nse.actions_table(close.index)
    events: dict = {}
    for r in acts[(acts["ratio"] != 1.0) | acts["capital"]].itertuples():
        events.setdefault(r.symbol, []).append(r.session)
    lr, ex = nse.moves(close.where(traded), traded)
    rank = nse.liquidity_rank(value)
    late = lr.index >= nse.BC_START + pd.Timedelta(days=31)
    out = {}
    for name, ratios, rk, tol in (
            ("rule used: 1:2, 1:3 (within 0.10), 1:4, 1:5, 1:10 (within 0.25), 1,000 most traded",
             nse.BIG_RATIOS, rank, nse.BIG_TOL),
            ("the same ratios, every stock", nse.BIG_RATIOS, None, nse.BIG_TOL),
            ("every standard ratio within 0.03, 1,000 most traded", nse.ALL_RATIOS, rank,
             nse.RATIO_TOL)):
        c = nse.ratio_candidates(lr[late], ex[late], traded[late], ratios,
                                 None if rk is None else rk[late], tol)
        hit = [any(abs((d - s).days) <= 7 for s in events.get(t, [])) for d, t in c.index]
        out[name] = {"flagged": len(c), "recorded": int(sum(hit)),
                     "precision": float(np.mean(hit)) if hit else None}
    for r in acts[acts["dividend"] > 0].itertuples():
        events.setdefault(r.symbol, []).append(r.session)
    huge = lr[late] < np.log(1 - nse.HUGE_FALL)
    idx = huge.stack().loc[lambda s: s].index
    hit = [any(abs((d - s).days) <= 7 for s in events.get(t, [])) for d, t in idx]
    out["rule used: any fall beyond 80%, every stock (a dividend counts)"] = {
        "flagged": len(idx), "recorded": int(sum(hit)),
        "precision": float(np.mean(hit)) if hit else None}
    return out


def main() -> int:
    calibration = calibrate_split_rule()
    pit = data.load_panel(source="pit")
    surv = data.load_panel(source="survivor")
    rep = pit.report
    tri = data.load_indices("pit")
    out: dict = {"splitRuleCalibration": calibration}

    # ---- coverage ----
    dates = S.signal_dates(pit.adj.index)
    elig_counts = None
    ew_pit, elig = ew_gross(pit)
    elig_counts = elig.sum(axis=1)
    elig_counts = elig_counts[elig_counts > 0]
    out["coverage"] = {
        "sessions": rep["sessions"], "stocks": rep["stocks"], "columns": rep["columns"],
        "universePerMonth": {"min": int(elig_counts.min()), "median": int(elig_counts.median()),
                             "max": int(elig_counts.max())},
        "everEligible": int(elig.any().sum()),
    }

    # ---- adjustments ----
    adj_log = pd.DataFrame(rep["adjustments"], columns=["symbol", "date", "what", "value", "seen"])
    kinds = adj_log["what"].value_counts().to_dict()
    repairs = pd.DataFrame(rep["repairs"], columns=["symbol", "date", "why", "move"])
    kept = pd.DataFrame(rep["keptLargeMoves"], columns=["symbol", "date", "excess"])
    ever = set(elig.columns[elig.any()])
    kept_in = kept[kept["symbol"].isin(ever)].sort_values("excess")
    out["adjustments"] = {"applied": kinds, "repairs": len(repairs),
                          "repairsByKind": repairs["why"].str.split(",").str[0].value_counts().to_dict(),
                          "keptLargeMoves": len(kept), "keptLargeMovesInUniverse": len(kept_in)}

    # ---- against Yahoo ----
    common = [c for c in surv.adj.columns if c in pit.adj.columns]
    ry = month_end_returns(surv.adj[common])
    rn = month_end_returns(pit.adj[common])
    both = ry.notna() & rn.notna()
    diff = (rn - ry).where(both)
    blocks = {}
    for name, (a, b) in {"2005-2009 (NSE: price only)": ("2005-02", "2009-12"),
                         "2010-2026": ("2010-01", "2026-06")}.items():
        d = diff.loc[pd.Period(a, "M"):pd.Period(b, "M")].stack().dropna()
        blocks[name] = {"stockMonths": int(d.size), "stocks": int(d.index.get_level_values(1).nunique()),
                        "medianAbsDiff": float(d.abs().median()),
                        "meanDiff": float(d.mean()),
                        "within1pct": float((d.abs() < 0.01).mean()),
                        "over5pct": int((d.abs() > 0.05).sum())}
    out["againstYahoo"] = blocks
    worst = diff.loc[pd.Period("2010-01", "M"):].stack().dropna()
    worst = worst[worst.abs() > 0.05].sort_values(key=abs, ascending=False)

    # ---- against NSE's equal-weight index ----
    a, b = C.EVAL_START, C.EVAL_END
    ew_surv, _ = ew_gross(surv)
    ps = data.load_panel(source="pit-survivors")
    ew_ps, _ = ew_gross(ps)
    out["againstNifty500EW"] = {
        "pit": against_index(ew_pit, tri["NIFTY500_EW"], a, b),
        "pitSurvivors": against_index(ew_ps, tri["NIFTY500_EW"], a, b),
        "survivorYahoo": against_index(ew_surv, tri["NIFTY500_EW"], a, b),
    }

    # ---- exits ----
    exits = pd.DataFrame(rep["exits"], columns=["symbol", "lastTrade", "kind", "return"])
    exits["everEligible"] = exits["symbol"].isin(ever)
    ex_in = exits[exits["everEligible"]].sort_values("lastTrade")
    out["exits"] = {"all": len(exits), "everEligible": len(ex_in),
                    "byKind": ex_in["kind"].value_counts().to_dict(),
                    "distressReturn": rep["distressReturn"]}

    DATA.mkdir(parents=True, exist_ok=True)
    RESULTS.mkdir(parents=True, exist_ok=True)
    JSON_OUT.write_text(json.dumps(out, indent=1, default=str) + "\n")

    cov = out["coverage"]
    L = ["# Data quality: the survivorship-free panel", "",
         "Generated by `scripts/strategy/02b_validate_nse.py`. No signal or strategy is computed "
         "here. The rules are in `scripts/strategy/nse.py`.", "",
         "## Coverage", "",
         f"- Sessions: {cov['sessions'][2]} from {cov['sessions'][0]} to {cov['sessions'][1]}",
         f"- Stocks kept (ever among the 1,000 most traded at a month-end): {cov['stocks']}; "
         f"{cov['columns']} histories after splitting at suspensions",
         f"- Eligible at each month-end: {cov['universePerMonth']['min']} to "
         f"{cov['universePerMonth']['max']} (median {cov['universePerMonth']['median']}); "
         f"{cov['everEligible']} stocks eligible at least once", "",
         "## Corporate actions and repairs", "",
         "| Action | Count |", "|---|---:|"]
    for k, v in kinds.items():
        L.append(f"| {k} | {v} |")
    L += ["", "### The pre-2010 rule, checked on 2010-2026", "",
          "Before 2010 NSE serves no corporate action file, so for stocks Yahoo does not carry a "
          "bonus or split is inferred from the price. On 2010-2026, where NSE's files say what "
          "happened, the same rule would have flagged these moves:", "",
          "| Rule | Moves flagged | With a bonus or split recorded by NSE | Share |",
          "|---|---:|---:|---:|"]
    for k, v in calibration.items():
        L.append(f"| {k} | {v['flagged']} | {v['recorded']} | "
                 f"{'' if v['precision'] is None else format(v['precision'], '.1%')} |")
    L += ["", f"Repairs: {len(repairs)}.", "",
          "| Date | Stock | Reason | Move removed |", "|---|---|---|---:|"]
    for r in repairs.sort_values("date").itertuples():
        L.append(f"| {pd.Timestamp(r.date).date()} | {r.symbol} | {r.why} | {r.move:+.1%} |")
    L += ["", f"### Large one-day moves kept as real returns ({len(kept_in)} in stocks that were ever "
              f"eligible, of {len(kept)})", "",
          "Moves beyond -40% or +67% relative to the session's median stock, after every adjustment.", "",
          "| Date | Stock | Move net of the median |", "|---|---|---:|"]
    for r in kept_in.itertuples():
        L.append(f"| {pd.Timestamp(r.date).date()} | {r.symbol} | {r.excess:+.1%} |")

    L += ["", "## Against Yahoo (stocks in both sources)", "",
          "Monthly returns, month-end to month-end. Yahoo includes dividends throughout; NSE's "
          "corporate action files start in January 2010, so before then the NSE series is price only.", "",
          "| Period | Stock-months | Stocks | Median abs. difference | Mean difference | Within 1% | Over 5% |",
          "|---|---:|---:|---:|---:|---:|---:|"]
    for k, v in blocks.items():
        L.append(f"| {k} | {v['stockMonths']:,} | {v['stocks']} | {v['medianAbsDiff']:.3%} | "
                 f"{v['meanDiff']:+.3%} | {v['within1pct']:.1%} | {v['over5pct']} |")
    L += ["", "Largest differences from 2010 (NSE minus Yahoo):", "",
          "| Month | Stock | Difference |", "|---|---|---:|"]
    for (mth, t), v in worst.head(40).items():
        L.append(f"| {mth} | {t} | {v:+.1%} |")

    L += ["", "## The equal-weight universe against NSE's Nifty500 Equal Weight index", "",
          f"Monthly returns {a} to {b}. The universe portfolio is equal weight across each month's "
          "eligible stocks, rebalanced monthly, before costs. The index is NSE's total return series, "
          "computed on each date's actual Nifty 500 members and rebalanced quarterly.", "",
          "| Universe | CAGR | Index CAGR | Gap a year | Correlation | Tracking error |",
          "|---|---:|---:|---:|---:|---:|"]
    names = {"pit": "Survivorship-free (NSE, all stocks)",
             "pitSurvivors": "Today's Nifty 500 names (NSE data)",
             "survivorYahoo": "Today's Nifty 500 names (Yahoo, the first study)"}
    for k, v in out["againstNifty500EW"].items():
        L.append(f"| {names[k]} | {v['cagr']:+.1%} | {v['indexCagr']:+.1%} | {v['gapPerYear']:+.1%} | "
                 f"{v['corr']:.3f} | {v['trackingError']:.1%} |")

    L += ["", "## Exits", "",
          f"{len(exits)} histories end before the data does; {len(ex_in)} belong to stocks that were "
          f"eligible at some month-end. The distress return is {rep['distressReturn']:+.0%}.", "",
          "| Kind | Count |", "|---|---:|"]
    for k, v in out["exits"]["byKind"].items():
        L.append(f"| {k} | {v} |")
    L += ["", "| Last trade | Stock | Kind | Return booked |", "|---|---|---|---:|"]
    for r in ex_in.itertuples():
        L.append(f"| {pd.Timestamp(r.lastTrade).date()} | {r.symbol} | {r.kind} | {r._4:+.1%} |")

    REPORT.write_text("\n".join(L) + "\n")
    print("\n".join(L[:60]))
    print(json.dumps({k: out[k] for k in ("coverage", "againstYahoo", "againstNifty500EW", "exits")},
                     indent=1, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
