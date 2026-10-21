"""The two ways of combining signals into one score per stock and date.

M2, composite: the average of the selected signals' z-scores, each multiplied
by the sign it showed in the development period. Nothing is estimated beyond
those signs, so it is the benchmark for whether estimation adds anything.

M3, walk-forward Fama-MacBeth: on every signal date k, the cross-section of
the next month's returns (winsorised like the signals) is regressed on the
selected signals. The forecast on date s uses the mean of every slope whose
target period had ended by s; the newest of those is two months old, because
the regression fitted on the previous signal date still needs the current
month's returns. With an expanding mean and FM_MIN_MONTHS completed
regressions required, the model's weights at any date are a function of the
past alone.
"""
import sys

from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import config as C  # noqa: E402
from signals import fill_dates  # noqa: E402


def composite(z: dict[str, pd.DataFrame], signs: dict[str, int]) -> pd.DataFrame:
    parts = [z[k] * s for k, s in signs.items()]
    stacked = np.stack([p.to_numpy() for p in parts])
    # A stock needs every selected signal; a mean over the ones present would
    # rank a stock with one strong signal above one with four average ones.
    score = np.where(np.isnan(stacked).any(axis=0), np.nan, stacked.mean(axis=0))
    return pd.DataFrame(score, index=parts[0].index, columns=parts[0].columns)


def winsorise(x: pd.DataFrame) -> pd.DataFrame:
    lo = x.quantile(C.WINSOR[0], axis=1)
    hi = x.quantile(C.WINSOR[1], axis=1)
    return x.clip(lower=lo, upper=hi, axis=0)


def cross_section_slopes(z: dict[str, pd.DataFrame], fwd: pd.DataFrame) -> pd.DataFrame:
    """One OLS per signal date: winsorised forward return on the signals."""
    names = list(z)
    y_all = winsorise(fwd)
    rows = {}
    for d in fwd.index:
        X = np.column_stack([z[k].loc[d].to_numpy() for k in names])
        y = y_all.loc[d].to_numpy()
        ok = ~np.isnan(X).any(axis=1) & ~np.isnan(y)
        if ok.sum() < len(names) + 10:
            continue
        A = np.column_stack([np.ones(ok.sum()), X[ok]])
        beta, *_ = np.linalg.lstsq(A, y[ok], rcond=None)
        rows[d] = beta[1:]
    return pd.DataFrame.from_dict(rows, orient="index", columns=names)


def fm_forecast(z: dict[str, pd.DataFrame], fwd: pd.DataFrame,
                index: pd.DatetimeIndex, rolling: int | None = None,
                min_months: int = C.FM_MIN_MONTHS) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Expected-return scores and the slope means behind them.

    `index` is the daily session index, used to find when each regression's
    target period ends (the fill one month after its signal date).
    """
    slopes = cross_section_slopes(z, fwd)
    dates = fwd.index
    target_end = fill_dates(index, dates).shift(-1).reindex(slopes.index)

    means, scores = {}, {}
    for s in dates:
        known = slopes[target_end <= s]
        if rolling:
            known = known.iloc[-rolling:]
        if len(known) < min_months:
            continue
        b = known.mean()
        means[s] = b
        X = np.stack([z[k].loc[s].to_numpy() for k in b.index])
        scores[s] = pd.Series(np.einsum("k,kn->n", b.to_numpy(), X), index=fwd.columns)
    return (pd.DataFrame(scores).T.reindex(dates),
            pd.DataFrame(means).T.reindex(dates))
