"""The survivorship-free panel: corporate actions, exits and the universe rules.

Toy frames stand in for NSE's files, so each rule is checked on a case whose
right answer is known by hand.
"""
import numpy as np
import pandas as pd
import pytest

import nse
import signals as S

from test_lookahead import corrupt_after


def test_purposes_are_read_as_ratios_and_cash():
    p = nse.parse_purpose
    assert p("BONUS 1:1")["ratio"] == 2.0
    assert p("BONUS 1:2")["ratio"] == 1.5
    assert p("FV SPLT FRM RS 10 TO RS 2")["ratio"] == 5.0
    assert p("FACE VALUE SPLIT (SUB-DIVISION) - FROM RS 10/- PER SHARE TO RE 1/- PER SHARE")["ratio"] == 10.0
    assert p("CONSOLIDATION OF SHARES FROM RS 1 TO RS 10")["ratio"] == 0.1
    assert p("AGM/DIV-RS.1.50 PER SHARE")["dividend"] == 1.5
    assert p("INT DIV RS 2 + SPL DIV RS 3")["dividend"] == 5.0
    assert p("DIVIDEND - RS 10 PER SHARE (FACE VALUE RS 2)")["dividend"] == 10.0
    split = p("FACE VALUE SPLIT (SUB-DIVISION) - FROM RS 10/- TO RS 5/-")
    assert split["dividend"] == 0.0 and split["ratio"] == 2.0
    both = p("DIVIDEND RS 1.50 PER SHARE/FV SPLIT FROM RS 10 TO RS 2")
    assert both["dividend"] == 1.5 and both["ratio"] == 5.0
    rights = p("RIGHTS 1:5 @ PREMIUM RS 90")
    assert rights["ratio"] == 1.0 and rights["dividend"] == 0.0 and not rights["capital"]
    assert (rights["rights_new"], rights["rights_old"], rights["rights_price"]) == (1, 5, 90.0)
    assert rights["rights_premium"] and not p("RIGHTS 1:5 @ RS 90")["rights_premium"]
    assert p("RHTS 2:5 @PREMIUM RS.140")["rights_new"] == 2
    assert p("RIGHTS 1:5")["capital"]                      # no price: no factor
    assert p("SCHEME OF AMALGAMATION")["merger"]
    assert p("DEMERGER")["capital"]
    assert not p("ANNUAL GENERAL MEETING")["parsed"]


def test_nse_abbreviations():
    p = nse.parse_purpose
    assert p("BON 1:1/FV SPL RS.5TORS.2")["ratio"] == 2.0 * 2.5
    assert p("FV SPL-RS10TORS5/BON-2:1")["ratio"] == 2.0 * 3.0
    assert p("BON 1:1/SPL RS10 TO RS2")["ratio"] == 10.0
    assert p("AGM/DIVRS10/STK SPT10 TO1")["ratio"] == 10.0
    assert p("AGM/DIVRS10/STK SPT10 TO1")["dividend"] == 10.0
    assert p("AGM/FV SPLT FRM 10 TO 1")["ratio"] == 10.0
    assert p("DIV-RS 2/FV-SPTLRS10TORS2")["ratio"] == 5.0
    assert p("FV SPLT FRM RS 10/- TO RS")["capital"]        # ratio cut off
    assert p("AGM/DIV-RS 29.50/BONUS")["capital"]           # bonus without a ratio
    assert p("DIV- FIN RS.3+SPL RS.7.50")["dividend"] == 10.5
    assert p("SPL INT DIV-RS.100 P SHR")["dividend"] == 100.0
    assert p("INTDIV - RS 3.50 PER SH")["dividend"] == 3.5
    assert p("INTDIV- RS12 SPLDV RS 6")["dividend"] == 18.0
    assert p("AGM/DIV-FIN 3+SPL 2")["dividend"] == 5.0
    assert p("1ST INTERIM DIVIDEND")["dividend"] == 0.0


def _actions(rows, sessions):
    df = pd.DataFrame(rows, columns=["symbol", "ex_date", "ratio", "dividend", "rights_new",
                                     "rights_old", "rights_price"])
    df["ex_date"] = pd.to_datetime(df["ex_date"])
    df["split"] = 1.0
    df["rights_premium"] = False
    df["capital"] = False
    df["merger"] = False
    df["session"] = sessions[sessions.searchsorted(df["ex_date"])]
    return df


def test_bonus_rights_and_dividend_leave_no_false_return():
    idx = pd.bdate_range("2020-01-01", periods=6)
    close = pd.DataFrame({"A": [100, 102, 51, 52, 52, 52.0],     # 1:1 bonus on day 3
                          "B": [200, 200, 190, 190, 190, 190.0],  # Rs 10 dividend on day 3
                          "C": [50, 50, 50, 50, 50, 50.0],        # bonus listed, never happened
                          "D": [120, 120, 110, 110, 110, 110.0]},  # rights 1:1 at Rs 100
                         index=idx)
    acts = _actions([("A", idx[2], 2.0, 0.0, 0, 0, np.nan), ("B", idx[2], 1.0, 10.0, 0, 0, np.nan),
                     ("C", idx[3], 2.0, 0.0, 0, 0, np.nan), ("D", idx[2], 1.0, 0.0, 1, 1, 100.0)], idx)
    adj, log, refused = nse.adjust(close, acts)
    r = adj.pct_change()
    assert r.loc[idx[2], "A"] == pytest.approx(0.0)               # 102 -> 51 is the bonus
    assert r.loc[idx[1], "A"] == pytest.approx(0.02)              # earlier moves kept
    assert r.loc[idx[2], "B"] == pytest.approx(0.0, abs=1e-12)    # the holder kept the Rs 10
    assert r.loc[idx[2], "D"] == pytest.approx(0.0, abs=1e-12)    # ex-rights price (120+100)/2
    assert (r["C"].dropna() == 0).all()                           # refused: price did not halve
    assert refused == [2]
    assert adj.iloc[-1].tolist() == close.iloc[-1].tolist()       # latest prices untouched


