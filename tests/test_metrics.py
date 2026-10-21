"""Metric functions against values computed by hand."""
import numpy as np
import pandas as pd

import metrics as M


def test_monthly_compounding():
    idx = pd.to_datetime(["2020-01-02", "2020-01-03", "2020-02-03"])
    m = M.monthly(pd.Series([0.10, -0.10, 0.05], idx))
    assert np.isclose(m.iloc[0], 1.1 * 0.9 - 1)
    assert np.isclose(m.iloc[1], 0.05)


def test_drawdown():
    idx = pd.bdate_range("2020-01-01", periods=4)
    dd = M.drawdown(pd.Series([0.10, -0.50, 0.20, 0.0], idx))
    assert np.isclose(dd.min(), -0.5)


def test_sharpe_and_nw_mean():
    rng = np.random.default_rng(0)
    x = pd.Series(rng.normal(0.01, 0.04, 240))
    assert np.isclose(M.sharpe(x), x.mean() / x.std(ddof=1) * np.sqrt(12))
    mean, t = M.nw_mean(x, lags=0)
    assert np.isclose(mean, x.mean())
    assert np.isclose(t, x.mean() / (x.std(ddof=0) / np.sqrt(len(x))), rtol=1e-6)


def test_psr_is_one_half_at_its_own_sharpe():
    rng = np.random.default_rng(1)
    x = pd.Series(rng.normal(0.01, 0.04, 240))
    sr = x.mean() / x.std(ddof=1)
    assert np.isclose(M.psr(x, sr), 0.5)
    assert M.psr(x, 0.0) > 0.5


def test_dsr_penalises_more_trials():
    rng = np.random.default_rng(2)
    x = pd.Series(rng.normal(0.01, 0.04, 240))
    few = rng.normal(0, 0.05, 5)
    many = rng.normal(0, 0.05, 500)
    assert M.expected_max_sharpe(many) > M.expected_max_sharpe(few)
    assert M.dsr(x, many) < M.dsr(x, few)


def test_bootstrap_interval_contains_estimate():
    rng = np.random.default_rng(3)
    x = pd.Series(rng.normal(0.01, 0.04, 200))
    lo, hi = M.bootstrap_sharpe(x, n=400)
    assert lo < M.sharpe(x) < hi
