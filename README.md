# Price signals on NSE stocks

Do past prices predict Indian stock returns? This repository asks the question
twice. First as a next-day forecast for 98 NSE stocks, which fails. Then as a
monthly ranking of stocks traded net of Indian costs, which works. It then
rebuilds the universe from NSE's own records, including every company that
later failed, and shows how much of the result was survivorship bias.

**Paper (PDF):** [Do Price Signals Predict Indian Stock Returns?](https://arjun-quant-projects.vercel.app/papers/moving-average-signals.pdf)
&nbsp;·&nbsp; **Interactive version:** https://arjun-quant-projects.vercel.app/linear-regression

---

## The result

A long-only strategy that holds the top fifth of NSE stocks, ranked each month
on four price signals, net of securities transaction tax, stamp duty, exchange
fees and the bid-ask spread. The universe is rebuilt each month from every stock
trading at the time.

| March 2009 to June 2026, net of costs | A year | Sharpe | Worst drawdown |
|---|---:|---:|---:|
| **Strategy** | **23.8%** | **0.80** | −37.0% |
| Nifty500 Momentum 50 (total return) | 21.9% | 0.79 | −38.1% |
| Equal-weight benchmark, same stocks | 16.8% | 0.48 | −58.1% |
| Nifty 500 (total return) | 16.0% | 0.55 | −38.1% |

| Return over the equal-weight benchmark | Development 2009–2018 | Holdout 2019–2026 | Full |
|---|---:|---:|---:|
| Mean difference, a year (t) | +2.8% (0.48) | **+8.3% (2.39)** | +5.2% (1.43) |
| Alpha, a year (t) | +6.9% (2.12) | **+9.6% (2.64)** | +8.4% (3.46) |
| Deflated Sharpe ratio | 0.85 | 0.89 | 0.95 |

![Growth of one rupee: the strategy against its benchmarks](https://arjun-quant-projects.vercel.app/figures/strategy-pit-equity.png)

**What it is.** The excess return is the momentum premium: on the Indian
four-factor model of Agarwalla, Jacob and Varma, the strategy's return over its
benchmark has a momentum loading of 0.52 and an alpha of +0.2% a year (t = 0.09).
It captures the premium about as well as NSE's own momentum index, not better,
and mostly outside the 200 largest stocks.

## Survivorship bias, measured

The first version of the strategy used today's Nifty 500, so every stock in it
had survived to 2026. Running the same strategy on three universes separates the
data source from the bias:

| Universe | Strategy | Benchmark | Gap |
|---|---:|---:|---:|
| Today's Nifty 500, Yahoo prices | 32.0% | 25.0% | +6.9 |
| Today's Nifty 500, NSE prices | 31.7% | 24.7% | +7.0 |
| Every stock trading at the time, NSE | 23.8% | 16.8% | +7.1 |

![The same strategy on three universes](https://arjun-quant-projects.vercel.app/figures/strategy-pit-survivorship.png)

Survivorship added about eight points a year to both the strategy and its
benchmark, and left the gap between them alone. The equal-weight portfolio of the
corrected universe tracks NSE's Nifty500 Equal Weight index, which NSE computes
on each date's actual constituents (monthly correlation 0.995).

## The first attempt: a next-day forecast

One least squares regression per stock, on a 5-day and a 20-day moving average,
the one-day return and the ratio of the two averages, for 98 NSE stocks from 2019
to 2026, with a chronological 80/20 split.

| Out of sample, 98 stocks | Value |
|---|---|
| Mean $R^2$ | −0.0155 |
| Mean directional accuracy | 49.6% |
| Stocks significantly more accurate than 50% | 0 |
| Expected edge of a random forecast over the always-up benchmark | +2.22 pts (the model: +1.85) |

The daily forecast carried no usable information, which pointed to the redesign:
compare stocks with each other, at a monthly horizon, as a portfolio with costs.

## How the test was kept honest

- **Frozen before it was run.** Candidate signals, the selection rule, the
  portfolio, the cost schedule and every reported variant were committed before
  the first backtest (`46472c0`), with the price loader cut at December 2018.
- **Holdout run once.** The primary model was changed once, on development data,
  with the reason recorded in `config.py` (`3b4a728`). Only then was the
  2019–2026 holdout unlocked (`b6ad107`) and run (`13ca9b7`).
- **Data rules frozen before the rerun.** Every rule for the NSE data, including
  corporate actions, delisting returns and the universe, was validated against
  Yahoo, NSE's index and NSE's records, and committed before any strategy return
  on that data (`8a29d77`). The strategy was then rerun once, unchanged
  (`5300093`).
- **Checks for luck and leakage.** 1,000 random portfolios, 500 placebo spreads,
  a deflated Sharpe ratio for the 20 variants tried, a stationary bootstrap, and
  a leak test that ranks on the future return on purpose (Sharpe 5.2) and on
  one-month-stale scores (slightly worse than live). Unit tests change every
  price after a date and confirm nothing before it moves.

## Reproduce

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest tests/                                   # 26 tests
```

The monthly strategy (`scripts/strategy/`). The raw data is committed, so every
stage after the first runs offline.

```bash
python3 scripts/strategy/01_fetch_data.py       # network: Yahoo prices, IIMA factors
python3 scripts/strategy/01b_fetch_nse.py       # network: NSE daily files and index history
python3 scripts/strategy/02_clean.py            # data quality, Yahoo panel
python3 scripts/strategy/02b_validate_nse.py    # data checks, NSE panel (no strategy returns)

# Each source: survivor (Yahoo, today's Nifty 500), pit (NSE, every stock), pit-survivors
STRATEGY_SOURCE=pit python3 scripts/strategy/04_backtest.py
STRATEGY_SOURCE=pit python3 scripts/strategy/05_robustness.py
STRATEGY_SOURCE=pit python3 scripts/strategy/06_figures.py
python3 scripts/strategy/07_survivorship.py     # the three universes side by side
python3 scripts/strategy/08_site_data.py        # display fields for the site
```

The daily regression (`scripts/ml/`) runs as before, from the committed
`raw_prices.csv`:

```bash
python3 scripts/ml/05_generate_signals.py && python3 scripts/ml/06_figures.py
```

The paper takes every number, table and figure from the committed results:

```bash
python paper/make_assets.py && (cd paper && tectonic moving-average-signals.tex)
```

The site:

```bash
npm install && npm run dev                      # http://localhost:3000/linear-regression
```

## Where to find things

| Path | Contents |
|---|---|
| [`results/strategy/pit/RESULTS.md`](results/strategy/pit/RESULTS.md) | the survivorship-free results memo, every number including the weak ones |
| [`results/strategy/survivorship.md`](results/strategy/survivorship.md) | the three universes side by side, with the pre-registered sensitivity runs |
| [`results/strategy/pit/data_quality.md`](results/strategy/pit/data_quality.md) | every corporate action, repair, exit and data check on the NSE panel |
| [`results/strategy/RESULTS.md`](results/strategy/RESULTS.md) | the first, survivor-universe results memo |
| `scripts/strategy/config.py` | the frozen specification, with every deviation recorded |
| `scripts/strategy/nse.py` | how NSE's prices are adjusted and how exits are treated |
| `scripts/strategy/raw/` | Yahoo prices, IIMA factors and NSE's daily files (`nse/`), with sources |
| `scripts/ml/` | the daily regression |
| `paper/` | LaTeX source, PDF and `make_assets.py` |
| `app/`, `lib/` | the Next.js site; `lib/strategy.ts` reads `data/strategy/site.json` |
| `tests/` | look-ahead, engine, metrics and NSE data tests |

## Limitations

- The survivorship-free rerun used a holdout that had already been seen, so it is
  a replication on corrected data, not a second out-of-sample test.
- The signals come from a literature that documents momentum, including Indian
  evidence covering part of the holdout.
- The edge is small among the largest stocks (+1.6% a year over the benchmark in
  the 200 most traded, t = 0.46), and short-term capital gains tax and market
  impact are not modelled.
- Momentum crashes in sharp rebounds: from March to December 2009 the strategy
  trailed its benchmark by about 90 points.
- NSE's corporate action files start in 2010; earlier dividends are missing for
  every stock alike, and a few early splits in then-illiquid stocks are
  unadjusted. The full list is in the paper and the data-quality report.

## Scope

Student research, not investment advice.

## License

MIT. See [LICENSE](LICENSE).
