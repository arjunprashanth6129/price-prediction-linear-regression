"""Nothing dated on or before T may depend on a price after T.

Every price and volume after T is replaced with noise, and every
signal, eligibility flag, liquidity tercile, standardised score, composite and
Fama-MacBeth forecast dated on or before T is required to be unchanged.
"""
import numpy as np
import pandas as pd

import config as C
import models
import signals as S


def build(adj, traded, tv):
    dates = S.signal_dates(adj.index)
    raw = S.raw_signals(adj, tv, dates)
    elig, terc = S.eligibility(adj, traded, tv, dates)
    z = {k: S.standardise(v, elig) for k, v in raw.items()}
    fwd = S.forward_returns(adj, dates)
    picks = {"MOM_12_1": 1, "LOWVOL": 1, "TREND_20": -1}
    comp = models.composite(z, picks)
    fm, _ = models.fm_forecast({k: z[k] for k in picks}, fwd, adj.index, min_months=6)
    return dates, raw, elig, terc, z, comp, fm


def corrupt_after(T, adj, traded, tv):
    rng = np.random.default_rng(99)
    after = adj.index > T
    adj2, tv2 = adj.copy(), tv.copy()
    adj2.loc[after] = adj2.loc[after] * rng.uniform(0.2, 5.0, size=adj2.loc[after].shape)
    tv2.loc[after] = tv2.loc[after] * rng.uniform(0.0, 10.0, size=tv2.loc[after].shape)
    traded2 = traded.copy()
    traded2.loc[after] = rng.random(traded2.loc[after].shape) < 0.5
    return adj2, traded2, tv2


def test_nothing_before_T_sees_after_T(panel):
    adj, traded, tv = panel
    T = adj.index[700]
    a = build(adj, traded, tv)
    b = build(*corrupt_after(T, adj, traded, tv))
    past = a[0][a[0] <= T]
    assert len(past) > 20

    for name in C.CANDIDATES:
        pd.testing.assert_frame_equal(a[1][name].loc[past], b[1][name].loc[past])
        pd.testing.assert_frame_equal(a[4][name].loc[past], b[4][name].loc[past])
    pd.testing.assert_frame_equal(a[2].loc[past], b[2].loc[past])
    pd.testing.assert_frame_equal(a[3].loc[past], b[3].loc[past])
    pd.testing.assert_frame_equal(a[5].loc[past], b[5].loc[past])
    pd.testing.assert_frame_equal(a[6].loc[past], b[6].loc[past])
    # The forecasts exist before T, so the comparison is not vacuous.
    assert a[6].loc[past].notna().any().any()


def test_corruption_is_visible_after_T(panel):
    """The same comparison after T must fail, or the test proves nothing."""
    adj, traded, tv = panel
    T = adj.index[700]
    a = build(adj, traded, tv)
    b = build(*corrupt_after(T, adj, traded, tv))
    later = a[0][a[0] > T]
    assert not a[1]["MOM_12_1"].loc[later].equals(b[1]["MOM_12_1"].loc[later])


def test_fm_uses_only_completed_regressions(panel):
    adj, traded, tv = panel
    dates = S.signal_dates(adj.index)
    raw = S.raw_signals(adj, tv, dates)
    elig, _ = S.eligibility(adj, traded, tv, dates)
    z = {"MOM_12_1": S.standardise(raw["MOM_12_1"], elig)}
    fwd = S.forward_returns(adj, dates)
    slopes = models.cross_section_slopes(z, fwd)
    scores, means = models.fm_forecast(z, fwd, adj.index, min_months=3)

    first = means.dropna().index[0]
    ends = S.fill_dates(adj.index, dates).shift(-1).reindex(slopes.index)
    used = slopes[ends <= first]
    assert len(used) == 3
    assert np.isclose(means.loc[first, "MOM_12_1"], used["MOM_12_1"].mean())
    # The slope fitted on the previous signal date is not yet usable.
    prev = dates[dates.get_loc(first) - 1]
    assert prev not in used.index
