"""Portfolio construction and the daily backtest.

Timing
------
A signal is computed from closes up to its signal date s (a month-end). The
portfolio is traded at the close of the next session, f = s + EXEC_LAG, so the
close that produced the signal is never also the price paid. Old holdings earn
session f's return; the new weights take effect from f + 1.

Between rebalances the weights drift with prices: a stock that rises becomes a
larger share of the portfolio, exactly as in a real account. At each
rebalance the trade is the difference between the target weights and the
drifted weights, and the cost is charged on that difference.

Costs
-----
Per side, as a fraction of the value traded: securities transaction tax on
both sides, stamp duty on purchases, exchange and SEBI charges with GST on
them, and a spread that depends on the stock's liquidity tercile on the signal
date. The rates are in config.py.
"""
import sys

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import config as C  # noqa: E402
from signals import fill_dates  # noqa: E402


@dataclass
class Result:
    gross: pd.Series        # daily return before costs
    cost: pd.Series         # daily cost as a fraction of portfolio value
    turnover: pd.Series     # one-way turnover at each rebalance, by signal date
    names: pd.Series        # stocks held after each rebalance

    @property
    def net(self) -> pd.Series:
        return (1 + self.gross) * (1 - self.cost) - 1


def cost_rates(tercile: pd.Series, mult: float = 1.0) -> tuple[np.ndarray, np.ndarray]:
    """Per-stock cost of buying and of selling one rupee, for one signal date."""
    fees = (C.EXCHANGE + C.SEBI_FEE + C.BROKERAGE) * (1 + C.GST)
    spread = np.asarray(C.SPREAD_BPS, dtype=float)[tercile.to_numpy(dtype=int)] / 1e4
    buy = C.STT + C.STAMP_BUY + fees + spread
    sell = C.STT + fees + spread
    return buy * mult, sell * mult


def simulate(targets: pd.DataFrame, returns: pd.DataFrame, tercile: pd.DataFrame,
             cost_mult: float = 1.0, lag: int = C.EXEC_LAG) -> Result:
    """Run target weights (signal dates x stocks) through daily returns."""
    idx, cols = returns.index, returns.columns
    targets = targets.reindex(columns=cols).fillna(0.0)
    sums = targets.sum(axis=1)
    if not np.all(np.isclose(sums, 1.0) | np.isclose(sums, 0.0)):
        raise ValueError("target weights must sum to one (or zero) on every date")
    tercile = tercile.reindex(index=targets.index, columns=cols).fillna(C.LIQ_TERCILES - 1)
    R = returns.fillna(0.0).to_numpy()

    fills = fill_dates(idx, targets.index, lag).dropna()
    fpos = idx.get_indexer(pd.DatetimeIndex(fills.to_numpy()))
    sdates = fills.index

    gross = np.zeros(len(idx))
    cost = np.zeros(len(idx))
    turnover, names = {}, {}
    w = np.zeros(len(cols))

    for k, (s, f) in enumerate(zip(sdates, fpos)):
        target = targets.loc[s].to_numpy()
        dw = target - w
        buy, sell = cost_rates(tercile.loc[s], cost_mult)
        cost[f] += float((np.clip(dw, 0, None) * buy + np.clip(-dw, 0, None) * sell).sum())
        turnover[s] = 0.5 * float(np.abs(dw).sum())
        names[s] = int((target != 0).sum())

        end = fpos[k + 1] if k + 1 < len(fpos) else len(idx) - 1
        held = np.flatnonzero(target)
        if end <= f or held.size == 0:
            w = target
            continue
        growth = np.cumprod(1 + R[f + 1:end + 1][:, held], axis=0)
        value = growth @ target[held]
        prev = np.concatenate([[1.0], value[:-1]])
        gross[f + 1:end + 1] = value / prev - 1
        w = np.zeros(len(cols))
        w[held] = target[held] * growth[-1] / value[-1]

    return Result(gross=pd.Series(gross, idx), cost=pd.Series(cost, idx),
                  turnover=pd.Series(turnover), names=pd.Series(names))


# ----------------------------------------------------------------------
# Target weights
# ----------------------------------------------------------------------
def quantile_weights(score: pd.DataFrame, top: bool = True,
                     q: int = C.QUANTILES) -> pd.DataFrame:
    """Equal weights on the top (or bottom) 1/q of each date's scored stocks."""
    pct = score.rank(axis=1, pct=True)
    pick = pct > 1 - 1 / q if top else pct <= 1 / q
    return pick.div(pick.sum(axis=1), axis=0).fillna(0.0)


def equal_weights(eligible: pd.DataFrame) -> pd.DataFrame:
    e = eligible.astype(float)
    return e.div(e.sum(axis=1), axis=0).fillna(0.0)


def buffered_weights(score: pd.DataFrame, q: int = C.QUANTILES,
                     exit_frac: float = C.BUFFER_EXIT) -> pd.DataFrame:
    """Top 1/q, but a holding stays until it leaves the top `exit_frac`.

    The portfolio keeps the target count of names: retained holdings first,
    best-ranked, then new entries by rank until the count is met.
    """
    out = pd.DataFrame(0.0, index=score.index, columns=score.columns)
    held: set = set()
    for d, row in score.iterrows():
        row = row.dropna()
        if row.empty:
            continue
        n = max(1, int(round(len(row) / q)))
        pct = row.rank(pct=True)
        keep = [t for t in pct.sort_values(ascending=False).index
                if t in held and pct[t] > 1 - exit_frac][:n]
        new = [t for t in pct.sort_values(ascending=False).index if t not in keep]
        chosen = keep + new[: n - len(keep)]
        out.loc[d, chosen] = 1.0 / len(chosen)
        held = set(chosen)
    return out
