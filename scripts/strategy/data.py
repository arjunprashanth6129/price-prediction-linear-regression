"""Load the committed raw files and clean them into one panel.

Every stage reads prices through load_panel(), so every stage sees the same
cleaned data and the same holdout truncation. The cleaning is deterministic and
each rule is listed in the report that 02_clean.py writes.

Cleaning rules, applied in this order
-------------------------------------
1. Sparse sessions. Rows where fewer than half the usual number of stocks
   have a price are Yahoo calendar artefacts (stray Saturdays) and are dropped.

2. Long suspensions. A stock with 60 or more consecutive sessions without a
   trade restarts its history after the gap. Yahoo fills such stretches with a
   frozen price and zero volume, and three stocks show 1,238 of them before
   2010; a "return" measured across the gap is not one anyone could have
   earned, and signals computed over it are meaningless.

3. Reverting spikes. A move of more than 25% that returns to within 10% of
   the prior price within five sessions is a bad tick. Those prices are
   removed. On 28 July 2005 dozens of stocks show this pattern at once.

4. Breaks. A return is replaced by zero, and every earlier price rescaled to
   meet the later one, when the move reflects a change in what one share
   represents rather than a change in its value:
     a. stock-specific moves beyond 0.5 in log terms (about -40% or +65%).
        NSE price bands make such moves practically impossible in normal
        trading, and every one in this sample sits on a split, bonus,
        demerger, relisting or data error;
     b. a Yahoo defect: when a split or bonus happens partway through a year,
        Yahoo adjusts only that year's prices, leaving a drop of the exact
        capital-change ratio on the year's first session. Detected as a
        first-session fall of 15% or more within 0.02 log of a standard ratio,
        on volume no higher than three times normal;
     c. demergers verified against exchange notices, listed in
        corporate_actions.csv with their sources.
   Setting the ex-date return to zero assumes a holder kept the value of the
   spun-off shares, which is what a demerger delivers on that day.

Only the split-and-dividend-adjusted close is repaired. Traded value is the
split-adjusted close times split-adjusted volume, a rupee amount that splits
and bonuses leave unchanged, so it needs no repair.

Data sources
------------
The environment variable STRATEGY_SOURCE picks the panel every stage uses:

    survivor        (default) Yahoo prices for today's Nifty 500, cleaned as
                    above. Every stock in it survived to 2026.
    pit             NSE's own daily files for every equity that was among the
                    1,000 most traded at some month-end, including the ones
                    that later failed, merged or delisted (nse.py). The
                    universe is rebuilt at each month-end from what was
                    trading then.
    pit-survivors   the pit panel restricted to today's Nifty 500 names. Its
                    difference from `survivor` is the change of data source;
                    its difference from `pit` is the survivorship bias.

Each source writes to its own results, data and figure paths (outputs()).
"""
import hashlib
import os
import pickle
import sys

from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
import config as C  # noqa: E402

RAW = HERE / "raw"
CACHE = HERE / "cache"
ACTIONS = HERE / "corporate_actions.csv"

SOURCES = ("survivor", "pit", "pit-survivors")
SOURCE = os.environ.get("STRATEGY_SOURCE", "survivor")
if SOURCE not in SOURCES:
    raise ValueError(f"STRATEGY_SOURCE must be one of {SOURCES}, not {SOURCE!r}")
INDEX_LABELS = {"NIFTY50": "Nifty 50 (price index)", "NIFTY500": "Nifty 500 (price index)"}
if SOURCE != "survivor":
    INDEX_LABELS = {"NIFTY50": "Nifty 50 (total return)", "NIFTY500": "Nifty 500 (total return)",
                    "NIFTY500_EW": "Nifty500 Equal Weight (total return)",
                    "NIFTY500_MOM50": "Nifty500 Momentum 50 (total return)"}


def outputs(source: str = SOURCE) -> tuple[Path, Path, str]:
    """(results directory, data directory, figure file prefix) for a source."""
    if source == "survivor":
        return ROOT / "results" / "strategy", ROOT / "data" / "strategy", "strategy-"
    return (ROOT / "results" / "strategy" / source, ROOT / "data" / "strategy" / source,
            f"strategy-{source}-")

SPARSE_FRAC = 0.5
MAX_GAP = 60
SPIKE_JUMP = np.log(1.25)
SPIKE_BACK = np.log(1.10)
SPIKE_MAX_LEN = 5
BREAK_LOG = 0.5
YEAR_FALL = np.log(0.85)
YEAR_TOL = 0.02
YEAR_MAX_VOL = 3.0
NICE_RATIOS = np.log([1 / 2, 2 / 3, 1 / 3, 1 / 4, 3 / 4, 1 / 5, 4 / 5, 1 / 10])


