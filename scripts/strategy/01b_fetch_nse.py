#!/usr/bin/env python3
"""Stage 1b: download NSE's own daily files for the survivorship-free universe.

Stage 1 builds the universe from today's Nifty 500, so every stock in it
survived to today. This stage downloads the exchange's record of every equity
that traded on each session from January 2005, including the companies that
later merged, collapsed or delisted, so that stage 2 onwards can rebuild the
universe at each date from what was trading then.

    raw/nse/{close,value,series}-YYYY.csv.gz
                                  one row per session, one column per stock:
                                  the unadjusted close, rupees traded (zero or
                                  missing when the stock did not trade) and the
                                  series the close came from. Shares traded
                                  are not kept: value / close recovers them
                                  closely enough for every use here
    raw/nse/corporate_actions_nse.csv
                                  every equity corporate action NSE announced
                                  from January 2010, purpose text verbatim
    raw/nse/symbolchange.csv      NSE's list of symbol changes
    raw/nse/delisted.csv          NSE's list of delisted companies, with type
    raw/nse/EQUITY_L.csv          equities listed today
    raw/nse/index_tri.csv         total return indices from NSE Indices: Nifty 50,
                                  Nifty 500, Nifty500 Equal Weight and Nifty500
                                  Momentum 50. The last two were launched in
                                  2024; NSE back-calculated them to April 2005
                                  on the constituents of each past date
    raw/nse/manifest.csv.gz       every file downloaded, with its SHA-256
    raw/nse/fetch_log.json        when it ran and what it kept

Sources
-------
Bhavcopy (end-of-day prices for every security traded):
  to 5 Jul 2024   content/historical/EQUITIES/YYYY/MON/cmDDMONYYYYbhav.csv.zip
  from 8 Jul 2024 content/cm/BhavCopy_NSE_CM_0_0_0_YYYYMMDD_F_0000.csv.zip
Corporate actions: Bc*.csv inside archives/equities/bhavcopy/pr/PRDDMMYY.zip,
which NSE serves from January 2010. Each file lists the actions with an
ex-date in a window around its date, so the union over all sessions is the
full record.

A weekday without a bhavcopy is a holiday. Weekend sessions (Diwali muhurat,
special Saturdays) are skipped; the next session's return spans them.

Kept and pruned
---------------
Only equity series are kept: EQ (rolling settlement), BE (trade for trade),
BZ (trade for trade, non-compliant companies) and BT. Following a stock into
BE and BZ matters: that is where companies go on their way to suspension and
delisting. Symbols are mapped through NSE's symbol changes to the name they
last traded under, and when a stock trades in more than one series on a day
the close comes from the first of EQ, BE, BZ, BT.

The committed panel keeps only stocks that were among the 1,000 most traded
by trailing six-month median traded value at some month-end. A stock outside
that set is never in the top-500 universe, so it never affects a result.

Downloads are cached in cache/nse/ (gitignored); a rerun downloads only what
is missing. `--compile` rebuilds raw/nse/ from the cache without the network.

    python3 scripts/strategy/01b_fetch_nse.py
    python3 scripts/strategy/01b_fetch_nse.py --compile
"""
import argparse
import csv
import hashlib
import io
import json
import re
import sys
import time
import urllib.error
import urllib.request
import zipfile

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import config as C  # noqa: E402

OUT = HERE / "raw" / "nse"
CACHE = HERE / "cache" / "nse"
HOST = "https://nsearchives.nseindia.com/"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.nseindia.com/",
}
UDIFF_FROM = pd.Timestamp("2024-07-08")
BC_FROM = pd.Timestamp("2010-01-01")
REFERENCE = ("symbolchange.csv", "delisted.csv", "EQUITY_L.csv")

TRI_URL = "https://www.niftyindices.com/BackPage/getTotalReturnIndexString"
TRI_INDICES = {"NIFTY50": "NIFTY 50", "NIFTY500": "NIFTY 500",
               "NIFTY500_EW": "NIFTY500 EQUAL WEIGHT", "NIFTY500_MOM50": "NIFTY500 MOMENTUM 50"}

SERIES = ("EQ", "BE", "BZ", "BT")          # precedence order
KEEP_TOP = 1000
RENAME_GAP = 5
WORKERS = 3
RETRIES = 6