def test_unexplained_falls_are_kept_and_early_splits_found():
    idx = pd.bdate_range("2008-01-01", periods=8)
    close = pd.DataFrame({"S": [100, 101, 20.2, 20.4, 20.4, 20.4, 20.4, 20.4],   # 1:5 split, 2008
                          "F": [100, 100, 100, 50.5, 50, 50, 50, 50.0],           # a real fall
                          "M": [100, 100, 100, 100, 100, 100, 100, 100.0]},
                         index=idx)
    adj, traded = close.copy(), close.notna()
    no_actions = _actions([], idx)
    no_actions["capital"] = no_actions["capital"].astype(bool)
    # F falls by a "1:2 ratio" but Yahoo, which carries it, shows the same fall:
    # a real fall, kept. S is not on Yahoo and falls by a large standard ratio.
    yahoo = pd.DataFrame({"F": close["F"]})
    repairs, kept = nse.repair_breaks(adj, traded, no_actions, yahoo)
    r = adj.pct_change()
    assert r.loc[idx[2], "S"] == pytest.approx(20.2 / 20.2 - 1, abs=0.02)
    assert r.loc[idx[3], "F"] == pytest.approx(-0.495)
    assert [x[0] for x in repairs] == ["S"]


def test_runs_split_at_long_suspensions_only():
    t = pd.Series(False, index=range(200))
    t[0:50] = True
    t[70:80] = True          # 19-session gap: same run
    t[150:160] = True        # 69-session gap: new run
    assert nse.segments(t) == [(0, 79), (150, 159)]


def _exit_case(listed_now, delisted_rows=(), merger=False, last_series="BZ"):
    idx = pd.bdate_range("2015-01-01", periods=300)
    adj = pd.DataFrame({"X": np.r_[np.linspace(100, 80, 100), np.full(200, np.nan)],
                        "Y": np.r_[np.full(100, 50.0), np.full(100, np.nan), np.full(100, 40.0)]},
                       index=idx)
    qty = adj.notna().astype(float) * 1000
    value = adj * qty
    series = adj.notna().replace({True: "EQ", False: np.nan})
    series.iloc[95:100, 0] = last_series
    delisted = pd.DataFrame(list(delisted_rows), columns=["symbol", "date", "type"])
    delisted["date"] = pd.to_datetime(delisted["date"])
    actions = pd.DataFrame({"symbol": ["X"], "ex_date": [idx[110]], "merger": [merger]})
    return idx, nse.split_and_exit(adj, qty, value, delisted, actions, listed_now, -0.30, series)


def test_exit_return_is_booked_once_on_the_next_session():
    idx, (adj, traded, tv, exits) = _exit_case(listed_now={"Y"})
    r = adj.ffill().pct_change(fill_method=None)
    assert r.loc[idx[100], "X"] == pytest.approx(-0.30)          # moved to BZ: distress
    assert (r.loc[idx[101]:, "X"].fillna(0) == 0).all()          # nothing after it
    assert np.isnan(adj.loc[idx[101], "X"])
    assert not traded.loc[idx[100]:, "X"].any()
    # Y is suspended for 100 sessions and resumes: the actual change is booked,
    # and the resumed listing is a new history.
    assert r.loc[idx[100], "Y"] == pytest.approx(40 / 50 - 1)
    assert "Y~2" in adj.columns and adj["Y~2"].first_valid_index() == idx[200]
    kinds = {e[0]: e[2] for e in exits}
    assert kinds == {"X": "distress, inferred", "Y": "resumed"}


def test_mergers_and_voluntary_delistings_exit_at_the_last_price():
    for kw in ({"merger": True}, {"delisted_rows": [("X", "2015-06-30", "Voluntary Delisting")]},
               {"last_series": "EQ"}):
        idx, (adj, _, _, exits) = _exit_case(listed_now={"Y"}, **kw)
        r = adj.ffill().pct_change(fill_method=None)
        assert r.loc[idx[100], "X"] == pytest.approx(0.0)
        assert exits[0][2] in ("merger", "voluntary", "merger, inferred")


def test_top_n_and_recent_rules(panel):
    adj, traded, tv = panel
    dates = S.signal_dates(adj.index)
    elig, _ = S.eligibility(adj, traded, tv, dates, top_n=12)
    assert elig.sum(axis=1).max() <= 12
    stopped = traded.copy()
    stopped.loc[adj.index[600]:, "S10"] = False
    elig, _ = S.eligibility(adj, stopped, tv.where(stopped), dates, recent=5)
    after = dates[dates > adj.index[610]]
    assert not elig.loc[after, "S10"].any()


def test_universe_rules_use_only_the_past(panel):
    adj, traded, tv = panel
    T = adj.index[700]
    dates = S.signal_dates(adj.index)
    before = dates[dates <= T]
    a, ta = S.eligibility(adj, traded, tv, dates, top_n=15, recent=5)
    adj2, traded2, tv2 = corrupt_after(T, adj, traded, tv)
    b, tb = S.eligibility(adj2, traded2, tv2, dates, top_n=15, recent=5)
    pd.testing.assert_frame_equal(a.loc[before], b.loc[before])
    pd.testing.assert_frame_equal(ta.loc[before], tb.loc[before])
    assert not a.loc[dates > T].equals(b.loc[dates > T])
