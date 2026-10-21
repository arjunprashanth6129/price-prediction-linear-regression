"""Performance and inference statistics.

Returns arrive as daily series; most statistics are computed on calendar-month
returns, the frequency at which the strategies trade. Sharpe ratios are of
returns in excess of the IIMA risk-free rate (the 91-day Treasury bill), which
ends in December 2025; the last value is carried through June 2026.

Inference on a mean uses Newey-West standard errors, which allow for the
autocorrelation that overlapping holdings and persistent signals induce. The
Probabilistic and Deflated Sharpe Ratios follow Bailey and Lopez de Prado
(2012, 2014): the first is the probability that the true Sharpe ratio exceeds
a benchmark given the sample's length, skewness and kurtosis; the second sets
that benchmark to the best Sharpe ratio expected from the number of
configurations tried if none had any skill.
"""
import sys

from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.api as sm

from scipy import stats

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import config as C  # noqa: E402

EULER = 0.5772156649015329


def monthly(daily: pd.Series) -> pd.Series:
    """Compound daily returns into calendar-month returns."""
    return (1 + daily).groupby(daily.index.to_period("M")).prod() - 1


def window(x: pd.Series, start: str, end: str) -> pd.Series:
    """Slice a daily or monthly series to [start, end] months inclusive."""
    if isinstance(x.index, pd.PeriodIndex):
        return x.loc[pd.Period(start, "M"):pd.Period(end, "M")]
    return x.loc[pd.Period(start, "M").start_time:pd.Period(end, "M").end_time]


def drawdown(daily: pd.Series) -> pd.Series:
    nav = (1 + daily).cumprod()
    return nav / nav.cummax() - 1


def nw_mean(x: pd.Series, lags: int = C.NW_LAGS) -> tuple[float, float]:
    """Mean of a series and its Newey-West t-statistic."""
    x = x.dropna()
    fit = sm.OLS(x.to_numpy(), np.ones(len(x))).fit(
        cov_type="HAC", cov_kwds={"maxlags": lags})
    return float(fit.params[0]), float(fit.tvalues[0])


def regress(y: pd.Series, X: pd.DataFrame, lags: int = C.NW_LAGS) -> pd.DataFrame:
    """OLS with an intercept and Newey-West t-statistics."""
    data = pd.concat([y.rename("y"), X], axis=1).dropna()
    fit = sm.OLS(data["y"], sm.add_constant(data[X.columns])).fit(
        cov_type="HAC", cov_kwds={"maxlags": lags})
    out = pd.DataFrame({"coef": fit.params, "t": fit.tvalues})
    out.attrs["r2"] = float(fit.rsquared)
    out.attrs["n"] = int(fit.nobs)
    return out


def sharpe(excess_monthly: pd.Series) -> float:
    """Annualised Sharpe ratio of monthly excess returns."""
    x = excess_monthly.dropna()
    return float(x.mean() / x.std(ddof=1) * np.sqrt(12))


def psr(x: pd.Series, sr_star: float = 0.0) -> float:
    """Probabilistic Sharpe Ratio, per-period Sharpe ratios throughout."""
    x = x.dropna()
    sr = x.mean() / x.std(ddof=1)
    g3, g4 = stats.skew(x), stats.kurtosis(x, fisher=False)
    denom = np.sqrt(1 - g3 * sr + (g4 - 1) / 4 * sr ** 2)
    return float(stats.norm.cdf((sr - sr_star) * np.sqrt(len(x) - 1) / denom))


def expected_max_sharpe(trial_srs: np.ndarray) -> float:
    """Expected maximum per-period Sharpe ratio of N skill-free trials."""
    n = len(trial_srs)
    sd = np.std(trial_srs, ddof=1)
    return float(sd * ((1 - EULER) * stats.norm.ppf(1 - 1 / n)
                       + EULER * stats.norm.ppf(1 - 1 / (n * np.e))))


def dsr(x: pd.Series, trial_srs: np.ndarray) -> float:
    """Deflated Sharpe Ratio: PSR against the expected best of the trials."""
    return psr(x, expected_max_sharpe(np.asarray(trial_srs)))


def bootstrap_sharpe(x: pd.Series, n: int = C.N_BOOT, block: int = C.BOOT_BLOCK,
                     seed: int = C.SEED) -> tuple[float, float]:
    """95% interval for the annualised Sharpe ratio, stationary bootstrap."""
    v = x.dropna().to_numpy()
    T, rng = len(v), np.random.default_rng(seed)
    out = np.empty(n)
    for b in range(n):
        idx = np.empty(T, dtype=int)
        idx[0] = rng.integers(T)
        jump = rng.random(T) < 1 / block
        fresh = rng.integers(T, size=T)
        for t in range(1, T):
            idx[t] = fresh[t] if jump[t] else (idx[t - 1] + 1) % T
        s = v[idx]
        out[b] = s.mean() / s.std(ddof=1) * np.sqrt(12)
    return float(np.percentile(out, 2.5)), float(np.percentile(out, 97.5))


def risk_free(iima: pd.DataFrame, months: pd.PeriodIndex) -> pd.Series:
    """Monthly risk-free rate, last IIMA value carried forward."""
    rf = iima["RF"].dropna()
    return rf.reindex(rf.index.union(months)).ffill().reindex(months)


def summary(daily: pd.Series, rf: pd.Series, bench: pd.Series | None = None) -> dict:
    """The headline statistics of one daily return series."""
    m = monthly(daily)
    ex = m - rf.reindex(m.index)
    years = len(m) / 12
    nav = float((1 + m).prod())
    dd = drawdown(daily)
    cagr = nav ** (1 / years) - 1
    out = {
        "months": len(m),
        "cagr": cagr,
        "vol": float(m.std(ddof=1) * np.sqrt(12)),
        "sharpe": sharpe(ex),
        "sortino": float(ex.mean() / np.sqrt((np.minimum(ex, 0) ** 2).mean()) * np.sqrt(12)),
        "maxDrawdown": float(dd.min()),
        "calmar": float(cagr / abs(dd.min())) if dd.min() < 0 else np.nan,
        "hitRate": float((m > 0).mean()),
        "meanExcessT": nw_mean(ex)[1],
    }
    if bench is not None:
        b = monthly(bench).reindex(m.index)
        active = m - b
        fit = regress(ex, (b - rf.reindex(m.index)).rename("bench").to_frame())
        out.update({
            "activeReturn": float(active.mean() * 12),
            "trackingError": float(active.std(ddof=1) * np.sqrt(12)),
            "infoRatio": float(active.mean() / active.std(ddof=1) * np.sqrt(12)),
            "activeT": nw_mean(active)[1],
            "alpha": float(fit.loc["const", "coef"] * 12),
            "alphaT": float(fit.loc["const", "t"]),
            "beta": float(fit.loc["bench", "coef"]),
        })
    return out
