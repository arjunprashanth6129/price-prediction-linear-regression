# Survivorship-free replication: results memo

The first study (`results/strategy/RESULTS.md`) drew its universe from today's
Nifty 500, so every stock in it survived to 2026. This memo reports the same
frozen strategy rerun on NSE's own daily records of every equity that traded
from 2005, including the companies that later merged, failed or delisted. The
data rules, the universe rule and the exit returns were committed in
`806d2d0` before any strategy return on this data was computed, and the run
was made once. The holdout had already been seen in the first study, so this
is a replication on corrected data, not a new out-of-sample test.

Detail: [`backtest.md`](backtest.md), [`robustness.md`](robustness.md),
[`signal_research.md`](signal_research.md), [`data_quality.md`](data_quality.md),
[`../survivorship.md`](../survivorship.md); figures `docs/figures/strategy-pit-*.png`.

## 1. What changed and what did not

| | First study | Replication |
|---|---|---|
| Prices | Yahoo, adjusted by Yahoo | NSE bhavcopy, adjusted from NSE's corporate action files (`nse.py`) |
| Universe | today's Nifty 500 names | at each month-end, the 500 most traded NSE equities by six-month median traded value, then the same filters; 400 stocks every month, 1,359 over the sample |
| Stocks that stop trading | absent | an exit return on the next session: 0% for mergers and voluntary delistings, −30% for distress |
| Benchmarks | Nifty price indices | NSE Indices' total return series, including Nifty500 Equal Weight and Nifty500 Momentum 50 |
| Strategy | M2: four signals, top quintile, long only, monthly, one-session lag, Indian costs | unchanged |

## 2. Headline (net of costs)

| | Development 2009-03 to 2018-12 | Holdout 2019-01 to 2026-06 | Full |
|---|---:|---:|---:|
| **Strategy CAGR** | +21.3% | +27.3% | +23.8% |
| Equal-weight universe (EW) CAGR | +16.4% | +17.3% | +16.8% |
| Nifty 500 total return | +17.4% | +14.2% | +16.0% |
| Nifty500 Equal Weight total return | +19.7% | +17.3% | +18.7% |
| Nifty500 Momentum 50 total return | +23.6% | +19.7% | +21.9% |
| **Strategy Sharpe** | 0.69 | 0.93 | 0.80 |
| EW Sharpe | 0.43 | 0.58 | 0.48 |
| Nifty500 Momentum 50 Sharpe | 0.86 | 0.71 | 0.79 |
| Strategy max drawdown | −34.7% | −37.0% | −37.0% |
| EW max drawdown | −49.3% | −45.8% | −58.1% |
| Return over EW, a year (NW t) | +2.8% (0.48) | **+8.3% (2.39)** | +5.2% (1.43) |
| Alpha against EW, a year (NW t) | +6.9% (2.12) | **+9.6% (2.64)** | +8.4% (3.46) |
| Sharpe 95% interval (block bootstrap) | 0.07 to 1.34 | 0.21 to 1.84 | 0.29 to 1.34 |
| Deflated Sharpe Ratio (20 trials) | 0.85 | 0.89 | 0.95 |
| One-way turnover, a year | 418% | 416% | 417% |
| Cost drag, a year | 2.67% | 2.59% | 2.63% |
| Break-even cost, multiple of the schedule | 2.4x | 5.1x | 3.6x |

## 3. How much was survivorship bias

The same strategy on three universes (full sample, net of costs):

| Universe | Strategy CAGR | EW CAGR | Return over EW (t) | Four-factor alpha over EW (t) |
|---|---:|---:|---:|---:|
| Yahoo, today's Nifty 500 (first study) | +32.0% | +25.0% | +5.0% (1.60) | +0.2% (0.11) |
| NSE, today's Nifty 500 | +31.7% | +24.7% | +5.1% (1.62) | +0.1% (0.04) |
| NSE, every stock trading at the time | +23.8% | +16.8% | +5.2% (1.43) | +0.2% (0.09) |

- The change of data source moved returns by about 0.3 points a year.
- Survivorship bias was about 8 points a year, and it lifted the strategy and
  its benchmark by the same amount.
- The first study's absolute returns were overstated by about 8 points a year.
  Its edge over the benchmark was not: +5.0% there, +5.2% here.
- The survivor universe's equal-weight portfolio beat NSE's Nifty500 Equal
  Weight index by 6.4 points a year. The survivorship-free one trails it by
  1.9 points, net of costs, with a monthly correlation of 0.995.

## 4. Skill, luck or leakage

