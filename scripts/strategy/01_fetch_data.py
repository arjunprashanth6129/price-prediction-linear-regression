#!/usr/bin/env python3
"""Stage 1: download everything the strategy study uses. Network only.

    raw/nifty500_list.csv      NSE Indices' current Nifty 500 constituents
    raw/adj_close.csv.gz       closes adjusted for splits and dividends
    raw/close.csv.gz           closes adjusted for splits only
    raw/volume.csv.gz          shares traded, adjusted for splits
    raw/indices.csv.gz         Nifty 50 and Nifty 500 price indices
    raw/iima_monthly.csv       IIMA Fama-French and momentum factors, monthly
    raw/iima_daily.csv         the same, daily
    raw/iima_citation.bib      the citation the IIMA library asks for
    raw/fetch_log.json         when it ran and what failed

Everything lands in raw/ and is committed, so stages 2 onwards run offline
against the exact files the published results came from. Re-running this
stage changes those results: the constituent list is today's, and Yahoo
revises its adjustments.

Why both closes
---------------
Returns use the dividend-adjusted close, so a holding earns its dividends.
Traded value uses the split-adjusted close times split-adjusted volume, which
equals the rupee value that actually changed hands; the dividend adjustment
would shrink older traded values by the cumulative dividends paid since.

Universe and survivorship
-------------------------
The list is the Nifty 500 as it stands today, so every stock in it survived to
today. A backtest on it overstates returns, because the stocks that fell out of
the index, or were delisted, are missing. Stage 4 measures the strategy against
an equal-weight benchmark drawn from the same list, which shares that bias, and
the paper reports the issue rather than hiding it.

    python3 scripts/strategy/01_fetch_data.py
"""
import json
import sys
import time
import urllib.request

from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import yfinance as yf

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import config as C  # noqa: E402

RAW = HERE / "raw"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36"

NIFTY500_URL = "https://niftyindices.com/IndexConstituent/ind_nifty500list.csv"
IIMA_BASE = "https://faculty.iima.ac.in/iffm/Indian-Fama-French-Momentum/"
IIMA_RELEASE = "2025-12"
IIMA_FILES = {
    "iima_monthly.csv": f"DATA/{IIMA_RELEASE}_FourFactors_and_Market_Returns_Monthly_SurvivorshipBiasAdjusted.csv",
    "iima_daily.csv": f"DATA/{IIMA_RELEASE}_FourFactors_and_Market_Returns_Daily_SurvivorshipBiasAdjusted.csv",
    "iima_citation.bib": "citation.bib",
}
INDICES = {"NIFTY50": "^NSEI", "NIFTY500": "^CRSLDX"}

# NSE symbols that Yahoo serves under a different name. Filled in from the
# failures this script reports; empty means every symbol resolved as listed.
RENAMES: dict[str, str] = {}

CHUNK = 50
RETRIES = 3


def download(url: str, dest: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as resp:
        dest.write_bytes(resp.read())
    print(f"  {dest.name:<22} {dest.stat().st_size:>10,} bytes  <- {url}")


def fetch_chunk(symbols: list[str]) -> pd.DataFrame:
    """One yfinance call, retried with a pause on failure."""
    for attempt in range(1, RETRIES + 1):
        try:
            raw = yf.download(symbols, start=C.FETCH_START, end=C.FETCH_END,
                              interval="1d", auto_adjust=False, actions=False,
                              progress=False, threads=False, group_by="column")
            if raw is not None and not raw.empty:
                return raw
        except Exception as exc:              # noqa: BLE001 - retried below
            print(f"    attempt {attempt} failed: {exc}")
        time.sleep(5 * attempt)
    return pd.DataFrame()


def field(raw: pd.DataFrame, name: str, symbols: list[str]) -> pd.DataFrame:
    """One OHLCV field as a date x symbol frame, whatever shape yfinance returns."""
    if isinstance(raw.columns, pd.MultiIndex):
        return raw[name].reindex(columns=symbols)
    return raw[[name]].set_axis(symbols, axis=1)


def main() -> int:
    RAW.mkdir(parents=True, exist_ok=True)
    started = datetime.now(timezone.utc).isoformat(timespec="seconds")

    print("Reference files")
    download(NIFTY500_URL, RAW / "nifty500_list.csv")
    for name, path in IIMA_FILES.items():
        download(IIMA_BASE + path, RAW / name)

    members = pd.read_csv(RAW / "nifty500_list.csv")
    tickers = sorted(members["Symbol"].astype(str).str.strip())
    mapping = {t: f"{RENAMES.get(t, t)}.NS" for t in tickers}
    print(f"\nUniverse: {len(tickers)} symbols")

    adj, close, vol = [], [], []
    symbols = list(mapping.values())
    for i in range(0, len(symbols), CHUNK):
        part = symbols[i:i + CHUNK]
        print(f"  prices {i + 1:>3}-{i + len(part):<3} of {len(symbols)}")
        raw = fetch_chunk(part)
        if raw.empty:
            continue
        adj.append(field(raw, "Adj Close", part))
        close.append(field(raw, "Close", part))
        vol.append(field(raw, "Volume", part))

    back = {v: k for k, v in mapping.items()}
    frames = {}
    for name, parts in (("adj_close", adj), ("close", close), ("volume", vol)):
        df = pd.concat(parts, axis=1).rename(columns=back)
        df.index = pd.DatetimeIndex(df.index).tz_localize(None).normalize()
        df.index.name = "Date"
        frames[name] = df.reindex(columns=tickers)

    # Rows on which no stock traded are Yahoo calendar artefacts, not sessions.
    sessions = frames["adj_close"].notna().any(axis=1)
    missing = [t for t in tickers if frames["adj_close"][t].isna().all()]
    for name, df in frames.items():
        df = df.loc[sessions].drop(columns=missing)
        fmt = "%.0f" if name == "volume" else "%.8g"
        df.to_csv(RAW / f"{name}.csv.gz", float_format=fmt)
        print(f"  {name}.csv.gz  {df.shape[0]} sessions x {df.shape[1]} stocks")

    idx = fetch_chunk(list(INDICES.values()))
    idx = field(idx, "Close", list(INDICES.values()))
    idx.columns = list(INDICES)
    idx.index = pd.DatetimeIndex(idx.index).tz_localize(None).normalize()
    idx.index.name = "Date"
    idx.dropna(how="all").to_csv(RAW / "indices.csv.gz", float_format="%.8g")
    print(f"  indices.csv.gz  {idx.notna().sum().to_dict()}")

    log = {
        "fetchedAt": started,
        "window": [C.FETCH_START, C.FETCH_END],
        "universe": len(tickers),
        "fetched": len(tickers) - len(missing),
        "noData": missing,
        "renames": RENAMES,
        "iimaRelease": IIMA_RELEASE,
        "yfinance": yf.__version__,
    }
    (RAW / "fetch_log.json").write_text(json.dumps(log, indent=2) + "\n")
    print(f"\nNo data for {len(missing)}: {', '.join(missing) or 'none'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
