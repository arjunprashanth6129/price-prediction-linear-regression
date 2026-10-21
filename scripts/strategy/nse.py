"""Build the survivorship-free panel from NSE's own daily files (raw/nse/).

The panel holds every equity that was among the 1,000 most traded at some
month-end from 2005, including the companies that later merged, collapsed or
delisted. Stage 1b explains how the files were assembled; this module turns
them into the same Panel that the Yahoo data produces, so every later stage
runs unchanged.

Prices
------
NSE publishes the close each stock actually traded at, with no adjustment for
bonuses, splits or dividends (on the Reliance 1:1 bonus ex-date in September
2017 the bhavcopy's previous close is still 1645.4 and the close 818.1). The
adjusted series is built backwards from the latest close, the same way a data
vendor builds one:

  1. Announced actions, from NSE's corporate action files (January 2010 on).
     A bonus of a:b multiplies the share count by (a+b)/b, a split from face
     value X to Y by X/Y, a consolidation by the inverse; earlier prices are
     divided by that ratio. A rights issue of a:b at price S (face value plus
     the premium NSE quotes) multiplies earlier prices by (bP + aS) / ((a+b)P),
     the standard ex-rights factor. A cash dividend D multiplies earlier prices
     by 1 - D/P, where P is the last close before the ex-date, so a holder
     earns the dividend. Each is checked against the ex-date move: a bonus or
     split must match within 0.25 in logs (a stock in a 20% price band can
     move that far on the day), a rights issue within 0.15, and a dividend of
     more than a fifth of the price within 0.10. Six bonuses and splits
     missing from NSE's files were found and verified against company
     filings (corporate_actions_missing.csv).
  2. Verified demergers listed in corporate_actions.csv, and any stock-specific
     move beyond 15% on the first session of an announced action that the
     files give no usable ratio for (a demerger, an arrangement, a capital
     reduction, a bonus or split whose ratio is missing or did not match the
     price): that session's return is set to zero, which assumes the holder
     kept the value of what was spun off or issued.
  3. Before 2010 there is no corporate action file. For the stocks the first
     study carries, its cleaned Yahoo series (data.py; every repair there was
     checked against a corporate event) is the reference: a session on which
     NSE's unadjusted close falls at least 13% further than that series, with
     no reversal over the next five sessions, is a capital change, and NSE's
     move is set to the reference move. This covers splits, bonuses, both
     together, and demergers. For the rest, a stock-specific fall close to a
     1:2 or 1:3 ratio (within 0.10 in logs) or a 1:4, 1:5 or 1:10 ratio
     (within 0.25), from a session on which the stock traded, in a stock then
     among the 1,000 most traded, is treated as one, and so is any fall of
     more than 80% in one session in any stock (its return is set to zero).
     Both rules were checked on 2010-2026, where NSE's files give the
     answer (02b_validate_nse.py reports the counts): almost every such move
     is a recorded corporate action. Smaller ratios, and less traded stocks,
     are not inferred: there most such moves were real price falls.

Large moves that fit none of these are kept as real returns. That is the
point of the exercise: Satyam's 76% fall on 7 January 2009 is a return a
holder suffered, not an error to repair. Every kept move beyond 40% is listed
in the data-quality report.

Dividends before 2010 are not in any file NSE serves, so returns before 2010
are price returns for every stock alike. From 2010 about one dividend record
in ten gives no amount ("INTERIM DIVIDEND"); those dividends are missed for
every stock alike.

Exits
-----
A stock exits when it stops trading: it is delisted, merged, or suspended for
60 sessions or more. A holder's outcome on that day is unknown from prices, so
it is set by a rule fixed before any backtest:

    merged or voluntarily delisted      0%      the holder receives the acquirer's
                                                shares or the exit offer, which
                                                is at or above the market price
    suspended and later resumed         the actual change from the last close
                                        before the suspension to the first
                                        close after it
    compulsorily delisted or            -30%    Shumway's (1997) convention for
    liquidated, or in distress                  performance-related delistings

The exit return is booked on the session after the last trade, as one final
price; the position then earns nothing until the next rebalance sells it. A
stock that resumes after a suspension starts a new history under the name
SYMBOL~2, as a fresh listing would.

How a stock left is taken from NSE's delisted list (which ends in 2020), then
from any amalgamation, merger, arrangement or delisting the corporate action
files record around its last trade. Failing both, the stock's own record
decides: a stock that NSE had moved to the BE or BZ series (trade for trade,
surveillance), that had lost half its price over its last 250 sessions, or
that ended more than 80% below its high of the last 750 sessions, is in
distress; one that traded normally to the end is taken to have been merged
or delisted by its promoters. The data-quality report lists every exit with
its class.
"""
import re
import sys

