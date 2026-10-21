# NSE source files

Downloaded on 21 October 2026 by `scripts/strategy/01b_fetch_nse.py`. Every
downloaded file is listed in `manifest.csv.gz` with its size and SHA-256.

| File | Source | What it holds |
|---|---|---|
| `close-YYYY.csv.gz` | NSE bhavcopy, `nsearchives.nseindia.com/content/historical/EQUITIES/` (to 5 Jul 2024) and `content/cm/BhavCopy_NSE_CM_*` (from 8 Jul 2024) | The close each equity traded at, unadjusted, one column per stock. Series EQ, BE, BZ and BT, in that order of preference; symbols mapped through `symbolchange.csv` to the last name they traded under |
| `value-YYYY.csv.gz` | the same | Rupees traded that session (zero when nothing traded) |
| `series-YYYY.csv.gz` | the same | The series each close came from |
| `corporate_actions_nse.csv` | `Bc*.csv` inside `nsearchives.nseindia.com/archives/equities/bhavcopy/pr/PRDDMMYY.zip`, every session from January 2010 (NSE serves none earlier) | Every equity corporate action announced, with its ex-date and purpose text exactly as NSE wrote it |
| `symbolchange.csv` | `nsearchives.nseindia.com/content/equities/symbolchange.csv` | NSE's list of symbol changes |
| `delisted.csv` | `nsearchives.nseindia.com/content/equities/delisted.csv` | NSE's list of delisted companies, with the type of delisting; it appears to end in 2020 |
| `EQUITY_L.csv` | `nsearchives.nseindia.com/content/equities/EQUITY_L.csv` | Equities listed on the download date |
| `index_tri.csv` | NSE Indices, `niftyindices.com` historical data, Total Returns Index | Daily total return index levels of the Nifty 50, Nifty 500, Nifty500 Equal Weight and Nifty500 Momentum 50. NSE launched the last two in 2024 and back-calculated them to 1 April 2005 on the constituents of each past date |

Derived by `01b_fetch_nse.py` from the files above:

| File | What it holds |
|---|---|
| `funds_excluded.csv` | Exchange-traded funds, which trade in the EQ series too: every symbol whose ISIN begins INF (a mutual fund unit), and, for funds that stopped trading before ISINs appear in the files (2011), symbols ending BEES, GOLD or containing ETF |
| `renames_inferred.csv` | Symbol changes missing from `symbolchange.csv`: a symbol that stops trading and another that starts within five sessions with the same ISIN |
| `fetch_log.json` | When the files were downloaded and compiled, and what was kept |

Only stocks that were among the 1,000 most traded, by six-month median traded
value, at some month-end are kept; a stock outside that set never enters the
500-stock universe.

Bonuses and splits that NSE's files omit, verified against company filings,
are listed separately in `scripts/strategy/corporate_actions_missing.csv`.