| Check | Development | Holdout | Full |
|---|---:|---:|---:|
| Mean monthly rank IC of the score (NW t) | +0.068 (3.46) | +0.042 (2.13) | +0.055 (3.85) |
| Share of 1,000 random portfolios beaten, Sharpe before costs | 100% | 100% | 100% |
| Random portfolios' 95th-percentile Sharpe, against the strategy's | 0.51 vs 0.81 | 0.69 vs 1.04 | 0.56 vs 0.92 |
| Share of 500 placebo spreads beaten | 99.2% | 99.6% | 100% |
| Leak canary: Sharpe when ranking on the forward return | 4.9 | 6.0 | 5.2 |
| One-month-stale scores, Sharpe (live in brackets) | 0.64 (0.69) | 0.85 (0.93) | 0.74 (0.80) |

The 12-1 momentum spread correlates 0.861 with IIMA's survivorship-adjusted
WML factor (0.838 in the first study).

## 5. What the result is

On the IIMA four-factor model, full sample (to Dec 2025):

| | Alpha, a year (t) | Momentum loading |
|---|---:|---:|
| Strategy | −1.1% (−0.47) | 0.39 |
| EW | +0.3% (0.25) | −0.17 |
| Strategy minus EW | +0.2% (0.09) | 0.52 |

The edge over the benchmark is the momentum premium, as in the first study.
Two comparisons put it in proportion:

- **Against the market**, the strategy returned 23.8% a year against 16.0% for
  the Nifty 500, with a higher Sharpe (0.80 against 0.55) and a shallower
  worst drawdown than the equal-weight universe.
- **Against NSE's own momentum index** (Nifty500 Momentum 50), it did about as
  well, not better: 23.8% against 21.9% a year, the same Sharpe (0.80 against
  0.79). It lagged that index in development and led it in the holdout. The
  index pays no trading costs. Its history before its 2024 launch was
  back-calculated by NSE with a method chosen in 2024.

## 6. Weak points

1. **The edge sits outside the largest stocks.**

   | Liquidity tercile (full) | Alpha vs that tercile's EW (t) | Return over it (t) |
   |---|---:|---:|
   | Most liquid | +4.2% (1.71) | +0.9% (0.25) |
   | Middle | +10.5% (3.80) | +7.6% (2.16) |
   | Least liquid | +10.1% (3.80) | +6.8% (1.76) |

   Restricted to the 200 most traded stocks, the return over EW is +1.6% a
   year (t 0.46) over the full sample and negative in development. With
   1,000 stocks it is +7.5% (t 2.33). Market impact for large orders is not
   modelled.
2. **Development is weak on its own.** Return over EW +2.8% a year (t 0.48);
   only the alpha (t 2.12) is significant there.
3. **Momentum crashes.** 2009 (from March): +83% against +173% for EW. 2025:
   −11.0% against +1.9%. Also behind EW in 2016.
4. **Exit returns barely matter**, which cuts both ways. Distress at 0% or
   −100% changes nothing at the first decimal. Failing companies leave the
   500 most traded stocks before they stop trading. Of 688 exits after March
   2009, 53 were in EW the month before (3 classed as distress) and 18 were
   held by the strategy, all mergers or voluntary delistings booked at 0%.
5. **The long-short spread** returns +13.1% a year with a Sharpe of 0.39 and
   a −56% drawdown, and cannot be traded in the Indian cash market.
6. **Data limits** (all in `data_quality.md`):
   - returns are price only before 2010;
   - about one dividend record in ten from 2010 gives no amount and is
     missed;
   - a handful of pre-2010 splits in then-illiquid stocks are left
     unadjusted;
   - exit classes are partly inferred from each stock's own record (two
     mergers, RNRL and Tata Steel BSL, are classed as distress);
   - the universe ranks by traded value, not market capitalisation.
7. **Not modelled:** short-term capital gains tax (20%), market impact.

## 7. Selection rule on the new development data (reported only)

On NSE's survivorship-free development data the rule (|NW t| ≥ 2) would
select seven signals: the frozen four (12-1 momentum, 52-week high, close
above its 200-day average, volume shock), plus the 50- and 100-day trend
signals and low volatility. The frozen four remain the strategy. The
others were not tested here, since that would be a new search.

## 8. Other variants (not the primary)

| Full sample, net | CAGR | Sharpe |
|---|---:|---:|
| `M2_buffer` (hold until a name leaves the top 30%) | +25.3% | 0.85 |
| `M3` (walk-forward Fama-MacBeth) | +21.9% | 0.73 |