@dataclass
class Panel:
    """Cleaned daily data, sessions x stocks."""
    adj: pd.DataFrame            # adjusted close used for returns
    traded_value: pd.DataFrame   # rupees traded
    traded: pd.DataFrame         # True when the stock traded that session
    industry: pd.Series          # NSE industry label per stock
    report: dict = field(default_factory=dict)
    universe: dict = field(default_factory=dict)   # extra eligibility rules, see signals.eligibility

    @property
    def returns(self) -> pd.DataFrame:
        """Daily simple returns: zero on sessions without a new price, NaN
        before a stock's first price."""
        return self.adj.ffill().pct_change(fill_method=None)


def _read(name: str) -> pd.DataFrame:
    df = pd.read_csv(RAW / name, index_col="Date", parse_dates=True)
    return df.sort_index()


def _restart_after_gaps(adj: pd.DataFrame, traded: pd.DataFrame) -> list[tuple]:
    """Blank each stock's history up to the end of its last long suspension."""
    cuts = []
    for t in adj.columns:
        first = adj[t].first_valid_index()
        if first is None:
            continue
        off = ~traded[t].loc[first:]
        run = off.astype(int).groupby((~off).cumsum()).cumsum()
        long_runs = run[run >= MAX_GAP]
        if long_runs.empty:
            continue
        # The restart is the first traded session after the last long gap.
        after = traded[t].loc[long_runs.index.max():]
        if not after.any():
            adj[t] = np.nan
            cuts.append((t, None, int(run.max())))
            continue
        restart = after[after].index.min()
        adj.loc[adj.index < restart, t] = np.nan
        cuts.append((t, str(restart.date()), int(run.max())))
    return cuts


def _despike(s: pd.Series) -> list:
    v = np.log(s.dropna())
    x, idx = v.to_numpy(), v.index
    bad, i = [], 1
    while i < len(x):
        base = x[i - 1]
        if abs(x[i] - base) > SPIKE_JUMP:
            for k in range(i, min(i + SPIKE_MAX_LEN, len(x) - 1)):
                if abs(x[k + 1] - base) < SPIKE_BACK:
                    bad.extend(idx[i:k + 1])
                    i = k + 1
                    break
        i += 1
    return bad


def _apply_break(adj: pd.DataFrame, ticker: str, date: pd.Timestamp) -> float:
    """Rescale prices before `date` so the return on `date` is zero."""
    s = adj[ticker]
    prev = s.loc[:date].iloc[:-1].last_valid_index()
    if prev is None or pd.isna(s.get(date)):
        return np.nan
    factor = s.loc[date] / s.loc[prev]
    adj.loc[adj.index < date, ticker] = s.loc[adj.index < date] * factor
    return float(factor - 1)


def _clean(adj, close, volume, members) -> Panel:
    report: dict = {}

    counts = adj.notna().sum(axis=1)
    usual = counts.rolling(21, center=True, min_periods=1).median()
    keep = counts >= SPARSE_FRAC * usual
    report["sparseSessions"] = [str(d.date()) for d in keep.index[~keep]]
    adj, close, volume = adj[keep].copy(), close[keep], volume[keep]

    traded = adj.notna() & (volume.fillna(0) > 0)
    report["restarts"] = _restart_after_gaps(adj, traded)

    spikes = {}
    for t in adj.columns:
        bad = _despike(adj[t])
        if bad:
            adj.loc[bad, t] = np.nan
            spikes[t] = [str(d.date()) for d in bad]
    report["spikes"] = spikes

    breaks = []
    actions = pd.read_csv(ACTIONS, parse_dates=["date"], comment="#")
    for row in actions.itertuples():
        if row.ticker in adj.columns:
            move = _apply_break(adj, row.ticker, row.date)
            breaks.append((row.ticker, str(row.date.date()), move, f"listed: {row.kind}"))

    lr = np.log(adj.ffill()).diff().where(adj.notna())
    mkt = lr.median(axis=1)
    excess = lr.sub(mkt, axis=0)
    for (d, t), e in excess.stack().items():
        if abs(e) > BREAK_LOG:
            move = _apply_break(adj, t, d)
            breaks.append((t, str(d.date()), move, "rule a: stock-specific log move beyond 0.5"))

    lr = np.log(adj.ffill()).diff().where(adj.notna())
    typical_vol = volume.rolling(20, min_periods=5).median().shift(1)
    firsts = adj.index.to_series().groupby(adj.index.year).min()
    for d in firsts:
        for t, x in lr.loc[d].dropna().items():
            near = NICE_RATIOS[np.argmin(abs(NICE_RATIOS - x))]
            calm = volume.loc[d, t] <= YEAR_MAX_VOL * typical_vol.loc[d, t]
            if x <= YEAR_FALL and abs(x - near) < YEAR_TOL and calm:
                move = _apply_break(adj, t, d)
                breaks.append((t, str(d.date()), move,
                               f"rule b: year-start capital change, ratio {np.exp(near):.3f}"))
    report["breaks"] = sorted(breaks, key=lambda b: b[1])

    traded = adj.notna() & (volume.reindex_like(adj).fillna(0) > 0)
    tv = (close * volume).reindex_like(adj).where(traded)
    industry = members.set_index("Symbol")["Industry"].reindex(adj.columns)
    return Panel(adj=adj, traded_value=tv, traded=traded, industry=industry,
                 report=report)


