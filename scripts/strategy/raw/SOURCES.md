# Sources

Downloaded by `scripts/strategy/01_fetch_data.py` on 21 October 2026 (see
`fetch_log.json`). Stages 2 onwards read only these files.

| File | Source | Notes |
|---|---|---|
| `nifty500_list.csv` | NSE Indices, https://niftyindices.com/IndexConstituent/ind_nifty500list.csv | Constituents on the download date: 501 rows, of which 499 have Yahoo price data (`BAGMANE`, a recent listing, and `DUMMYHEG`, a placeholder symbol, have none). |
| `adj_close.csv.gz` | Yahoo Finance via yfinance, `auto_adjust=False`, field `Adj Close` | Adjusted for splits, bonuses and dividends. Rounded to 8 significant figures. |
| `close.csv.gz` | the same download, field `Close` | Adjusted for splits and bonuses only. |
| `volume.csv.gz` | the same download, field `Volume` | Shares, adjusted for splits. |
| `indices.csv.gz` | Yahoo Finance, `^NSEI` (Nifty 50) and `^CRSLDX` (Nifty 500) | Price indices, not total-return indices. |
| `iima_monthly.csv`, `iima_daily.csv` | IIMA Indian Fama-French and Momentum Data Library, release 2025-12, survivorship-bias-adjusted files, https://faculty.iima.ac.in/iffm/Indian-Fama-French-Momentum/ | Columns SMB, HML, WML, MF (market minus risk-free) and RF, in percent, October 1993 to December 2025. |
| `iima_citation.bib` | the same library | Agarwalla, Jacob and Varma (2013), the citation the library requests. |
