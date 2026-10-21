#!/usr/bin/env python3
"""Stage 5: is the primary strategy's result luck, leakage or a known factor?

    random portfolios  1,000 portfolios of the same size drawn at random from
                       the eligible stocks each month. The universe's
                       survivorship bias lifts these as much as the strategy,
                       so the strategy's percentile among them measures
                       selection skill, not the bias.
    placebo spread     the primary's scores shuffled across stocks each month,
                       500 times: the null distribution of the long-short
                       Sharpe ratio.
                       Both comparisons use returns before costs. A random
                       portfolio replaces most of its holdings every month, so
                       net of costs it would lose to almost any persistent
                       signal, and the test would measure turnover, not skill.
    attribution        monthly excess returns regressed on the IIMA market,
                       size, value and momentum factors (through Dec 2025).
    momentum check     the gross MOM_12_1 spread against IIMA's WML factor; a
                       high correlation shows the signal is built correctly.
    by year, by liquidity tercile, cost multiples
    leak canary        a portfolio that ranks on the forward return itself must
                       look absurd, and one that trades last month's scores
                       should do somewhat worse; if not, the engine leaks or
                       the timing is wrong.

    python3 scripts/strategy/05_robustness.py
"""
import importlib.util
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

_spec = importlib.util.spec_from_file_location("bt", HERE / "04_backtest.py")
bt = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bt)

JSON_OUT = ROOT / "data" / "strategy" / "robustness.json"
REPORT = ROOT / "results" / "strategy" / "robustness.md"
P = C.PRIMARY
COST_MULTS = (0.0, 0.5, 1.0, 1.5, 2.0, 3.0)


def excess(daily: pd.Series, rf: pd.Series, a: str, b: str) -> pd.Series:
    m = M.monthly(M.window(daily, a, b))
    return m - rf.reindex(m.index)


def ann_sharpe(x: pd.Series) -> float:
    return float(x.mean() / x.std(ddof=1) * np.sqrt(12))