from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import config as C  # noqa: E402

RAW = HERE / "raw" / "nse"
ACTIONS = HERE / "corporate_actions.csv"
MISSING = HERE / "corporate_actions_missing.csv"

MAX_GAP = 60
# How closely the ex-date move must match an announced action. Stocks often hit
# their 20% price band on a split's ex-date, so a bonus or split is trusted
# within 0.25 in logs (the band plus the market's move); a rights issue, whose
# price we reconstruct, within 0.15; a dividend of over a fifth of the price
# within 0.10.
CAPITAL_TOL = 0.25
RIGHTS_TOL = 0.15
DIVIDEND_TOL = 0.10
CAPITAL_MOVE = 0.15         # a stock-specific move this large on an unquantified action is zeroed
BC_START = pd.Timestamp("2010-01-01")
# Price ratios of standard bonuses and splits. Before 2010 a price pattern
# alone is trusted only for the large ones (BIG); for stocks Yahoo carries,
# Yahoo's split-adjusted series confirms any of them (ALL).
ALL_RATIOS = np.array([1 / 2, 2 / 3, 1 / 3, 1 / 4, 3 / 4, 1 / 5, 4 / 5, 2 / 5, 1 / 10, 5 / 6, 1 / 6])
BIG_RATIOS = np.array([1 / 2, 1 / 3, 1 / 4, 1 / 5, 1 / 10])
# How far the move may stray from the ratio (in logs), set on 2010-2026 where
# NSE's files give the answer: a fall of 75% or more in a liquid stock has
# almost always been a split, a fall of a half or two-thirds less often.
BIG_TOL = np.array([0.10, 0.10, 0.25, 0.25, 0.25])
RATIO_TOL = 0.03
HUGE_FALL = 0.80
KEEP_TOP = 1000
COLLAPSE = -0.50            # a fall over the last 250 sessions that marks an exit as distress
FROM_HIGH = -0.80           # or a price this far below the high of the last 750 sessions
REPORT_MOVE = np.log(0.6)
OPEN_AT_END = 5

# NSE writes the same action many ways: "BONUS 1:1", "BON-2:1", "FV SPLT FRM RS
# 10 TO RS 2", "FV SPL-RS10TORS5", "STK SPT10 TO1", "DIV-RS.5.50 PR SH",
# "INTDIV - RS 3.50", "DIV- FIN RS.3+SPL RS.7.50" (SPL here is a special dividend).
AMOUNT = re.compile(r"R[SE]\s*\.?\s*-?\s*(\d+(?:\.\d+)?)")
BONUS = re.compile(r"\bBON(?:US)?\b\D{0,6}?(\d+)\s*:\s*(\d+)")
BONUS_WORD = re.compile(r"\bBON(?:US)?\b")
SPLIT_WORD = re.compile(r"SPLIT|SPLT|SPT|SUB[- ]?DIV|\bFV\b|FACE VALUE|CONSOLIDAT"
                        r"|\bSPL\b(?!\s*(?:INT\w*\s*)?DIV)")
FROM_TO = re.compile(r"(?:R[SE]\s*\.?\s*)?(\d+(?:\.\d+)?)\s*(?:PER SHARE\s*|EACH\s*)?"
                     r"TO\s*(?:R[SE]\s*\.?\s*)?(\d+(?:\.\d+)?)")