def bhav_url(d: pd.Timestamp) -> str:
    if d >= UDIFF_FROM:
        return f"{HOST}content/cm/BhavCopy_NSE_CM_0_0_0_{d:%Y%m%d}_F_0000.csv.zip"
    mon = f"{d:%b}".upper()
    return f"{HOST}content/historical/EQUITIES/{d:%Y}/{mon}/cm{d:%d}{mon}{d:%Y}bhav.csv.zip"


def pr_url(d: pd.Timestamp) -> str:
    return f"{HOST}archives/equities/bhavcopy/pr/PR{d:%d%m%y}.zip"


def fetch(url: str) -> bytes | None:
    """The file's bytes, None for a 404, retrying throttling with a pause."""
    for attempt in range(1, RETRIES + 1):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=60) as resp:
                return resp.read()
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                return None
            wait = 15 * attempt
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            wait = 5 * attempt
        time.sleep(wait)
    raise RuntimeError(f"gave up on {url}")


def cached(kind: str, d: pd.Timestamp, url: str) -> tuple[str, str, int, str]:
    """Download one file into the cache unless it is already there."""
    path = CACHE / kind / f"{d:%Y%m%d}.zip"
    gone = path.with_suffix(".404")
    if path.exists():
        body = path.read_bytes()
    elif gone.exists():
        body = None
    else:
        body = fetch(url)
        path.parent.mkdir(parents=True, exist_ok=True)
        if body is None:
            gone.touch()
        else:
            path.write_bytes(body)
        time.sleep(0.2)
    if body is None:
        return (f"{d:%Y-%m-%d}", kind, 0, "404")
    return (f"{d:%Y-%m-%d}", kind, len(body), hashlib.sha256(body).hexdigest())


def download() -> pd.DataFrame:
    days = pd.bdate_range(C.FETCH_START, pd.Timestamp(C.FETCH_END) - pd.Timedelta(days=1))
    rows = []
    with ThreadPoolExecutor(WORKERS) as pool:
        jobs = [pool.submit(cached, "bhav", d, bhav_url(d)) for d in days]
        for i, job in enumerate(jobs, 1):
            rows.append(job.result())
            if i % 250 == 0:
                print(f"  bhavcopy {i:>5} of {len(days)}  ({rows[-1][0]})", flush=True)
    sessions = [pd.Timestamp(r[0]) for r in rows if r[3] != "404"]
    print(f"  {len(sessions)} sessions, {len(days) - len(sessions)} weekday holidays")

    pr_days = [d for d in sessions if d >= BC_FROM]
    with ThreadPoolExecutor(WORKERS) as pool:
        jobs = [pool.submit(cached, "pr", d, pr_url(d)) for d in pr_days]
        for i, job in enumerate(jobs, 1):
            rows.append(job.result())
            if i % 250 == 0:
                print(f"  corporate actions {i:>5} of {len(pr_days)}  ({rows[-1][0]})", flush=True)

    for name in REFERENCE:
        path = CACHE / name
        if not path.exists():
            path.write_bytes(fetch(f"{HOST}content/equities/{name}"))
        body = path.read_bytes()
        rows.append(("", name, len(body), hashlib.sha256(body).hexdigest()))
    return pd.DataFrame(rows, columns=["date", "kind", "bytes", "sha256"])


def fetch_tri() -> pd.DataFrame:
    """Daily total return index levels, one year per request (the site's limit)."""
    cookies = urllib.request.build_opener(urllib.request.HTTPCookieProcessor())
    cookies.open(urllib.request.Request("https://www.niftyindices.com/reports/historical-data",
                                        headers=HEADERS), timeout=60).read()
    headers = {**HEADERS, "Content-Type": "application/json; charset=UTF-8",
               "Origin": "https://www.niftyindices.com", "X-Requested-With": "XMLHttpRequest",
               "Referer": "https://www.niftyindices.com/reports/historical-data"}
    end = pd.Timestamp(C.FETCH_END) - pd.Timedelta(days=1)
    out = {}
    for col, name in TRI_INDICES.items():
        levels = {}
        start = pd.Timestamp(C.FETCH_START)
        while start <= end:
            stop = min(start + pd.DateOffset(years=1) - pd.Timedelta(days=2), end)
            info = (f"{{'name':'{name}','startDate':'{start:%d-%b-%Y}',"
                    f"'endDate':'{stop:%d-%b-%Y}','indexName':'{name}'}}")
            body = json.dumps({"cinfo": info}).encode()
            req = urllib.request.Request(TRI_URL, data=body, headers=headers)
            for attempt in range(1, RETRIES + 1):
                try:
                    rows = json.loads(cookies.open(req, timeout=60).read())
                    break
                except (urllib.error.URLError, json.JSONDecodeError, TimeoutError):
                    time.sleep(5 * attempt)
            else:
                raise RuntimeError(f"gave up on {name} {start:%Y}")
            for r in rows if isinstance(rows, list) else []:
                levels[pd.Timestamp(r["Date"])] = float(r["TotalReturnsIndex"])
            start = stop + pd.Timedelta(days=1)
            time.sleep(0.5)
        out[col] = pd.Series(levels).sort_index()
        print(f"  {col:<15} {len(levels)} days from {out[col].index.min().date()}")
    df = pd.DataFrame(out)
    df.index.name = "Date"
    return df


