"""The backtest engine against hand calculations."""
import numpy as np
import pandas as pd
import pytest

import config as C
import engine as E


def toy(returns: np.ndarray, start="2020-01-27"):
    idx = pd.bdate_range(start, periods=len(returns))
    return pd.DataFrame(returns, idx, ["A", "B", "C"])


def test_drift_matches_share_accounting():
    """Equal weights bought at a fill, then held as share counts."""
    rng = np.random.default_rng(1)
    R = toy(rng.normal(0.001, 0.02, size=(60, 3)))
    signal = R.index[10]
    targets = pd.DataFrame([[1 / 3, 1 / 3, 1 / 3]], [signal], R.columns)
    terc = pd.DataFrame(0, [signal], R.columns)
    res = E.simulate(targets, R, terc, cost_mult=0.0)

    prices = (1 + R).cumprod()
    fill = R.index[11]
    shares = (1 / 3) / prices.loc[fill]
    value = (prices.loc[fill:] * shares).sum(axis=1)
    expected = value.pct_change().iloc[1:]
    np.testing.assert_allclose(res.gross.loc[expected.index], expected, rtol=1e-12, atol=1e-15)
    assert (res.gross.loc[:fill] == 0).all()


def test_rebalance_trades_the_drifted_difference():
    """Turnover at the second rebalance is measured from drifted weights."""
    R = toy(np.zeros((30, 3)))
    R.iloc[12, 0] = 0.10                     # A rises 10% while held
    s1, s2 = R.index[10], R.index[20]
    targets = pd.DataFrame([[0.5, 0.5, 0.0], [0.5, 0.5, 0.0]], [s1, s2], R.columns)
    terc = pd.DataFrame(0, [s1, s2], R.columns)
    res = E.simulate(targets, R, terc, cost_mult=0.0)

    drifted_a = 0.55 / 1.05
    assert np.isclose(res.turnover.loc[s2], abs(drifted_a - 0.5))


def test_cost_arithmetic():
    R = toy(np.zeros((30, 3)))
    s1, s2 = R.index[5], R.index[15]
    targets = pd.DataFrame([[0.5, 0.5, 0.0], [0.0, 0.5, 0.5]], [s1, s2], R.columns)
    terc = pd.DataFrame([[0, 1, 2], [0, 1, 2]], [s1, s2], R.columns)
    res = E.simulate(targets, R, terc)

    fees = (C.EXCHANGE + C.SEBI_FEE + C.BROKERAGE) * (1 + C.GST)
    spread = np.array(C.SPREAD_BPS) / 1e4
    buy = C.STT + C.STAMP_BUY + fees + spread
    sell = C.STT + fees + spread
    first = 0.5 * buy[0] + 0.5 * buy[1]
    second = 0.5 * sell[0] + 0.5 * buy[2]
    assert np.isclose(res.cost.loc[R.index[6]], first)
    assert np.isclose(res.cost.loc[R.index[16]], second)
    assert np.isclose(res.cost.sum(), first + second)


@pytest.mark.parametrize("lag, earned", [(1, False), (0, True)])
def test_execution_lag(lag, earned):
    """A jump on the session after the signal is earned only with no lag."""
    R = toy(np.zeros((20, 3)))
    signal = R.index[5]
    R.loc[R.index[6], "A"] = 0.10
    targets = pd.DataFrame([[1.0, 0.0, 0.0]], [signal], R.columns)
    terc = pd.DataFrame(0, [signal], R.columns)
    res = E.simulate(targets, R, terc, cost_mult=0.0, lag=lag)
    assert np.isclose(res.gross.sum(), 0.10 if earned else 0.0)


def test_single_stock_reproduces_its_return():
    rng = np.random.default_rng(3)
    R = toy(rng.normal(0, 0.02, size=(80, 3)))
    dates = R.index[[10, 30, 50]]
    targets = pd.DataFrame([[0, 1.0, 0]] * 3, dates, R.columns)
    terc = pd.DataFrame(0, dates, R.columns)
    res = E.simulate(targets, R, terc, cost_mult=0.0)
    held = R.index[12:]
    np.testing.assert_allclose(res.gross.loc[held], R.loc[held, "B"], rtol=1e-12, atol=1e-15)


def test_weights_must_be_fully_invested():
    R = toy(np.zeros((10, 3)))
    targets = pd.DataFrame([[0.5, 0.2, 0.0]], [R.index[2]], R.columns)
    with pytest.raises(ValueError):
        E.simulate(targets, R, pd.DataFrame(0, targets.index, R.columns))


def test_quantile_and_buffer_weights():
    score = pd.DataFrame([np.arange(10.0), np.arange(10.0)[::-1]],
                         pd.to_datetime(["2020-01-31", "2020-02-28"]),
                         [f"S{i}" for i in range(10)])
    top = E.quantile_weights(score, q=5)
    assert list(top.iloc[0][top.iloc[0] > 0].index) == ["S8", "S9"]
    buf = E.buffered_weights(score, q=5, exit_frac=0.3)
    # Scores reverse completely, so nothing stays in the top 30%.
    assert set(buf.iloc[1][buf.iloc[1] > 0].index) == {"S0", "S1"}
    assert np.allclose(buf.sum(axis=1), 1.0)