DIV = re.compile(r"DIV(?!ISION)")
SUBDIV = re.compile(r"SUB[- ]?DIV")
BARE = re.compile(r"(?:DIV|FIN|SPL|INT)\s*[-:]?\s*(\d+(?:\.\d+)?)(?!\s*(?:ST|ND|RD|TH|%|\d))")
RIGHTS = re.compile(r"(?:RIGHTS?|RHTS)\s*(\d+)\s*:\s*(\d+)\s*@?\s*(PRM|PREM\w*)?\s*"
                    r"(?:R[SE]\s*\.?\s*)?(\d+(?:\.\d+)?)?")
CAPITAL_WORDS = re.compile(r"DEMERGER|ARRANGEMENT|RIGHTS|CAPITAL REDUCTION|REDUCTION OF CAPITAL")
MERGER_WORDS = re.compile(r"AMALGAMATION|MERGER|ARRANGEMENT|DELISTING")


# ----------------------------------------------------------------------
# Reading
# ----------------------------------------------------------------------
def read_field(name: str) -> pd.DataFrame:
    parts = [pd.read_csv(p, index_col="Date", parse_dates=True, low_memory=False)
             for p in sorted(RAW.glob(f"{name}-[12][0-9][0-9][0-9].csv.gz"))]
    df = pd.concat(parts, axis=0).sort_index()
    return df.reindex(columns=sorted(df.columns))


def parse_purpose(purpose: str) -> dict:
    """Share ratio, cash dividend and flags from one corporate action's text."""
    u = re.sub(r"\([^)]*(?:FACE VALUE|F\.?V\.?)[^)]*\)", " ", purpose.upper())
    u = u.replace("/-", " ")              # "RS 10/-" is an amount, not a separator
    out = {"ratio": 1.0, "split": 1.0, "dividend": 0.0, "capital": False, "merger": False,
           "parsed": False, "rights_new": 0, "rights_old": 0, "rights_price": np.nan,
           "rights_premium": False}
    has_div = bool(DIV.search(u)) and not SUBDIV.search(u.replace("DIVIDEND", ""))
    for seg in re.split(r"/|\+|\bAND\b|&|;", u):
        m = RIGHTS.search(seg)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            if a > 0 and b > 0 and m.group(4):
                # "@ PRM RS 90" is a premium over face value; "@ RS 90" the price.
                out.update(rights_new=a, rights_old=b, rights_price=float(m.group(4)),
                           rights_premium=bool(m.group(3)), parsed=True)
            else:
                out["capital"] = True         # a rights issue without its price
            continue
        m = BONUS.search(seg)
        if m and int(m.group(1)) > 0 and int(m.group(2)) > 0:
            a, b = int(m.group(1)), int(m.group(2))
            out["ratio"] *= (a + b) / b
            out["parsed"] = True
            continue
        if BONUS_WORD.search(seg):
            out["capital"] = True             # a bonus without a ratio
            continue
        is_div = bool(DIV.search(seg)) and not SUBDIV.search(seg)
        if SPLIT_WORD.search(seg) and not is_div:
            m = FROM_TO.search(seg)
            if m and float(m.group(1)) > 0 and float(m.group(2)) > 0:
                out["ratio"] *= float(m.group(1)) / float(m.group(2))
                out["split"] *= float(m.group(1)) / float(m.group(2))
                out["parsed"] = True
                continue
            amounts = AMOUNT.findall(seg) or BARE.findall(seg)
            if has_div and amounts and re.search(r"\bSPL\b|SPECIAL", seg):
                out["dividend"] += sum(float(x) for x in amounts)   # "+SPL RS.7.50"
                out["parsed"] = True
            else:
                out["capital"] = True         # a split whose ratio is not given
            continue
        if (is_div or (has_div and re.search(r"\bFIN\b|\bINT\b|FINAL|INTERIM", seg))) \
                and not re.search(r"BUY ?BACK", seg):
            amounts = [float(x) for x in AMOUNT.findall(seg)] or \
                      [float(x) for x in BARE.findall(seg)]          # "DIV-FIN 3"
            if amounts:
                out["dividend"] += sum(amounts)
                out["parsed"] = True
    out["capital"] |= bool(CAPITAL_WORDS.search(re.sub(r"RIGHTS[^/+;&]*", "", u)))
    out["merger"] = bool(MERGER_WORDS.search(u))
    return out


