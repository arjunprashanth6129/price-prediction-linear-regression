#!/usr/bin/env python3
"""Stage 4: backtest every pre-registered strategy, net of costs.

Strategies, all rebalanced monthly with a one-session execution lag:

    M2             equal-weight composite of the selected signals, top quintile,
                   long-only (the primary; see config.py for why it is not M3)
    M3             walk-forward Fama-MacBeth forecast, top quintile, long-only
    M3_rolling_60  M3 with a 60-month rolling mean of the slopes
    <P>_buffer     the primary with a rank buffer (hold until a name leaves the
                   top 30%)
    M1_<signal>    each candidate signal alone, top quintile on its development sign
    EW             equal weight across every eligible stock: the benchmark
    M2_LS, M3_LS   top quintile minus bottom quintile, the research spread
    <P>_LS_vol     the primary's spread scaled to 12% annualised volatility
                   (Barroso and Santa-Clara 2015), leverage capped at 2

plus the sensitivity runs of the primary in config.SENSITIVITY. Every
long-only configuration is a trial in the Deflated Sharpe Ratio.

Results are reported for the development period, the holdout and the whole
sample. While the holdout is locked only the development period exists.

    python3 scripts/strategy/04_backtest.py
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
import models  # noqa: E402
import signals as S  # noqa: E402

DEV_JSON = ROOT / "data" / "strategy" / "signals-dev.json"
JSON_OUT = ROOT / "data" / "strategy" / "backtest.json"
REPORT = ROOT / "results" / "strategy" / "backtest.md"
MONTHLY_OUT = ROOT / "results" / "strategy" / "monthly_returns.csv"

P = C.PRIMARY
PERIODS = {
    "development": (C.EVAL_START, pd.Period(C.DEV_END, "M").strftime("%Y-%m")),
    "holdout": (C.HOLDOUT_START, C.EVAL_END),
    "full": (C.EVAL_START, C.EVAL_END),
}


def build(panel: data.Panel, mom=(252, 21)):
    dates = S.signal_dates(panel.adj.index)
    raw = S.raw_signals(panel.adj, panel.traded_value, dates, mom=mom)
    elig, terc = S.eligibility(panel.adj, panel.traded, panel.traded_value, dates)
    z = {k: S.standardise(v, elig) for k, v in raw.items()}
    fwd = S.forward_returns(panel.adj, dates).where(elig)
    return dates, z, elig, terc, fwd


def model_scores(z, fwd, index, rolling=None) -> dict[str, pd.DataFrame]:
    m3, _ = models.fm_forecast({k: z[k] for k in C.SELECTED}, fwd, index, rolling=rolling)
    return {"M2": models.composite(z, C.SELECTED), "M3": m3}


def live(targets: pd.DataFrame, start: pd.Timestamp) -> pd.DataFrame:
    """Targets from the signal date that opens the first evaluation month."""
    return targets.loc[targets.index >= start]


def spread(long: E.Result, short: E.Result) -> pd.Series:
    """Daily long-short return: both legs' gross returns, both legs' costs."""
    return long.gross - short.gross - long.cost - short.cost


def vol_scaled(daily: pd.Series, fills: pd.Series) -> pd.Series:
    """Rescale at each rebalance to VOL_TARGET using the trailing 126 sessions."""
    scale = pd.Series(np.nan, index=daily.index)
    for s, f in fills.dropna().items():
        hist = daily.loc[:s].iloc[-C.VOL_WINDOW:]
        if len(hist) < C.VOL_WINDOW // 2 or hist.std() == 0:
            continue
        sigma = hist.std() * np.sqrt(252)
        pos = daily.index.get_loc(f) + 1
        if pos < len(daily):
            scale.iloc[pos] = min(C.VOL_TARGET / sigma, C.MAX_LEVERAGE)
    return daily * scale.ffill().fillna(0.0)


def main() -> int:
    panel = data.load_panel()
    idx = panel.adj.index
    returns = panel.returns
    dates, z, elig, terc, fwd = build(panel)
    dev_signs = json.loads(DEV_JSON.read_text())["signals"]

    first_month = pd.Period(C.EVAL_START, "M")
    start = dates[dates < first_month.start_time].max()
    scores = model_scores(z, fwd, idx)
    scores["M3_rolling_60"] = model_scores(z, fwd, idx, rolling=C.FM_ROLLING)["M3"]
    for name, sc in scores.items():
        assert sc.loc[start].notna().sum() > 50, f"{name} must be live when evaluation starts"
    _, slope_means = models.fm_forecast({k: z[k] for k in C.SELECTED}, fwd, idx)

    targets = {name: E.quantile_weights(sc) for name, sc in scores.items()}
    targets[f"{P}_buffer"] = E.buffered_weights(scores[P])
    targets["EW"] = E.equal_weights(elig)
    for k in C.CANDIDATES:
        targets[f"M1_{k}"] = E.quantile_weights(z[k] * dev_signs[k]["sign"])
    runs = {name: E.simulate(live(t, start), returns, terc) for name, t in targets.items()}

    fills = S.fill_dates(idx, dates[dates >= start])
    daily = {name: r.net for name, r in runs.items()}
    for name in ("M2", "M3"):
        short = E.simulate(live(E.quantile_weights(scores[name], top=False), start), returns, terc)
        daily[f"{name}_LS"] = spread(runs[name], short)
    daily[f"{P}_LS_vol"] = vol_scaled(daily[f"{P}_LS"], fills)

    # Sensitivity: one setting of the primary changed at a time.
    for name, change in C.SENSITIVITY.items():
        score = scores[P]
        if "mom" in change:
            _, zs, _, _, fs = build(panel, mom=change["mom"])
            score = model_scores(zs, fs, idx)[P]
        w = E.quantile_weights(score, q=change.get("q", C.QUANTILES))
        res = E.simulate(live(w, start), returns, terc, cost_mult=change.get("cost_mult", 1.0))
        runs[f"{P}_{name}"] = res
        daily[f"{P}_{name}"] = res.net

    gross = {name: r.gross for name, r in runs.items()}
    indices = data.load_indices().reindex(idx).ffill().pct_change(fill_method=None)
    for col in indices:
        daily[col] = indices[col].fillna(0.0)

    iima = data.load_iima()
    end = idx.max().to_period("M")
    rf = M.risk_free(iima, pd.period_range(first_month, end, freq="M"))
    trial_names = [n for n in daily if n.startswith("M") and "_LS" not in n]

    stats = {}
    for period, (a, b) in PERIODS.items():
        if pd.Period(a, "M") > end or (period == "full" and not C.HOLDOUT_UNLOCKED):
            continue
        b = min(pd.Period(b, "M"), end).strftime("%Y-%m")
        bench = M.window(daily["EW"], a, b)
        rows, trial_srs = {}, []
        for name, d in daily.items():
            mx = M.monthly(M.window(d, a, b))
            ex = mx - rf.reindex(mx.index)
            if name in trial_names:
                trial_srs.append(float(ex.mean() / ex.std(ddof=1)))
            s = M.summary(M.window(d, a, b), rf,
                          None if name == "EW" or "_LS" in name else bench)
            s["psr"] = M.psr(ex)
            if name in runs:
                tv = runs[name].turnover
                tv = tv[(tv.index >= pd.Period(a, "M").start_time - pd.offsets.MonthEnd(1))
                        & (tv.index <= pd.Period(b, "M").end_time)]
                s["turnover"] = float(tv.iloc[1:].mean() * 12) if len(tv) > 1 else np.nan
                s["costDrag"] = float(M.window(runs[name].cost, a, b).sum() / (len(mx) / 12))
                g = M.monthly(M.window(gross[name], a, b))
                s["grossCagr"] = float((1 + g).prod() ** (12 / len(g)) - 1)
                s["names"] = float(runs[name].names.loc[runs[name].names.index >= start].mean())
            rows[name] = s
        for name in trial_names:
            x = M.monthly(M.window(daily[name], a, b))
            rows[name]["dsr"] = M.dsr(x - rf.reindex(x.index), np.array(trial_srs))
        px = M.monthly(M.window(daily[P], a, b))
        rows[P]["sharpeCI"] = list(M.bootstrap_sharpe(px - rf.reindex(px.index)))
        # Break-even cost multiple: the multiple of the cost schedule at which
        # the primary's net return over EW, which pays the same schedule, is zero.
        act_gross = (M.monthly(M.window(gross[P], a, b))
                     - M.monthly(M.window(gross["EW"], a, b))).mean() * 12
        extra = rows[P]["costDrag"] - rows["EW"]["costDrag"]
        rows[P]["breakEvenCostMultiple"] = float(act_gross / extra) if extra > 0 else None
        stats[period] = {"trials": len(trial_srs), "rows": rows}

    monthly_df = pd.DataFrame({n: M.monthly(M.window(d, C.EVAL_START, C.EVAL_END))
                               for n, d in daily.items()})
    monthly_df.index = monthly_df.index.strftime("%Y-%m")
    MONTHLY_OUT.parent.mkdir(parents=True, exist_ok=True)
    monthly_df.round(6).to_csv(MONTHLY_OUT, index_label="month")

    show = [P, "M3", f"{P}_buffer", "EW", "NIFTY50", "NIFTY500", f"{P}_LS", f"{P}_LS_vol"]
    JSON_OUT.write_text(json.dumps({
        "primary": P,
        "holdoutUnlocked": C.HOLDOUT_UNLOCKED,
        "periods": {k: v for k, v in PERIODS.items() if k in stats},
        "firstFill": str(fills.dropna().iloc[0].date()),
        "stats": stats,
        "months": monthly_df.index.tolist(),
        "monthly": {n: monthly_df[n].round(6).tolist() for n in show},
        "slopeMeans": {k: {d.strftime("%Y-%m"): v for d, v in
                           slope_means[k].dropna().round(6).items()} for k in C.SELECTED},
    }, indent=1) + "\n")

    cols = [("cagr", "CAGR", "{:+.1%}"), ("vol", "Vol", "{:.1%}"), ("sharpe", "Sharpe", "{:.2f}"),
            ("maxDrawdown", "Max DD", "{:.1%}"), ("activeReturn", "Active vs EW", "{:+.1%}"),
            ("activeT", "t", "{:+.2f}"), ("alpha", "Alpha vs EW", "{:+.1%}"),
            ("alphaT", "t", "{:+.2f}"), ("beta", "Beta", "{:.2f}"),
            ("turnover", "Turnover/yr", "{:.0%}"), ("costDrag", "Cost/yr", "{:.2%}"),
            ("psr", "PSR", "{:.2f}"), ("dsr", "DSR", "{:.2f}")]
    L = ["# Backtest", "",
         "Generated by `scripts/strategy/04_backtest.py`. Returns are net of costs. "
         "Sharpe ratios use the IIMA risk-free rate. Active return and alpha are "
         "against the equal-weight eligible universe (EW). "
         f"Primary strategy: `{P}`. Holdout unlocked: {C.HOLDOUT_UNLOCKED}.", ""]
    for period, block in stats.items():
        rows = block["rows"]
        a, b = PERIODS[period]
        L += [f"## {period.capitalize()} ({a} to {min(pd.Period(b, 'M'), end)})", "",
              f"Trials counted for the DSR: {block['trials']}.", "",
              "| Strategy | " + " | ".join(c[1] for c in cols) + " |",
              "|---|" + "---:|" * len(cols)]
        for name, s in rows.items():
            cells = [f.format(s[k]) if s.get(k) is not None and pd.notna(s.get(k)) else ""
                     for k, _, f in cols]
            L.append(f"| `{name}` | " + " | ".join(cells) + " |")
        r = rows[P]
        be = r["breakEvenCostMultiple"]
        L += ["", f"`{P}`: Sharpe 95% interval (stationary bootstrap) "
                  f"{r['sharpeCI'][0]:.2f} to {r['sharpeCI'][1]:.2f}; gross CAGR "
                  f"{r['grossCagr']:+.1%}; break-even cost multiple "
                  f"{'n/a' if be is None else f'{be:.1f}x'} the base schedule; "
                  f"{r['names']:.0f} names held on average.", ""]
    REPORT.write_text("\n".join(L) + "\n")
    print("\n".join(L))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