def main() -> int:
    panel = data.load_panel()
    idx, R = panel.adj.index, panel.returns
    dates, z, elig, terc, fwd = bt.build(panel)
    score = bt.model_scores(z, fwd, idx)[P]
    start = dates[dates < pd.Period(C.EVAL_START, "M").start_time].max()
    end = idx.max().to_period("M")
    a, b = C.EVAL_START, min(pd.Period(C.EVAL_END, "M"), end).strftime("%Y-%m")
    periods = {k: (x, min(pd.Period(y, "M"), end).strftime("%Y-%m"))
               for k, (x, y) in bt.PERIODS.items()
               if pd.Period(x, "M") <= end and (k != "full" or C.HOLDOUT_UNLOCKED)}

    iima = data.load_iima()
    rf = M.risk_free(iima, pd.period_range(pd.Period(a, "M"), end, freq="M"))
    rng = np.random.default_rng(C.SEED)

    prim = E.simulate(bt.live(E.quantile_weights(score), start), R, terc)
    short = E.simulate(bt.live(E.quantile_weights(score, top=False), start), R, terc)
    ew = E.simulate(bt.live(E.equal_weights(elig), start), R, terc)
    ls = bt.spread(prim, short)
    out: dict = {"primary": P, "holdoutUnlocked": C.HOLDOUT_UNLOCKED}

    # ---- random portfolios and placebo spreads ----
    scored = score.notna()
    rand_sr = {k: [] for k in periods}
    rand_cagr = {k: [] for k in periods}
    for _ in range(C.N_RANDOM):
        noise = pd.DataFrame(rng.random(score.shape), score.index, score.columns).where(scored)
        res = E.simulate(bt.live(E.quantile_weights(noise), start), R, terc, cost_mult=0)
        for k, (x, y) in periods.items():
            ex = excess(res.gross, rf, x, y)
            rand_sr[k].append(ann_sharpe(ex))
            rand_cagr[k].append(float((1 + M.monthly(M.window(res.gross, x, y))).prod()
                                      ** (12 / len(ex)) - 1))
    plac_sr = {k: [] for k in periods}
    for _ in range(C.N_PLACEBO):
        noise = pd.DataFrame(rng.random(score.shape), score.index, score.columns).where(scored)
        top = E.simulate(bt.live(E.quantile_weights(noise), start), R, terc, cost_mult=0)
        bot = E.simulate(bt.live(E.quantile_weights(noise, top=False), start), R, terc, cost_mult=0)
        for k, (x, y) in periods.items():
            plac_sr[k].append(ann_sharpe(M.monthly(M.window(top.gross - bot.gross, x, y))))

    out["random"], out["placebo"] = {}, {}
    for k, (x, y) in periods.items():
        sr = ann_sharpe(excess(prim.gross, rf, x, y))
        lsr = ann_sharpe(M.monthly(M.window(prim.gross - short.gross, x, y)))
        out["random"][k] = {
            "strategyGrossSharpe": sr,
            "percentile": float((np.array(rand_sr[k]) < sr).mean()),
            "randomSharpeMedian": float(np.median(rand_sr[k])),
            "randomSharpe95": float(np.percentile(rand_sr[k], 95)),
            "randomCagrMedian": float(np.median(rand_cagr[k])),
            "sharpes": np.round(rand_sr[k], 4).tolist(),
        }
        out["placebo"][k] = {
            "spreadGrossSharpe": lsr,
            "percentile": float((np.array(plac_sr[k]) < lsr).mean()),
            "placeboSharpe95": float(np.percentile(plac_sr[k], 95)),
        }

    # ---- factor attribution ----
    factors = iima[["MF", "SMB", "HML", "WML"]].dropna()
    out["attribution"] = {}
    for k, (x, y) in periods.items():
        y_iima = min(pd.Period(y, "M"), factors.index.max()).strftime("%Y-%m")
        block = {}
        for name, d in (("primary", prim.net), ("EW", ew.net), ("spread", ls),
                        ("active", prim.net - ew.net)):
            m = M.monthly(M.window(d, x, y_iima))
            lhs = m if name in ("spread", "active") else m - rf.reindex(m.index)
            fit = M.regress(lhs, factors.reindex(m.index))
            block[name] = {"alpha": float(fit.loc["const", "coef"] * 12),
                           "alphaT": float(fit.loc["const", "t"]),
                           **{f: float(fit.loc[f, "coef"]) for f in factors.columns},
                           **{f"{f}T": float(fit.loc[f, "t"]) for f in factors.columns},
                           "r2": fit.attrs["r2"], "months": fit.attrs["n"]}
        block["end"] = y_iima
        out["attribution"][k] = block

    # ---- momentum construction check ----
    mom = z["MOM_12_1"]
    w_top = E.simulate(bt.live(E.quantile_weights(mom), start), R, terc, cost_mult=0)
    w_bot = E.simulate(bt.live(E.quantile_weights(mom, top=False), start), R, terc, cost_mult=0)
    mom_ls = M.monthly(M.window(w_top.gross - w_bot.gross, a, b))
    j = pd.concat([mom_ls.rename("ours"), iima["WML"]], axis=1).dropna()
    out["wmlCheck"] = {"corr": float(j.corr().iloc[0, 1]), "months": len(j),
                       "oursMonthly": float(j["ours"].mean()), "wmlMonthly": float(j["WML"].mean())}

    # ---- by calendar year ----
    years = {}
    for name, d in (("primary", prim.net), ("EW", ew.net)):
        m = M.monthly(M.window(d, a, b))
        years[name] = (1 + m).groupby(m.index.year).prod() - 1
    idx_ret = data.load_indices().reindex(idx).ffill().pct_change(fill_method=None).fillna(0)
    m = M.monthly(M.window(idx_ret["NIFTY500"], a, b))
    years["NIFTY500"] = (1 + m).groupby(m.index.year).prod() - 1
    out["byYear"] = {str(y): {k: float(v[y]) for k, v in years.items()} for y in years["EW"].index}

    # ---- by liquidity tercile ----
    out["byTercile"] = {}
    for t in range(C.LIQ_TERCILES):
        inside = elig & (terc == t)
        res = E.simulate(bt.live(E.quantile_weights(score.where(inside)), start), R, terc)
        base = E.simulate(bt.live(E.equal_weights(inside), start), R, terc)
        block = {}
        for k, (x, y) in periods.items():
            s = M.summary(M.window(res.net, x, y), rf, M.window(base.net, x, y))
            sb = M.summary(M.window(base.net, x, y), rf)
            block[k] = {"cagr": s["cagr"], "sharpe": s["sharpe"], "benchCagr": sb["cagr"],
                        "benchSharpe": sb["sharpe"], "alpha": s["alpha"], "alphaT": s["alphaT"],
                        "activeReturn": s["activeReturn"], "activeT": s["activeT"]}
        out["byTercile"][str(t)] = block

    # ---- cost multiples ----
    out["costs"] = {}
    for mult in COST_MULTS:
        res = E.simulate(bt.live(E.quantile_weights(score), start), R, terc, cost_mult=mult)
        base = E.simulate(bt.live(E.equal_weights(elig), start), R, terc, cost_mult=mult)
        out["costs"][str(mult)] = {
            k: {kk: M.summary(M.window(res.net, x, y), rf, M.window(base.net, x, y))[kk]
                for kk in ("cagr", "sharpe", "activeReturn", "alpha", "alphaT")}
            for k, (x, y) in periods.items()}

    # ---- leak canary ----
    cheat = E.simulate(bt.live(E.quantile_weights(fwd.where(scored)), start), R, terc)
    stale = E.simulate(bt.live(E.quantile_weights(score.shift(1)), start), R, terc)
    out["canary"] = {k: {"forwardReturnSharpe": ann_sharpe(excess(cheat.net, rf, x, y)),
                         "primarySharpe": ann_sharpe(excess(prim.net, rf, x, y)),
                         "oneMonthStaleSharpe": ann_sharpe(excess(stale.net, rf, x, y))}
                     for k, (x, y) in periods.items()}

    # ---- the primary score's IC by period ----
    ok = score.notna() & fwd.notna()
    ic = score.where(ok).rank(axis=1).corrwith(fwd.where(ok).rank(axis=1), axis=1).dropna()
    out["ic"] = {}
    for k, (x, y) in periods.items():
        s = ic[(ic.index >= pd.Period(x, "M").start_time - pd.offsets.MonthEnd(1))
               & (ic.index <= pd.Period(y, "M").end_time)]
        mean, t = M.nw_mean(s)
        out["ic"][k] = {"meanIC": mean, "t": t, "months": len(s), "positive": float((s > 0).mean())}
    out["icSeries"] = {d.strftime("%Y-%m"): round(float(v), 5) for d, v in ic.items()
                       if d >= start}

    # ---- forward return by primary-score quintile, equal weight, gross ----
    q = np.ceil(score.where(ok).rank(axis=1, pct=True) * C.QUANTILES)
    qr = pd.DataFrame({j: fwd.where(q == j).mean(axis=1)
                       for j in range(1, C.QUANTILES + 1)}).dropna()
    out["quintiles"] = {}
    for k, (x, y) in periods.items():
        s = qr[(qr.index >= pd.Period(x, "M").start_time - pd.offsets.MonthEnd(1))
               & (qr.index <= pd.Period(y, "M").end_time)]
        out["quintiles"][k] = [float(v) for v in s.mean()]

    JSON_OUT.write_text(json.dumps(out, indent=1) + "\n")

    # ---- report ----
    L = ["# Robustness", "",
         f"Generated by `scripts/strategy/05_robustness.py` for the primary strategy `{P}`. "
         f"Holdout unlocked: {C.HOLDOUT_UNLOCKED}.", ""]
    for k in periods:
        r, pl, ic_k = out["random"][k], out["placebo"][k], out["ic"][k]
        L += [f"## {k.capitalize()} ({periods[k][0]} to {periods[k][1]})", "",
              f"- Rank IC of the primary score: {ic_k['meanIC']:+.4f} "
              f"(NW t {ic_k['t']:+.2f}, positive in {ic_k['positive']:.0%} of {ic_k['months']} months)",
              f"- Random portfolios ({C.N_RANDOM}, before costs): strategy Sharpe "
              f"{r['strategyGrossSharpe']:.2f} beats {r['percentile']:.1%} of them; random median "
              f"{r['randomSharpeMedian']:.2f}, 95th percentile {r['randomSharpe95']:.2f}; random "
              f"median CAGR {r['randomCagrMedian']:+.1%}",
              f"- Placebo spreads ({C.N_PLACEBO}, before costs): long-short Sharpe "
              f"{pl['spreadGrossSharpe']:.2f} beats {pl['percentile']:.1%}; placebo 95th percentile "
              f"{pl['placeboSharpe95']:.2f}",
              f"- Leak canary: ranking on the forward return gives Sharpe "
              f"{out['canary'][k]['forwardReturnSharpe']:.1f}; one-month-stale scores "
              f"{out['canary'][k]['oneMonthStaleSharpe']:.2f} against {out['canary'][k]['primarySharpe']:.2f}",
              "", f"### Attribution on IIMA factors (to {out['attribution'][k]['end']}; alpha annualised)", "",
              "| Series | Alpha | t | MF | SMB | HML | WML | WML t | R² |",
              "|---|---:|---:|---:|---:|---:|---:|---:|---:|"]
        for name in ("primary", "EW", "active", "spread"):
            f = out["attribution"][k][name]
            L.append(f"| {name} | {f['alpha']:+.1%} | {f['alphaT']:+.2f} | {f['MF']:+.2f} | "
                     f"{f['SMB']:+.2f} | {f['HML']:+.2f} | {f['WML']:+.2f} | {f['WMLT']:+.2f} | "
                     f"{f['r2']:.2f} |")
        L += ["", "### By liquidity tercile (top quintile within the tercile, against that tercile's EW)", "",
              "| Tercile | CAGR | Sharpe | EW CAGR | EW Sharpe | Alpha | t | Active | t |",
              "|---|---:|---:|---:|---:|---:|---:|---:|---:|"]
        for t, block in out["byTercile"].items():
            v = block[k]
            L.append(f"| {['most liquid', 'middle', 'least liquid'][int(t)]} | {v['cagr']:+.1%} | "
                     f"{v['sharpe']:.2f} | {v['benchCagr']:+.1%} | {v['benchSharpe']:.2f} | "
                     f"{v['alpha']:+.1%} | {v['alphaT']:+.2f} | {v['activeReturn']:+.1%} | "
                     f"{v['activeT']:+.2f} |")
        L += ["", "### Cost multiples (of the base schedule; EW pays the same multiple)", "",
              "| Multiple | CAGR | Sharpe | Active | Alpha | t |", "|---|---:|---:|---:|---:|---:|"]
        for mult, block in out["costs"].items():
            v = block[k]
            L.append(f"| {float(mult):.1f}x | {v['cagr']:+.1%} | {v['sharpe']:.2f} | "
                     f"{v['activeReturn']:+.1%} | {v['alpha']:+.1%} | {v['alphaT']:+.2f} |")
        L.append("")
    w = out["wmlCheck"]
    L += ["## Momentum construction check", "",
          f"Gross `MOM_12_1` quintile spread against IIMA WML: correlation {w['corr']:.3f} over "
          f"{w['months']} months; mean {w['oursMonthly']:+.2%} a month against {w['wmlMonthly']:+.2%}.",
          "", "## By calendar year", "", "| Year | Primary | EW | Nifty 500 (price) |",
          "|---|---:|---:|---:|"]
    for y, v in out["byYear"].items():
        L.append(f"| {y} | {v['primary']:+.1%} | {v['EW']:+.1%} | {v['NIFTY500']:+.1%} |")
    REPORT.write_text("\n".join(L) + "\n")
    print("\n".join(L))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