def actions_table(sessions: pd.DatetimeIndex) -> pd.DataFrame:
    """NSE's corporate actions, parsed, one row per (symbol, ex-date)."""
    raw = pd.read_csv(RAW / "corporate_actions_nse.csv", parse_dates=["ex_date"])
    parsed = pd.DataFrame([parse_purpose(p) for p in raw["purpose"].fillna("")])
    df = pd.concat([raw.reset_index(drop=True), parsed], axis=1)
    # The same event is often listed under several wordings, or once per series.
    capital = (df[df["ratio"] != 1.0]
               .drop_duplicates(["symbol", "ex_date", "ratio"])
               .groupby(["symbol", "ex_date"])[["ratio", "split"]].prod())
    dividend = (df[df["dividend"] > 0]
                .drop_duplicates(["symbol", "ex_date", "dividend"])
                .groupby(["symbol", "ex_date"])["dividend"].sum())
    rights = (df[df["rights_new"] > 0]
              .drop_duplicates(["symbol", "ex_date"])
              .set_index(["symbol", "ex_date"])[["rights_new", "rights_old", "rights_price",
                                                 "rights_premium"]])
    flags = df.groupby(["symbol", "ex_date"])[["capital", "merger"]].any()
    purposes = df.groupby(["symbol", "ex_date"])["purpose"].agg(lambda s: " | ".join(sorted(set(s))))
    missing = pd.read_csv(MISSING, comment="#", parse_dates=["ex_date"])
    missing = missing.set_index(["symbol", "ex_date"])[["ratio"]].assign(
        split=missing["ratio"].to_numpy(), purpose=("verified, missing from NSE's files: "
                                                    + missing["kind"]).to_numpy())
    out = pd.concat([capital, dividend, rights, flags, purposes], axis=1)
    out = out.combine_first(missing).reset_index()
    out["ratio"] = out["ratio"].fillna(1.0)
    out["split"] = out["split"].fillna(1.0)
    out["dividend"] = out["dividend"].fillna(0.0)
    out["rights_new"] = out["rights_new"].fillna(0).astype(int)
    out["rights_premium"] = out["rights_premium"].fillna(False).astype(bool)
    out[["capital", "merger"]] = out[["capital", "merger"]].fillna(False).astype(bool)
    # The session on which the action first shows in prices.
    pos = sessions.searchsorted(out["ex_date"])
    out = out[pos < len(sessions)].copy()
    out["session"] = sessions[pos[pos < len(sessions)]]
    return out


# ----------------------------------------------------------------------
# Adjustment
# ----------------------------------------------------------------------
def _prev_close(close: pd.DataFrame, symbol: str, session: pd.Timestamp) -> tuple:
    s = close[symbol].loc[:session].dropna()
    before = s.iloc[:-1] if len(s) and s.index[-1] == session else s
    after = close[symbol].loc[session:].dropna()
    return (before.iloc[-1] if len(before) else np.nan,
            after.iloc[0] if len(after) else np.nan)