# ----------------------------------------------------------------------
# Compile the cache into the committed panel
# ----------------------------------------------------------------------
def read_bhav(path: Path) -> pd.DataFrame:
    """One session's equity rows as date, symbol, series, close, qty, value, isin."""
    with zipfile.ZipFile(path) as z:
        raw = pd.read_csv(io.BytesIO(z.read(z.namelist()[0])), dtype=str)
    raw.columns = [c.strip() for c in raw.columns]
    if "TckrSymb" in raw.columns:
        raw = raw[raw["FinInstrmTp"].str.strip() == "STK"]
        cols = {"TckrSymb": "symbol", "SctySrs": "series", "ClsPric": "close",
                "TtlTradgVol": "qty", "TtlTrfVal": "value", "ISIN": "isin"}
    else:
        cols = {"SYMBOL": "symbol", "SERIES": "series", "CLOSE": "close",
                "TOTTRDQTY": "qty", "TOTTRDVAL": "value", "ISIN": "isin"}
    if "ISIN" not in raw.columns:             # the old format has no ISIN before 2011
        raw["ISIN"] = np.nan
    df = raw[list(cols)].rename(columns=cols)
    df["symbol"] = df["symbol"].str.strip()
    df["series"] = df["series"].str.strip()
    df = df[df["series"].isin(SERIES)]
    for c in ("close", "qty", "value"):
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df["date"] = pd.Timestamp(path.stem)
    return df


def read_bc(path: Path) -> pd.DataFrame:
    with zipfile.ZipFile(path) as z:
        names = [n for n in z.namelist() if n.lower().startswith("bc")]
        if not names:
            return pd.DataFrame()
        text = z.read(names[0]).decode("latin-1")
    rows = list(csv.reader(io.StringIO(text)))
    if not rows:                              # a few sessions' files are empty
        return pd.DataFrame()
    head = [h.strip() for h in rows[0]]
    df = pd.DataFrame([r[:len(head)] for r in rows[1:] if len(r) >= len(head)], columns=head)
    df = df.apply(lambda s: s.str.strip())
    df = df[df["SERIES"].isin(SERIES)]
    # Dates are dd/mm/yyyy in the older files and yyyy-mm-dd in the newer ones;
    # parsing the newer ones day-first would swap day and month.
    s = df["EX_DT"]
    iso = s.str.match(r"^\d{4}-\d{2}-\d{2}$")
    ex = pd.to_datetime(s.where(iso), format="%Y-%m-%d", errors="coerce").fillna(
        pd.to_datetime(s.where(~iso), format="%d/%m/%Y", errors="coerce"))
    return pd.DataFrame({"symbol": df["SYMBOL"], "ex_date": ex, "purpose": df["PURPOSE"],
                         "seen": pd.Timestamp(path.stem)}).dropna(subset=["ex_date"])


def symbol_changes() -> dict[str, list]:
    """Old symbol -> [(effective date, new symbol), ...] from NSE's list."""
    sc = pd.read_csv(CACHE / "symbolchange.csv", dtype=str, encoding="latin-1")
    sc.columns = [c.strip() for c in sc.columns]
    sc = sc.apply(lambda s: s.str.strip())
    when = pd.to_datetime(sc["EFFECTIVE DATE"], format="mixed", errors="coerce")
    changes: dict[str, list] = {}
    for old, new, w in zip(sc["OLD SYMBOL"], sc["NEW SYMBOL"], when):
        if pd.notna(w) and old != new:
            changes.setdefault(old, []).append((w, new))
    return changes


