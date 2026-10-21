"""Shared fixtures: a synthetic panel, so the tests run in seconds and do not
depend on the committed price files."""
import sys

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts" / "strategy"))


@pytest.fixture
def panel():
    """40 stocks over 900 sessions; some list late and some miss sessions."""
    rng = np.random.default_rng(7)
    idx = pd.bdate_range("2010-01-01", periods=900)
    cols = [f"S{i:02d}" for i in range(40)]
    r = rng.normal(0.0004, 0.02, size=(len(idx), len(cols)))
    adj = pd.DataFrame(100 * np.exp(np.cumsum(r, axis=0)), idx, cols)
    volume = pd.DataFrame(rng.integers(1_000, 100_000, size=adj.shape), idx, cols).astype(float)
    adj.iloc[:300, :5] = np.nan              # five late listings
    volume.iloc[:300, :5] = np.nan
    gaps = rng.random(adj.shape) < 0.02      # untraded sessions
    volume = volume.mask(gaps, 0.0)
    traded = adj.notna() & (volume > 0)
    tv = (adj * volume).where(traded)
    return adj, traded, tv