def adjust(close: pd.DataFrame, actions: pd.DataFrame, face_value: dict | None = None
           ) -> tuple[pd.DataFrame, list, list]:
    """Back-adjusted prices, the log of every adjustment made or refused, and
    the index of each action whose bonus or split ratio did not match the
    price (rule 2 then treats it as an action without a ratio).

    `face_value` is each listed stock's face value today; a rights issue's
    price is its face value at the time plus the premium NSE quotes.
    Unusual adjustments, a rights issue or a dividend of more than a fifth of
    the price, are applied only if the price moved by about as much on the
    ex-date, which also guards against a misread amount.
    """
    factor = pd.DataFrame(1.0, index=close.index, columns=close.columns)
    log, refused = [], []
    acts = actions[actions["symbol"].isin(close.columns)]
    later_splits = {s: g.set_index("session")["split"] for s, g in acts.groupby("symbol")}
    for r in acts.itertuples():
        prev, nxt = _prev_close(close, r.symbol, r.session)
        if not np.isfinite(prev) or not np.isfinite(nxt):
            continue
        seen = np.log(nxt / prev)
        f, ratio = 1.0, 1.0
        if r.ratio != 1.0:
            if abs(seen + np.log(r.ratio)) < CAPITAL_TOL:
                f /= r.ratio
                ratio = r.ratio
                log.append((r.symbol, r.session, "bonus or split", r.ratio, seen))
            else:
                refused.append(r.Index)
                log.append((r.symbol, r.session, "bonus or split NOT applied: the price did "
                            "not move by the ratio", r.ratio, seen))
        if r.rights_new > 0:
            a, b, s = r.rights_new, r.rights_old, r.rights_price
            if r.rights_premium:
                splits = later_splits[r.symbol]
                fv = (face_value or {}).get(r.symbol, 10.0) * splits[splits.index > r.session].prod()
                s += fv
            g = (b * prev + a * s) / ((a + b) * prev) if s < prev else 1.0
            if g < 1.0 and (abs(np.log(g)) < 0.02 or abs(seen - np.log(g)) < RIGHTS_TOL):
                f *= g
                log.append((r.symbol, r.session, "rights issue", a / b, s / prev))
            elif g < 1.0:
                log.append((r.symbol, r.session, "rights issue NOT applied: the price did not "
                            "move by the ex-rights factor", a / b, s / prev))
        if r.dividend > 0:
            # Paid per share held before any bonus or split on the same day.
            d = r.dividend / prev
            if d < 0.2 or (d < 0.99 and
                           abs(np.log(nxt * ratio / (prev - r.dividend))) < DIVIDEND_TOL):
                f *= 1 - d
                log.append((r.symbol, r.session, "dividend", r.dividend, d))
            else:
                log.append((r.symbol, r.session, "dividend NOT applied: over a fifth of the "
                            "price and the price did not fall by it", r.dividend, d))
        factor.loc[r.session, r.symbol] *= f
    # Prices before an event session are scaled by the product of all later factors.
    later = factor.iloc[::-1].cumprod().iloc[::-1].shift(-1).fillna(1.0)
    return close * later, log, refused


def _rescale(adj: pd.DataFrame, symbol: str, session: pd.Timestamp,
             factor: float | None = None) -> float:
    """Multiply prices before `session` by `factor`, or by whatever makes the
    move into `session` zero. Returns the move removed."""
    s = adj[symbol]
    prev = s.loc[:session].iloc[:-1].last_valid_index()
    if prev is None or pd.isna(s.get(session)):
        return np.nan
    move = s.loc[session] / s.loc[prev] - 1
    f = s.loc[session] / s.loc[prev] if factor is None else factor
    adj.loc[adj.index < session, symbol] = s.loc[adj.index < session] * f
    return float(move)