def final_symbol(changes: dict, symbol: str, date: pd.Timestamp) -> str:
    """The symbol a stock trading as `symbol` on `date` last traded under. A
    change applies to rows dated before it takes effect, so a symbol that NSE
    later reuses for another company is not merged into the old one."""
    for _ in range(10):                      # chains are short; guard against loops
        nxt = [(w, new) for w, new in changes.get(symbol, []) if w > date]
        if not nxt:
            return symbol
        when, symbol = min(nxt)
        date = when - pd.Timedelta(days=1)
    return symbol


def rename(df: pd.DataFrame, date_col: str, changes: dict) -> pd.Series:
    out = df["symbol"].copy()
    hit = df["symbol"].isin(changes)
    pairs = df.loc[hit, ["symbol", date_col]].drop_duplicates()
    mapped = {(s, d): final_symbol(changes, s, d) for s, d in zip(pairs["symbol"], pairs[date_col])}
    out[hit] = [mapped[(s, d)] for s, d in zip(df.loc[hit, "symbol"], df.loc[hit, date_col])]
    return out


def infer_renames(long: pd.DataFrame) -> pd.DataFrame:
    """Symbol changes missing from NSE's list (BURGERKING to RBA and PHILIPCARB
    to PCBL in 2022). A symbol that stops trading is the same stock as one
    that starts within RENAME_GAP sessions with the same ISIN. ISINs are in
    the files from 2011; an earlier change missing from NSE's list (COLGATE to
    COLPAL in 2007) is not inferred, because matching on prices alone links
    unrelated stocks."""
    days = pd.DatetimeIndex(sorted(long["date"].unique()))
    pos = pd.Series(np.arange(len(days)), index=days)
    g = long.groupby("symbol")["date"]
    span = pd.DataFrame({"first": g.min(), "last": g.max()})
    span["first_pos"], span["last_pos"] = pos[span["first"]].to_numpy(), pos[span["last"]].to_numpy()
    isins = long.dropna(subset=["isin"]).groupby("symbol")["isin"].agg(lambda s: set(s.str.strip()))
    starters = span[span["first_pos"] > RENAME_GAP]
    links, used = [], set()
    for a, ra in span[span["last_pos"] < len(days) - 1 - RENAME_GAP].sort_values("last").iterrows():
        near = starters[(starters["first_pos"] > ra["last_pos"])
                        & (starters["first_pos"] <= ra["last_pos"] + RENAME_GAP)]
        for b in near.index:
            if b not in used and b != a and isins.get(a, set()) & isins.get(b, set()):
                used.add(b)
                links.append((a, b, ra["last"].date(), span.loc[b, "first"].date(), "same ISIN"))
                break
    return pd.DataFrame(links, columns=["old", "new", "old_last", "new_first", "evidence"])


