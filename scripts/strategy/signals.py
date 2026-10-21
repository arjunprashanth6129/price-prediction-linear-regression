"""Signals, eligibility and forward returns, evaluated at month-end signal dates.

Everything here takes the cleaned daily panel and returns frames indexed by
signal date (the last session of each calendar month) with one column per
stock. Each value uses prices up to and including its signal date and nothing
later. tests/test_lookahead.py checks this by corrupting every price after a
date and asserting that nothing up to that date changes.

The only forward-looking quantity is the target, forward_returns(), which is
what a portfolio formed on the signal date goes on to earn. It is used to
score signals and to fit the cross-sectional regressions, and a regression's
slopes are used only once its target period has ended (models.py).
"""
import sys

from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import config as C  # noqa: E402


def signal_dates(index: pd.DatetimeIndex) -> pd.DatetimeIndex:
    """Last session of each calendar month in `index`."""
    s = index.to_series()
    return pd.DatetimeIndex(s.groupby(index.to_period("M")).max().to_numpy())


def fill_dates(index: pd.DatetimeIndex, dates: pd.DatetimeIndex,
               lag: int = C.EXEC_LAG) -> pd.Series:
    """The session on which a signal dated `d` is traded, or NaT past the end."""
    pos = index.get_indexer(dates) + lag
    out = [index[p] if p < len(index) else pd.NaT for p in pos]
    return pd.Series(out, index=dates)


def raw_signals(adj: pd.DataFrame, traded_value: pd.DataFrame,
                dates: pd.DatetimeIndex, mom: tuple[int, int] = (252, 21)
                ) -> dict[str, pd.DataFrame]:
    """Every candidate signal at each signal date, before standardisation.

    `mom` is (lookback, skip) in sessions for MOM_12_1; only the sensitivity
    runs change it.
    """
    p = adj.ffill()
    r = p.pct_change(fill_method=None)
    full = {"min_periods": C.MIN_HISTORY}

    out = {
        "MOM_12_1": p.shift(mom[1]) / p.shift(mom[0]) - 1,
        "HIGH52": p / p.rolling(252, **full).max(),
        "LOWVOL": -r.rolling(252, **full).std(),
        "REV_1M": -(p / p.shift(21) - 1),
        "VOLSHOCK": np.log(traded_value.rolling(20, min_periods=10).mean()
                           / traded_value.rolling(252, min_periods=126).mean()),
    }
    for L in C.TREND_LAGS:
        out[f"TREND_{L}"] = p.rolling(L, min_periods=L).mean() / p
    return {k: out[k].reindex(dates) for k in C.CANDIDATES}


def eligibility(adj: pd.DataFrame, traded: pd.DataFrame,
                traded_value: pd.DataFrame, dates: pd.DatetimeIndex,
                top_n: int | None = None, recent: int | None = None):
    """Point-in-time universe and liquidity tercile at each signal date.

    Returns (eligible, tercile): eligible is boolean; tercile is 0 for the
    most liquid third of the eligible stocks, 2 for the least, and is also
    assigned to ineligible stocks using the eligible stocks' breakpoints, so a
    position being sold always has a spread cost.

    The survivorship-free panels add two rules (Panel.universe): `top_n`
    keeps only the most traded stocks by the same median traded value, before
    the least liquid fifth is dropped, so the universe is the size of the
    Nifty 500 at every date; `recent` requires a trade in the last `recent`
    sessions, so a stock that has stopped trading is not bought at its last
    price.
    """
    history = adj.notna().cumsum().reindex(dates)
    active = traded.rolling(C.TRADED_WINDOW, min_periods=1).mean().reindex(dates)
    liq = traded_value.fillna(0).rolling(C.LIQ_WINDOW, min_periods=1).median().reindex(dates)
    priced = adj.ffill().reindex(dates).notna()

    base = (history >= C.MIN_HISTORY) & (active >= C.MIN_TRADED_FRAC) & priced
    if recent:
        base &= traded.rolling(recent, min_periods=1).max().reindex(dates).fillna(0).astype(bool)
    if top_n:
        base &= liq.where(base).rank(axis=1, ascending=False, method="first") <= top_n
    cut = liq.where(base).quantile(C.LIQ_DROP_FRAC, axis=1)
    eligible = base & liq.ge(cut, axis=0)

    edges = [liq.where(eligible).quantile(1 - q / C.LIQ_TERCILES, axis=1)
             for q in range(1, C.LIQ_TERCILES)]
    tercile = pd.DataFrame(C.LIQ_TERCILES - 1, index=dates, columns=adj.columns)
    for k, edge in reversed(list(enumerate(edges))):
        tercile = tercile.mask(liq.ge(edge, axis=0), k)
    tercile = tercile.where(liq.notna(), C.LIQ_TERCILES - 1)
    return eligible, tercile


def standardise(raw: pd.DataFrame, eligible: pd.DataFrame) -> pd.DataFrame:
    """Winsorise and z-score across the eligible stocks of each date."""
    x = raw.where(eligible)
    lo = x.quantile(C.WINSOR[0], axis=1)
    hi = x.quantile(C.WINSOR[1], axis=1)
    x = x.clip(lower=lo, upper=hi, axis=0)
    return x.sub(x.mean(axis=1), axis=0).div(x.std(axis=1), axis=0)


def forward_returns(adj: pd.DataFrame, dates: pd.DatetimeIndex,
                    months: int = 1, lag: int = C.EXEC_LAG) -> pd.DataFrame:
    """Return from the fill after each signal date to the fill `months` later.

    This is exactly what a position opened on the signal earns before costs,
    so signal scores and backtest returns measure the same thing. Rows whose
    end lies beyond the data are NaN.
    """
    p = adj.ffill()
    fills = fill_dates(adj.index, dates, lag)
    start = p.reindex(fills.to_numpy())
    end = p.reindex(fills.shift(-months).to_numpy())
    out = pd.DataFrame(end.to_numpy() / start.to_numpy() - 1,
                       index=dates, columns=adj.columns)
    return out
