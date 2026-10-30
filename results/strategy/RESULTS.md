# Cross-sectional strategy study: results memo

This is the checkpoint memo for the redesign of project 1. It reports every
number, including the weak ones, before any paper or site text is written. The
full tables are in [`backtest.md`](backtest.md), [`robustness.md`](robustness.md),
[`signal_research.md`](signal_research.md) and [`data_quality.md`](data_quality.md);
the figures are `docs/figures/strategy-*.png`.

## 1. What was tested

| | |
|---|---|
| Universe | the current Nifty 500 (499 stocks with data), with a point-in-time filter at each month-end: 252 sessions of history, trades on 90% of the last 252 sessions, and not among the least liquid 20% by 6-month median traded value |
| Eligible stocks | 200 to 276 per month in development (median 236); 276 to 374 in the holdout (median 320) |
| Data | Yahoo daily closes and volume, 2005 to June 2026, adjusted for splits and dividends; 186 bad ticks removed and 47 breaks (splits, bonuses and demergers that Yahoo leaves in the adjusted series) repaired, each one listed |
| Signals selected | 12-1 momentum, closeness to the 52-week high, close above its 200-day average, volume shock: the four of ten candidates whose mean monthly rank IC had a Newey-West \|t\| of at least 2 on Jan 2006 to Oct 2018 signal dates |
| Primary strategy | `M2`: the average of the four signals' z-scores; hold the top quintile, equal weight, long only; rebalance monthly, trading at the close one session after the signal |
| Costs | STT 0.1% each side, stamp duty 0.015% on buys, exchange and SEBI charges with GST, and a 5 / 15 / 35 bp spread by liquidity tercile |
| Benchmark | equal weight across every eligible stock (EW), which shares the universe's survivorship bias; the Nifty 50 and Nifty 500 price indices for context |
| Protocol | development Mar 2009 to Dec 2018; holdout Jan 2019 to Jun 2026, run once. The git log records the order: specification frozen (`c0d80f6`), primary chosen on development data (`597cea2`), holdout unlocked (`853b7ac`) |

One design decision changed during development, and it is recorded in
`config.py`. The frozen specification named the Fama-MacBeth model `M3` as
primary. On the development period its forecasts had a negative rank IC
(−0.015). Its walk-forward slopes on three collinear trend signals had been fitted
mostly to the 2008–09 crash and rebound. The equal-weight composite `M2` had
+0.046 (t = 2.18), so it became the primary before the holdout was opened. `M3`
is still reported.

## 2. Headline results (net of costs)

| | Development 2009-03 to 2018-12 | Holdout 2019-01 to 2026-06 | Full |
|---|---:|---:|---:|
| **Strategy CAGR** | +31.0% | +33.3% | +32.0% |
| EW CAGR | +26.9% | +22.7% | +25.0% |
| Nifty 500 CAGR (price index) | +16.1% | +13.0% | +14.8% |
| **Strategy Sharpe** | 1.14 | 1.16 | 1.15 |
| EW Sharpe | 0.81 | 0.80 | 0.81 |
| Strategy max drawdown | −27.9% | −36.9% | −36.9% |
| EW max drawdown | −32.9% | −39.7% | −45.5% |
| Return over EW, a year (NW t) | +2.4% (0.47) | **+8.5% (2.67)** | +5.0% (1.60) |
| Alpha against EW, a year (NW t) | +8.5% (2.73) | **+9.9% (3.19)** | +9.2% (4.09) |
| Beta to EW | 0.69 | 0.92 | 0.78 |
| Sharpe 95% interval (block bootstrap) | 0.46 to 1.85 | 0.41 to 2.13 | 0.60 to 1.73 |
| Deflated Sharpe Ratio (20 trials) | 0.99 | 0.95 | 1.00 |
| One-way turnover, a year | 406% | 396% | 401% |
| Cost drag, a year | 2.57% | 2.45% | 2.52% |
| Break-even cost, multiple of the schedule | 2.1x | 5.2x | 3.4x |

The holdout is stronger than the development period. Both the return over the
benchmark and the alpha are significant at 1%, net of costs.

## 3. Is it skill, luck or leakage?

| Check | Development | Holdout | Full |
|---|---:|---:|---:|
| Mean monthly rank IC of the score (NW t) | +0.050 (2.62) | +0.035 (2.00) | +0.042 (3.14) |
| Share of 1,000 random portfolios beaten, Sharpe before costs | 100% | 100% | 100% |
| Random portfolios: 95th-percentile Sharpe, against the strategy's 1.27 | 0.90 | 0.91 | 0.88 |
| Share of 500 placebo spreads beaten (scores shuffled across stocks) | 94.0% | 99.6% | 100% |
| Leak canary: Sharpe when ranking on the forward return itself | 5.1 | 6.1 | 5.5 |
| Leak canary: Sharpe with one-month-stale scores (live: 1.14 / 1.16 / 1.15) | 1.11 | 1.04 | 1.07 |