def _fingerprint(source: str, distress) -> str:
    h = hashlib.sha256(f"{source}|{distress}".encode())
    files = [p for p in sorted(RAW.glob("*")) if p.is_file()] + [ACTIONS, Path(__file__)]
    if source != "survivor":
        files += sorted((RAW / "nse").glob("*")) + [HERE / "nse.py", HERE / "config.py"]
    for p in files:
        h.update(p.name.encode())
        h.update(p.read_bytes())
    return h.hexdigest()[:16]


def _build_pit(distress) -> Panel:
    import nse
    built = nse.build(distress, reference=load_panel(full=True, source="survivor").adj)
    return Panel(adj=built["adj"], traded_value=built["traded_value"], traded=built["traded"],
                 industry=pd.Series(np.nan, index=built["adj"].columns, dtype=object),
                 report=built["report"],
                 universe={"top_n": C.PIT_TOP_N, "recent": C.PIT_RECENT})


def load_panel(full: bool = False, source: str = SOURCE, distress: float | None = None) -> Panel:
    """The cleaned panel, truncated at DEV_END until the holdout is unlocked.

    `full=True` returns every session regardless of the lock. Only the
    data-quality reports use it; they compute no returns or signals.
    `distress` overrides the pre-registered exit return of the pit panels,
    for the bounds reported alongside the result.
    """
    CACHE.mkdir(exist_ok=True)
    base = "survivor" if source == "survivor" else "pit"
    cache = CACHE / f"panel-{base}-{_fingerprint(base, distress)}.pkl"
    if cache.exists():
        panel = pickle.loads(cache.read_bytes())
    else:
        if base == "survivor":
            members = pd.read_csv(RAW / "nifty500_list.csv")
            panel = _clean(_read("adj_close.csv.gz"), _read("close.csv.gz"),
                           _read("volume.csv.gz"), members)
        else:
            panel = _build_pit(distress)
        for old in CACHE.glob(f"panel-{base}-*.pkl"):
            if distress is None or old.name == cache.name:
                old.unlink(missing_ok=True)
        cache.write_bytes(pickle.dumps(panel))

    if source == "pit-survivors":
        members = set(pd.read_csv(RAW / "nifty500_list.csv")["Symbol"].str.strip())
        keep = [c for c in panel.adj.columns if c.split("~")[0] in members]
        panel = Panel(adj=panel.adj[keep], traded_value=panel.traded_value[keep],
                      traded=panel.traded[keep], industry=panel.industry[keep],
                      report=panel.report, universe=panel.universe)

    if full or C.HOLDOUT_UNLOCKED:
        return panel
    end = pd.Timestamp(C.DEV_END)
    return Panel(adj=panel.adj.loc[:end], traded_value=panel.traded_value.loc[:end],
                 traded=panel.traded.loc[:end], industry=panel.industry,
                 report=panel.report, universe=panel.universe)


def load_iima() -> pd.DataFrame:
    """IIMA monthly factors in decimals, indexed by month-end."""
    df = pd.read_csv(RAW / "iima_monthly.csv", na_values="NA")
    df.index = pd.PeriodIndex(df.pop("Date"), freq="M")
    df = df / 100.0
    if not C.HOLDOUT_UNLOCKED:
        df = df.loc[: pd.Period(C.DEV_END, "M")]
    return df


def load_indices(source: str = SOURCE) -> pd.DataFrame:
    """Benchmark index levels: Yahoo's price indices for the survivor source,
    NSE Indices' total return indices for the pit sources."""
    if source == "survivor":
        df = _read("indices.csv.gz")
    else:
        df = pd.read_csv(RAW / "nse" / "index_tri.csv", index_col="Date", parse_dates=True)
    if not C.HOLDOUT_UNLOCKED:
        df = df.loc[: pd.Timestamp(C.DEV_END)]
    return df