def moves(adj: pd.DataFrame, traded: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Log move from each stock's previous trade, and that move net of the
    session's median move."""
    lr = np.log(adj.ffill()).diff().where(traded)
    return lr, lr.sub(lr.median(axis=1), axis=0)


def liquidity_rank(traded_value: pd.DataFrame) -> pd.DataFrame:
    """Each stock's rank by six-month median traded value, as of the previous
    session (1 = most traded)."""
    liq = traded_value.fillna(0).rolling(C.LIQ_WINDOW, min_periods=1).median()
    return liq.where(liq > 0).rank(axis=1, ascending=False).shift(1)


def ratio_candidates(lr: pd.DataFrame, ex: pd.DataFrame, traded: pd.DataFrame,
                     ratios: np.ndarray, rank: pd.DataFrame | None = None,
                     tol: np.ndarray | float = RATIO_TOL) -> pd.Series:
    """Stock-specific falls within `tol` (per ratio, or one for all) of one of
    `ratios`, from a session on which the stock also traded, optionally only
    in stocks ranked within KEEP_TOP by liquidity: (date, symbol) -> the
    nearest qualifying ratio."""
    tol = np.broadcast_to(np.asarray(tol, dtype=float), np.shape(ratios))
    dist = np.full(lr.shape, np.inf)
    best = np.full(lr.shape, np.nan)
    for k, t in zip(ratios, tol):
        d = np.abs(lr.to_numpy() - np.log(k))
        take = (d < t) & (d < dist)
        best = np.where(take, k, best)
        dist = np.where(take, d, dist)
    cand = np.isfinite(dist) & (ex.abs().to_numpy() > CAPITAL_MOVE) \
        & traded.shift(1, fill_value=False).to_numpy()
    if rank is not None:
        cand &= (rank.reindex_like(lr) <= KEEP_TOP).to_numpy()
    return pd.DataFrame(np.where(cand, best, np.nan), lr.index, lr.columns).stack().dropna()


def repair_breaks(adj: pd.DataFrame, traded: pd.DataFrame, actions: pd.DataFrame,
                  yahoo: pd.DataFrame | None = None, rank: pd.DataFrame | None = None
                  ) -> tuple[list, list]:
    """Rules 2 and 3 of the module docstring. Returns (repairs, kept large moves)."""
    repairs = []
    listed = pd.read_csv(ACTIONS, parse_dates=["date"], comment="#")
    for r in listed.itertuples():
        if r.ticker in adj.columns:
            s = adj.index.searchsorted(r.date)
            if s < len(adj.index):
                move = _rescale(adj, r.ticker, adj.index[s])
                repairs.append((r.ticker, adj.index[s], f"listed: {r.kind}", move))

    # Rule 2: announced actions without a usable ratio.
    lr, ex = moves(adj, traded)
    flagged = actions[actions["capital"] & actions["symbol"].isin(adj.columns)]
    for r in flagged.itertuples():
        on = traded[r.symbol].loc[r.session:]
        d = on.idxmax() if on.any() else None
        if d is None or (d - r.session).days > 7 or abs(ex.loc[d, r.symbol]) <= CAPITAL_MOVE:
            continue
        move = _rescale(adj, r.symbol, d)
        repairs.append((r.symbol, d, "announced action without a usable ratio", move))

    # Rule 3: before NSE's files begin. Stocks the first study carries: its
    # cleaned Yahoo series (data.py), whose every repair was checked against a
    # corporate event, is the reference. A session on which NSE's close falls
    # at least 13% further than that series, with no reversal over the next
    # five sessions, is a capital change; NSE's move is set to the reference
    # move. This also covers demergers and a split and bonus on the same day.
    lr, ex = moves(adj, traded)
    early = lr.index < BC_START
    on_yahoo, gap = set(), None
    if yahoo is not None:
        y = yahoo.reindex(columns=adj.columns)
        y = y.loc[:, y.loc[:BC_START].notna().any()]
        on_yahoo = set(y.columns)
        y_lr = np.log(y.reindex(adj.index).ffill()).diff()
        nse_lr = np.log(adj[y.columns].ffill()).diff()
        gap = (nse_lr - y_lr).where(traded[y.columns])
        later = gap.shift(-1).rolling(5, min_periods=1).sum().shift(-4)   # next five sessions
        hit = (gap.loc[early] <= np.log(0.87)) & (later.loc[early].abs() < 0.05)
        for (d, t) in hit.stack().loc[lambda s: s].index:
            g = float(gap.loc[d, t])
            move = _rescale(adj, t, d, float(np.exp(g)))
            repairs.append((t, d, f"capital change before 2010, ratio {np.exp(g):.3f}, "
                                  "from the first study's cleaned series", move))
    # The rest: a large standard ratio in a stock then among the most traded,
    # or a fall beyond 80% in any stock (since 2010 almost every such fall has
    # been a recorded corporate action). A stock whose reference series shows
    # the same move on the day is left alone: the fall was real.
    def on_reference(d, t):
        return t in on_yahoo and np.isfinite(gap.loc[d, t]) and abs(gap.loc[d, t]) < 0.10

    lr, ex = moves(adj, traded)
    lr_e, ex_e, tr_e = lr[early], ex[early], traded[early]
    rk = None if rank is None else rank[early]
    for (d, t), near in ratio_candidates(lr_e, ex_e, tr_e, BIG_RATIOS, rk, BIG_TOL).items():
        if not on_reference(d, t):
            move = _rescale(adj, t, d, near)
            repairs.append((t, d, f"capital change before 2010, ratio {near:.3f}, "
                                  "from the price alone", move))
    lr, ex = moves(adj, traded)
    huge = lr[early] < np.log(1 - HUGE_FALL)
    for (d, t) in huge.stack().loc[lambda s: s].index:
        if not on_reference(d, t):
            move = _rescale(adj, t, d)
            repairs.append((t, d, "capital change before 2010, a fall beyond 80% in one "
                                  "session", move))

    _, ex = moves(adj, traded)
    kept = ex.stack()
    kept = kept[kept.abs() > -REPORT_MOVE]
    kept_list = [(t, d, float(np.expm1(x))) for (d, t), x in kept.items()]
    return repairs, kept_list


# ----------------------------------------------------------------------
# Exits
# ----------------------------------------------------------------------
def segments(traded: pd.Series) -> list[tuple[int, int]]:
    """(first, last) session positions of each run of trading separated by
    MAX_GAP or more sessions without a trade."""
    pos = np.flatnonzero(traded.to_numpy())
    if pos.size == 0:
        return []
    breaks = np.flatnonzero(np.diff(pos) > MAX_GAP)
    starts = np.r_[pos[0], pos[breaks + 1]]
    ends = np.r_[pos[breaks], pos[-1]]
    return list(zip(starts, ends))


def classify_exit(symbol: str, last: pd.Timestamp, delisted: pd.DataFrame,
                  actions: pd.DataFrame, last_series: str, year_change: float,
                  from_high: float = 0.0) -> str:
    """How a stock left, from the best evidence available, in this order:
    NSE's delisted list; an amalgamation, merger, arrangement or delisting in
    the corporate action files around the last trade; then the stock's own
    record. A company on its way to failure is moved by NSE to the BE or BZ
    series (trade for trade, surveillance), has halved in its last year, or
    trades more than 80% below its high of the last three years (a company
    resolved under the insolvency code, whose shareholders are usually wiped
    out, can trade quietly for a long time after its collapse); a company
    being taken over or delisted by its promoters trades normally to the
    end."""
    d = delisted[(delisted["symbol"] == symbol) & (delisted["date"] >= last - pd.Timedelta(days=30))]
    if len(d):
        kind = d.iloc[0]["type"].lower()
        return "voluntary" if "voluntary" in kind else "distress"
    a = actions[(actions["symbol"] == symbol) & actions["merger"]
                & (actions["ex_date"] >= last - pd.Timedelta(days=400))
                & (actions["ex_date"] <= last + pd.Timedelta(days=120))]
    if len(a):
        return "merger"
    if last_series in ("BE", "BZ", "BT") or year_change < COLLAPSE or from_high < FROM_HIGH:
        return "distress, inferred"
    return "merger, inferred"


def split_and_exit(adj: pd.DataFrame, qty: pd.DataFrame, value: pd.DataFrame,
                   delisted: pd.DataFrame, actions: pd.DataFrame, listed_now: set,
                   distress: float, series: pd.DataFrame | None = None
                   ) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, list]:
    """Split each stock at suspensions of MAX_GAP sessions or more and book an
    exit return after each run of trading that ends before the data does.

    Returns the adjusted prices (forward-filled within each run, one final
    exit price after it, NaN elsewhere), the traded mask, traded value, and
    the list of exits.
    """
    sessions = adj.index
    cols, exits = {}, []
    n = len(sessions)
    for t in adj.columns:
        traded = qty[t] > 0
        segs = segments(traded)
        for k, (a, b) in enumerate(segs):
            name = t if k == 0 else f"{t}~{k + 1}"
            s = adj[t].iloc[a:b + 1].ffill()
            open_at_end = (k == len(segs) - 1 and t in listed_now and b >= n - 1 - MAX_GAP)
            if b < n - 1 - OPEN_AT_END and not open_at_end:
                last = sessions[b]
                if k + 1 < len(segs):
                    kind = "resumed"
                    nxt = adj[t].iloc[segs[k + 1][0]]
                    r = float(nxt / adj[t].iloc[b] - 1)
                else:
                    last_series = "EQ"
                    if series is not None and t in series.columns:
                        on = series[t].iloc[:b + 1].dropna()
                        last_series = on.iloc[-1] if len(on) else "EQ"
                    hist = adj[t].iloc[a:b + 1].dropna()
                    year = float(hist.iloc[-1] / hist.iloc[-250] - 1) if len(hist) > 250 else 0.0
                    high = float(hist.iloc[-1] / hist.iloc[-750:].max() - 1)
                    kind = classify_exit(t, last, delisted, actions, last_series, year, high)
                    r = (distress if kind.startswith("distress")
                         else C.PIT_EXIT_RETURNS[kind.split(",")[0]])
                exit_px = adj[t].iloc[b] * max(1 + r, 1e-6)
                s = pd.concat([s, pd.Series([exit_px], index=[sessions[b + 1]])])
                exits.append((name, last, kind, r))
            cols[name] = (s, a, b)

    out_adj = pd.DataFrame({k: v[0] for k, v in cols.items()}).reindex(sessions)
    trd, tv = {}, {}
    for name, (s, a, b) in cols.items():
        base = name.split("~")[0]
        mask = pd.Series(False, index=sessions)
        mask.iloc[a:b + 1] = (qty[base].iloc[a:b + 1] > 0).to_numpy()
        trd[name] = mask
        tv[name] = value[base].where(mask)
    return out_adj, pd.DataFrame(trd), pd.DataFrame(tv), exits