Other verification:
- **Momentum check.** Our 12-1 momentum spread correlates 0.838 with IIMA's
  survivorship-adjusted WML factor.
- **Tests.** 17 tests pass, including look-ahead invariance: every price after a
  date is corrupted, and nothing dated on or before it changes.
- **Hand check.** One month (June 2023) was recomputed by hand: holdings, turnover
  and cost match the engine exactly.

## 4. What the result is

On the IIMA four-factor model (data through Dec 2025):

| Full sample | Alpha, a year (t) | Market | Size | Value | Momentum (t) |
|---|---:|---:|---:|---:|---:|
| Strategy | +6.4% (2.95) | 0.98 | 0.34 | 0.24 | 0.38 (7.2) |
| EW | +7.2% (6.14) | 1.06 | 0.25 | 0.16 | −0.10 |
| Strategy minus EW | +0.2% (0.11) | −0.05 | 0.09 | 0.06 | 0.45 (10.8) |

The strategy's return over the benchmark is the momentum premium. Once momentum
is controlled for, no alpha is left (t = 0.11). The study does not find a new
anomaly. What it shows is that a documented premium survives Indian costs, a
realistic execution lag and an untouched seven-and-a-half-year holdout, when
captured in a form a long-only investor can trade.

## 5. Weak points and limitations

1. **Survivorship bias.** The universe is today's Nifty 500, so every stock in
   it survived. The equal-weight universe beat the Nifty 500 price index by about
   10 points a year (about 9 after the index's dividends). It has a four-factor
   alpha of 7.2% that is entirely bias. Absolute returns are therefore overstated.
   - **Read instead:** the comparisons with EW, the random portfolios and the
     factor regression of strategy minus EW. All three are built from the same
     biased universe.
   - **Remaining bias:** some survives even in those comparisons, because past
     losers that later failed are missing from the sample.
2. **The long-short spread is weak.** `M2_LS` returns +6.5% a year over the full
   sample with a Sharpe of 0.12 and a maximum drawdown of −58%. In the holdout it
   returns +12.4% (Sharpe 0.44). Survivorship lifts the short leg most, since the
   losers in the sample are the ones that recovered. The spread could not be
   traded in the Indian cash market anyway.
3. **The edge is in less liquid stocks.**

   | Liquidity tercile (full sample) | Alpha vs that tercile's EW | t | Return over it |
   |---|---:|---:|---:|
   | Most liquid | +3.5% | 1.57 | +0.1% |
   | Middle | +8.6% | 3.24 | — |
   | Least liquid | +11.2% | 3.60 | — |

   Spreads are charged by tercile, but market impact for large orders is not
   modelled.
4. **Momentum crashes are visible.**
   - 2009 (from March): +95.6% against +179.9% for EW, the classic rebound crash.
   - 2025: −4.1% against +5.0% for EW, the Sept 2024 – Apr 2025 momentum drawdown.
   - 2016 and 2020: also behind EW.
5. **The estimated model failed in development.** In the holdout `M3` did well
   (+6.4% a year over EW, t = 2.11). Over the full sample it is weaker than `M2`
   (Sharpe 0.86 against 1.15).
6. **Costs and tax.**
   - Turnover is about 400% a year and costs about 2.5% a year.
   - The rank-buffer variant `M2_buffer` cuts costs to 1.6% a year and has a
     higher Sharpe (1.21), but it was not the pre-registered primary.
   - Short-term capital gains tax (20%) is not modelled.
   - The October 2024 cost schedule is applied to the whole sample.
7. **Smaller issues.**
   - Bad ticks were removed with hindsight, as a data vendor would remove them.
   - The IIMA factors end in Dec 2025, and the risk-free rate is carried forward
     to Jun 2026.
   - The Nifty indices are price indices only.

## 6. Sensitivity (full sample, net of costs)

Each run changes one setting of the primary. None of them was used to choose.

| Variant | CAGR | Sharpe | Return over EW (t) |
|---|---:|---:|---:|
| Primary (`M2`) | +32.0% | 1.15 | +5.0% (1.60) |
| Momentum lookback 6 months | +31.6% | 1.12 | +4.8% (1.61) |
| Momentum lookback 9 months | +31.2% | 1.11 | +4.4% (1.47) |
| No skip month | +31.5% | 1.14 | +4.6% (1.48) |
| Top decile | +36.4% | 1.20 | +8.9% (2.26) |
| Top tercile | +29.6% | 1.10 | +3.0% (1.16) |
| Rank buffer | +34.2% | 1.21 | +6.9% (2.20) |
| Costs doubled | +28.7% | 1.03 | +2.4% (0.77) |

## 7. Decisions for the write-up

- Headline: `M2` on the holdout, net of costs, against EW, with the survivorship
  gap shown alongside rather than in a footnote.
- The factor attribution as the interpretation: a documented premium captured in
  tradable form, not a new anomaly.
- Placement of the old per-stock regression: one short baseline section.
- Whether the site leads with the equity curve or with the holdout table.