def compile_panel() -> dict:
    changes = symbol_changes()
    files = sorted((CACHE / "bhav").glob("*.zip"))
    print(f"Compiling {len(files)} sessions")
    long = pd.concat([read_bhav(p) for p in files], ignore_index=True)
    long["symbol"] = rename(long, "date", changes)
    inferred = infer_renames(long)
    for r in inferred.sort_values("old_last").itertuples():
        changes.setdefault(r.old, []).append((pd.Timestamp(r.new_first), r.new))
    long["symbol"] = rename(long, "date", changes)
    print(f"  {len(inferred)} symbol changes inferred beyond NSE's list")
    long["rank"] = long["series"].map({s: i for i, s in enumerate(SERIES)})
    long = (long.sort_values(["date", "symbol", "rank"])
            .drop_duplicates(["date", "symbol"]).drop(columns="rank"))

    # Exchange-traded funds trade in the EQ series too. Their ISINs, like every
    # mutual fund unit's, begin INF; a company's begin INE. Funds that stopped
    # trading before ISINs appear in the files (2011) are caught by name.
    isin = (long.dropna(subset=["isin"]).sort_values("date")
            .groupby("symbol")["isin"].last().str.strip())
    funds = set(isin.index[isin.str.startswith("INF")])
    no_isin = set(long["symbol"].unique()) - set(isin.index)
    funds |= {s for s in no_isin if re.search(r"BEES$|ETF|GOLD$", s)}
    long = long[~long["symbol"].isin(funds)]

    long.loc[long["qty"].fillna(0) <= 0, "value"] = 0.0
    wide = {c: long.pivot(index="date", columns="symbol", values=c)
            for c in ("close", "value", "series")}
    liq = wide["value"].fillna(0).rolling(C.LIQ_WINDOW, min_periods=1).median()
    month_end = liq.groupby(liq.index.to_period("M")).tail(1)
    ranks = month_end.where(month_end > 0).rank(axis=1, ascending=False)
    keep = sorted(ranks.columns[(ranks <= KEEP_TOP).any()])
    print(f"  {long['symbol'].nunique()} equities traded ({len(funds)} funds excluded); "
          f"{len(keep)} were ever in the top {KEEP_TOP}")

    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*-[12][0-9][0-9][0-9].csv.gz"):
        old.unlink()
    for name, df in wide.items():
        df = df[keep]
        df.index.name = "Date"
        for year, part in df.groupby(df.index.year):
            fmt = {"close": "%.2f", "value": "%.0f"}.get(name)
            part.dropna(axis=1, how="all").to_csv(
                OUT / f"{name}-{year}.csv.gz", float_format=fmt,
                compression={"method": "gzip", "mtime": 0})

    bc_files = sorted((CACHE / "pr").glob("*.zip"))
    bc = pd.concat([read_bc(p) for p in bc_files], ignore_index=True)
    bc["symbol"] = rename(bc, "ex_date", changes)
    bc["purpose"] = bc["purpose"].str.replace(r"\s+", " ", regex=True)
    bc = (bc.sort_values("seen").drop_duplicates(["symbol", "ex_date", "purpose"])
          .sort_values(["ex_date", "symbol"]))
    bc = bc[bc["symbol"].isin(keep)]
    bc.to_csv(OUT / "corporate_actions_nse.csv", index=False, date_format="%Y-%m-%d")
    print(f"  {len(bc)} corporate actions for kept stocks, {len(bc_files)} files")

    for name in REFERENCE:
        (OUT / name).write_bytes((CACHE / name).read_bytes())
    pd.DataFrame({"symbol": sorted(funds)}).to_csv(OUT / "funds_excluded.csv", index=False)
    inferred.to_csv(OUT / "renames_inferred.csv", index=False)

    return {"sessions": int(wide["close"].shape[0]),
            "fundsExcluded": len(funds),
            "renamesInferred": len(inferred),
            "firstSession": str(wide["close"].index.min().date()),
            "lastSession": str(wide["close"].index.max().date()),
            "symbolsTraded": int(long["symbol"].nunique()),
            "symbolsKept": len(keep),
            "corporateActions": int(len(bc)),
            "corporateActionFiles": len(bc_files)}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--compile", action="store_true", help="rebuild raw/nse/ from the cache only")
    ap.add_argument("--tri", action="store_true", help="download the total return indices only")
    args = ap.parse_args()
    started = datetime.now(timezone.utc).isoformat(timespec="seconds")
    CACHE.mkdir(parents=True, exist_ok=True)

    if args.tri or not args.compile:
        OUT.mkdir(parents=True, exist_ok=True)
        fetch_tri().to_csv(OUT / "index_tri.csv", float_format="%.2f", date_format="%Y-%m-%d")
        if args.tri:
            return 0

    if not args.compile:
        manifest = download()
        OUT.mkdir(parents=True, exist_ok=True)
        manifest.sort_values(["kind", "date"]).to_csv(
            OUT / "manifest.csv.gz", index=False, compression={"method": "gzip", "mtime": 0})

    summary = compile_panel()
    log = {"compiledAt": started, "window": [C.FETCH_START, C.FETCH_END],
           "series": list(SERIES), "keepTop": KEEP_TOP, **summary}
    if not args.compile:
        log["fetchedAt"] = started
    else:
        old = OUT / "fetch_log.json"
        if old.exists():
            log["fetchedAt"] = json.loads(old.read_text()).get("fetchedAt")
        if not log.get("fetchedAt"):          # the date of the newest cached download
            newest = max(p.stat().st_mtime for p in CACHE.rglob("*.zip"))
            log["fetchedAt"] = datetime.fromtimestamp(newest, timezone.utc).isoformat(timespec="seconds")
    (OUT / "fetch_log.json").write_text(json.dumps(log, indent=2) + "\n")
    print(json.dumps(log, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