def build(distress: float | None = None, reference: pd.DataFrame | None = None) -> dict:
    """Every frame the Panel needs, plus the report. `reference` is the first
    study's cleaned price panel, used before 2010 (rule 3)."""
    distress = C.PIT_EXIT_RETURNS["distress"] if distress is None else distress
    close, value = read_field("close"), read_field("value")
    value = value.reindex_like(close).where(lambda v: v > 0)
    qty = (value / close).fillna(0)       # shares traded, near enough: value / close
    sessions = close.index

    actions = actions_table(sessions)
    listed = pd.read_csv(RAW / "EQUITY_L.csv", encoding="latin-1")
    listed.columns = [c.strip() for c in listed.columns]
    face_value = dict(zip(listed["SYMBOL"].str.strip(), pd.to_numeric(listed["FACE VALUE"])))
    adj, adj_log, refused = adjust(close, actions, face_value)
    actions.loc[refused, "capital"] = True
    adj = adj.where(qty > 0)
    repairs, kept = repair_breaks(adj, qty > 0, actions, reference, liquidity_rank(value))

    delisted = pd.read_csv(RAW / "delisted.csv", usecols=[0, 2, 3], encoding="latin-1")
    delisted.columns = ["symbol", "date", "type"]
    delisted["symbol"] = delisted["symbol"].str.strip()
    delisted["date"] = pd.to_datetime(delisted["date"], format="%d-%b-%y", errors="coerce")
    delisted["type"] = delisted["type"].fillna("").str.strip()
    listed_now = set(face_value)

    out_adj, out_traded, out_tv, exits = split_and_exit(
        adj, qty, value, delisted, actions, listed_now, distress, read_field("series"))
    n = len(sessions)
    report = {
        "sessions": [str(sessions.min().date()), str(sessions.max().date()), int(n)],
        "stocks": int(close.shape[1]),
        "columns": int(out_adj.shape[1]),
        "adjustments": adj_log,
        "repairs": repairs,
        "keptLargeMoves": kept,
        "exits": exits,
        "distressReturn": distress,
    }
    return {"adj": out_adj, "traded": out_traded, "traded_value": out_tv, "report": report}
