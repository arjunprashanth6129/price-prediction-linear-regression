# Next-day return predictability from moving-average features: evidence from 98 NSE stocks

This report documents the study in full: question, data, method, results and
limitations. Code, data and instructions for reproducing every number are in the
[repository README](../README.md). An
[interactive version](https://arjun-quant-projects.vercel.app/linear-regression)
of the same results is on the project site.

---

## Abstract

This study tests whether four price-derived features predict the next-day return
of individual Indian equities. The features are a 5-day moving average, a 20-day
moving average, the one-day return, and the ratio of the two moving averages,
which expresses the golden-cross and death-cross conditions of technical analysis
as a continuous variable. An ordinary least squares regression is estimated
separately for each of 98 NSE-listed stocks on daily closes from June 2019 to June
2026. The first 80% of each series is used for estimation and the final 20%
(approximately 345 trading days, February 2025 to June 2026) is held out.

Out of sample, the mean coefficient of determination is -0.0155, and 81 of 98
stocks have a negative value. Mean directional accuracy is 49.6%. No stock's
accuracy is significantly above 50% in a two-sided binomial test at the 5% level;
seven are significantly below it, and none of those survives a false discovery
rate correction. The model exceeds an always-up benchmark by 1.85 percentage
points on average, but the benchmark was unusually weak in the test window (mean
47.8%), and a forecast with no information would have exceeded it by 2.2 points.
The moving-average ratio is the largest standardised coefficient for none of the
98 stocks, and its sign is positive for 61 and negative for 37. These results
are consistent with weak-form market efficiency for this feature set, model
class and horizon.

---

## Contents

- [1. Introduction](#1-introduction)
- [2. Data](#2-data)
- [3. Methodology](#3-methodology)
- [4. Results](#4-results)
  - [4.1 Explained variance](#41-explained-variance)
  - [4.2 Directional accuracy](#42-directional-accuracy)
  - [4.3 Statistical significance by stock](#43-statistical-significance-by-stock)
  - [4.4 The moving-average ratio](#44-the-moving-average-ratio)
  - [4.5 Results by market capitalisation](#45-results-by-market-capitalisation)
- [5. Level forecasts and the coefficient of determination](#5-level-forecasts-and-the-coefficient-of-determination)
- [6. Discussion](#6-discussion)
- [7. Limitations](#7-limitations)
- [8. Further work](#8-further-work)
- [References](#references)
- [Appendix: figures](#appendix-figures)

---

## 1. Introduction

Technical analysis assumes that the recent path of a price contains information
about its next move. Moving-average rules are the most widely used form of that
assumption. The golden cross, in which a short moving average rises above a long
one, is read as a buy signal, and the reverse crossing (the death cross) as a sell
signal.

The academic evidence on such rules is mixed. Brock, Lakonishok and LeBaron (1992)
found that moving-average and trading-range rules on the Dow Jones Industrial
Average from 1897 to 1986 produced returns that standard null models could not
explain. Sullivan, Timmermann and White (1999) re-examined those rules with a
bootstrap correction for data snooping and found that the best rule's performance
did not carry over into the following decade. Out-of-sample studies of return
prediction more broadly, notably Welch and Goyal (2008), find that most predictors
fail to beat the historical mean once they are evaluated on data not used to
select them.

This study asks a narrow version of the question:

> Given only a stock's recent price history, summarised by four standard
> technical features, does a linear model predict the sign and magnitude of the
> next day's return more accurately than benchmarks that use no model?

The null hypothesis is that the features carry no information about the next-day
return, so that out-of-sample accuracy is indistinguishable from that of a
forecast made without them. The benchmarks and evaluation metrics were fixed
before any model was estimated.

## 2. Data

| | |
|---|---|
| **Universe** | 100 NSE-listed companies across large, mid and small capitalisation ([`data/universe.json`](../data/universe.json)) |
| **Modelled** | 98 stocks |
| **Excluded** | 2 stocks, `GUJGASLTD` and `JPASSOCIAT`, which returned no usable price history over the window ([`data/ml-missing.json`](../data/ml-missing.json)) |
| **Sample period** | 2019-06-01 to 2026-06-30, fixed |
| **Frequency** | Daily closing prices, adjusted for splits and bonus issues (`yfinance`, `auto_adjust=True`) |
| **Observations** | Approximately 1,750 trading days per stock |
| **Test sample** | Approximately 345 trading days per stock (mean 345.4) |

Of the 98 modelled stocks, 77 traded on every session in the window. The other 21,
mostly companies listed after June 2019, are marked `partial` in the results and
use the history available to them.

![Daily close for all 98 modelled stocks, 2019-06-01 to 2026-06-30](https://arjun-quant-projects.vercel.app/figures/universe-closes.png)

Price adjustment corrects for splits and bonus issues, which would otherwise
appear as large one-day losses. It does not correct for demergers. Two demergers
fall inside the test period and are discussed in section 7.

## 3. Methodology

### 3.1 Features and target

Let $P_t$ denote the adjusted close of a stock on day $t$. The four features are
computed from closes up to and including day $t$:

| Feature | Definition | Interpretation |
|---|---|---|
| `ma5` | $\frac{1}{5}\sum_{i=0}^{4} P_{t-i}$ | short-term price level |
| `ma20` | $\frac{1}{20}\sum_{i=0}^{19} P_{t-i}$ | medium-term price level |
| `ret` | $r_t = P_t / P_{t-1} - 1$ | one-day return |
| `ma_ratio` | `ma5 / ma20` | moving-average crossing condition |

`ma_ratio` is above 1 when the short average is above the long average (the
golden-cross state) and below 1 in the death-cross state. Its distance from 1
measures how far apart the two averages are. Expressing the crossing as a
continuous variable lets the regression assign it a coefficient, which a binary
crossing indicator that fires a few times a year would not support.

The target is the next-day return, $r_{t+1} = P_{t+1} / P_t - 1$. Section 5
explains why the target is a return and not a price.

### 3.2 Estimation

For each stock, the model

$$
r_{t+1} = \beta_0 + \beta_1 \tilde{x}_{1,t} + \beta_2 \tilde{x}_{2,t} + \beta_3 \tilde{x}_{3,t} + \beta_4 \tilde{x}_{4,t} + \varepsilon_{t+1}
$$

is estimated by ordinary least squares (`sklearn.linear_model.LinearRegression`),
where $\tilde{x}_{k,t}$ is feature $k$ standardised to zero mean and unit variance
using the training sample's mean and standard deviation. Standardisation makes
the four coefficients comparable in size: each $\beta_k$ is the change in the
predicted return for a one standard deviation change in feature $k$.

A linear specification was chosen deliberately. It has five parameters per stock,
which limits the scope for overfitting on roughly 1,400 training observations,
and its coefficients can be read directly.

### 3.3 Sample split and leakage controls

The first 80% of each stock's observations form the training sample
(approximately June 2019 to January 2025) and the remaining 20% the test sample
(approximately February 2025 to June 2026). The split is chronological and the
rows are never shuffled.

![Chronological train/test split on the worked example](https://arjun-quant-projects.vercel.app/figures/train-test-split.png)

A random split would be invalid for two reasons. First, it would place
observations from later dates in the training sample and evaluate the model on
earlier ones. Second, adjacent rows share most of their inputs: `ma20` on two
consecutive days is computed from 19 common closes. A random split would
therefore evaluate the model on observations that are close to duplicates of
training rows, which overstates out-of-sample accuracy.

The standardisation parameters are estimated on the training sample only and then
applied to both samples. Estimating them on the full series would transmit the
test sample's mean and variance into the training data.

### 3.4 Evaluation

Three statistics are reported for each stock's test sample.

**Coefficient of determination.** $R^2 = 1 - \sum (r_{t+1} - \hat r_{t+1})^2 / \sum (r_{t+1} - \bar r)^2$,
computed with `sklearn.metrics.r2_score`, where $\bar r$ is the mean return of the
test sample. A negative value means the model's squared error exceeds that of a
constant forecast equal to the test-sample mean. This benchmark is stricter than
the out-of-sample $R^2$ of Campbell and Thompson (2008), which uses the training
mean, because the test mean is not known at the time of the forecast.

**Directional accuracy.** The share of test days on which the predicted and
realised returns have the same sign, with a day counted as "up" when its return
is strictly positive.

**Edge over the always-up benchmark.** Directional accuracy minus the share of
test days with a strictly positive return. The always-up rule needs no model and
is the natural benchmark for a long-only investor. Its value depends on the test
window: it is high in a rising market and low in a flat or falling one, so the
edge must be read alongside it.

Statistical significance is assessed per stock with a two-sided binomial test of
directional accuracy against 50%. With 98 simultaneous tests, the
Benjamini-Hochberg (1995) procedure is applied to control the false discovery
rate at 5%.

## 4. Results

| Statistic | Value |
|---|---|
| Mean $R^2$ on next-day returns | -0.0155 |
| Median $R^2$ | -0.0090 |
| Stocks with $R^2 > 0$ | 17 of 98 |
| Range of $R^2$ | -0.130 to +0.042 |
| Mean directional accuracy | 49.6% |
| Mean always-up benchmark | 47.8% |
| Mean edge over the benchmark | +1.85 percentage points |
| Stocks with a positive edge | 68 of 98 |
| Range of directional accuracy | 41.3% to 55.3% |
| Stocks with accuracy significantly above 50% (5% level) | 0 of 98 |
| Stocks with accuracy significantly below 50% (5% level) | 7 of 98 (0 after FDR correction) |
| Stocks for which `ma_ratio` has the largest coefficient | 0 of 98 |
| Sign of the `ma_ratio` coefficient | 61 positive, 37 negative |
| Mean absolute `ma_ratio` coefficient | 0.0016 |

### 4.1 Explained variance

The mean out-of-sample $R^2$ is -0.0155 and the median -0.0090. All 98 values lie
between -0.130 and +0.042. The 17 positive values are all below 0.05, and the
distribution has no right tail of stocks on which the model performs well.

![Distribution of R² on next-day returns across 98 stocks](https://arjun-quant-projects.vercel.app/figures/r2-distribution.png)

A negative mean $R^2$ indicates that, for the typical stock, the fitted model
forecasts next-day returns less accurately than a constant equal to the test-period
mean. This is the expected outcome when the regressors carry no information: the
estimated coefficients are fitted to noise in the training sample, and that noise
does not recur in the test sample.

### 4.2 Directional accuracy

Mean directional accuracy across the 98 stocks is 49.6%, and the cross-sectional
standard deviation is 3.1 percentage points. A t-test of the cross-sectional mean
against 50% gives t = -1.20, although this test overstates the effective sample
size because the stocks share a common test window and their errors are
correlated.

![Model directional accuracy against the always-up benchmark, one point per stock](https://arjun-quant-projects.vercel.app/figures/accuracy-vs-baseline.png)

The model exceeds the always-up benchmark for 68 of 98 stocks, with a mean edge
of +1.85 percentage points. This result reflects the benchmark more than the
model. Over the test window the median stock's price fell by 0.1% and only 49 of
98 stocks rose, so the share of up days was below 50% for 73 of the 98 stocks.
Any forecast whose accuracy is close to 50% will exceed a benchmark below 50%.

The appropriate comparison is a forecast with no information, such as one that
predicts up or down at random. Its expected accuracy is 50% for every stock, so
its expected edge over the always-up rule is 50% minus the benchmark, which
averages +2.2 percentage points across the 98 stocks. The model's mean edge of
+1.85 points is below that figure. Consistent with this, the correlation across
stocks between the model's edge and the shortfall of the benchmark below 50% is
0.55: stocks with the weakest benchmarks show the largest edges.

### 4.3 Statistical significance by stock

With approximately 345 test days, the standard error of a single stock's
directional accuracy under the null of 50% is about 2.7 percentage points.

| Test | Significant at 5% | Significant after FDR correction |
|---|---:|---:|
| Accuracy above 50% | 0 of 98 | 0 of 98 |
| Accuracy below 50% | 7 of 98 | 0 of 98 |

Under the null, roughly 2.5 stocks would be expected in each tail by chance. The
seven significant results are all on the side of below-chance accuracy, and none
remains significant once the false discovery rate is controlled.

![Directional edge per stock, sorted, against a band of two standard errors](https://arjun-quant-projects.vercel.app/figures/edge-ranked.png)

The figure above plots each stock's edge against a band of two standard errors
(±5.4 points). Sixteen stocks lie outside it, 15 above and one below. This count
should not be read as 16 discoveries. The band is centred on zero, while the
edges are centred on +1.85 points because of the weak benchmark described in
section 4.2, so the distribution is shifted towards the upper boundary. The
binomial tests above, which compare each stock's accuracy with 50%, are the
appropriate per-stock inference.

The largest and smallest edges are listed below. Four of the five largest occur
with a negative $R^2$: the model predicted the sign of the return slightly more
often than the benchmark while predicting its magnitude less accurately than a
constant.

| Rank | Ticker | Edge | Accuracy | Benchmark | $R^2$ |
|---|---|---:|---:|---:|---:|
| 1 | RPOWER | +9.5 pts | 53.9% | 44.4% | -0.072 |
| 2 | GARFIBRES | +9.0 pts | 51.5% | 42.5% | +0.014 |
| 3 | HIMATSEIDE | +8.9 pts | 52.7% | 43.8% | -0.014 |
| 4 | PAYTM | +8.9 pts | 54.2% | 45.3% | -0.084 |
| 5 | CHOLAFIN | +7.2 pts | 53.3% | 46.1% | -0.005 |
| ... | | | | | |
| 94 | NAVINFLUOR | -4.1 pts | 48.6% | 52.6% | -0.059 |
| 95 | FEDERALBNK | -4.6 pts | 47.6% | 52.2% | -0.025 |
| 96 | ALKEM | -4.6 pts | 47.1% | 51.7% | -0.012 |
| 97 | BAJAJCON | -4.9 pts | 46.4% | 51.3% | -0.068 |
| 98 | LAURUSLABS | -8.9 pts | 46.7% | 55.6% | -0.130 |

The full table is in [`results/per-stock.csv`](../results/per-stock.csv).

### 4.4 The moving-average ratio

`ma_ratio` has the largest absolute standardised coefficient for none of the 98
stocks. Its mean absolute coefficient is 0.0016, meaning that a one standard
deviation change in the ratio moves the predicted daily return by about 0.16
percentage points. The sign is positive for 61 stocks and negative for 37.

![Sign and magnitude of the ma_ratio coefficient across 98 stocks](https://arjun-quant-projects.vercel.app/figures/ma-ratio-signs.png)

If the crossing condition carried directional information common to Indian
equities, its coefficient would have the same sign for most stocks and would be
large enough to move the forecast. The sign is positive (golden-cross state
associated with a higher predicted return) for 61 of 98 stocks, and a two-sided
sign test against an even split gives p = 0.02. The majority is therefore
unlikely to be chance alone, but it does not translate into forecasting value:
the coefficients are small, they are poorly identified for the reason given
below, and the out-of-sample accuracy in sections 4.1 to 4.3 shows no benefit.

| Feature | Stocks for which it has the largest coefficient |
|---|---:|
| `ma5` | 58 |
| `ma20` | 38 |
| `ret` | 2 |
| `ma_ratio` | 0 |

These coefficients should be interpreted with care. `ma_ratio` is a deterministic
function of `ma5` and `ma20`, and the two averages are themselves highly
correlated. Under this degree of multicollinearity, OLS can assign large
offsetting coefficients to correlated regressors with little change in the
fitted values, so individual coefficients have high variance. A large `ma_ratio`
coefficient would therefore not establish that the crossing condition matters,
and a small one does not by itself establish that it does not. The conclusion of
this study rests on out-of-sample accuracy (sections 4.1 to 4.3), which is
unaffected by how the fitted values are divided among the regressors.

### 4.5 Results by market capitalisation

Momentum effects are documented to be stronger among smaller and less widely
followed stocks, so the sample was divided into three capitalisation bands.

| Band | n | Accuracy | Benchmark | Edge | Mean \|`ma_ratio`\| coefficient |
|---|---:|---:|---:|---:|---:|
| Large | 55 | 49.8% | 48.5% | +1.31 pts | 0.00162 |
| Mid | 17 | 48.9% | 47.2% | +1.68 pts | 0.00165 |
| Small | 26 | 49.8% | 46.7% | +3.09 pts | 0.00160 |

![Accuracy and edge by market-capitalisation band](https://arjun-quant-projects.vercel.app/figures/edge-by-market-cap.png)

Small capitalisation stocks have the largest mean edge, but their mean accuracy
is the same as that of large capitalisation stocks (49.8%). The difference in
edge arises entirely from a lower small-cap benchmark (46.7% against 48.5%), not
from more accurate forecasts. The dispersion of edges within each band is also
much larger than the differences between band means.

## 5. Level forecasts and the coefficient of determination

This section uses one stock, Reliance Industries, to show why the target variable
is a return. The model was estimated on 2019-07-01 to 2025-01-31 and evaluated on
the 347 trading days from 2025-02-01 to 2026-06-26. Two regressions were fitted
with identical features and the same split. One predicts the next day's closing
price and the other the next day's return. A third forecast, the random-walk
forecast $\hat P_{t+1} = P_t$, requires no estimation.

| Test-sample statistic | Price model | Random walk ($\hat P_{t+1} = P_t$) | Return model |
|---|---:|---:|---:|
| MAE | ₹18.23 | ₹13.26 | 0.0097 |
| RMSE | ₹23.70 | ₹18.08 | 0.0133 |
| $R^2$ | 0.9363 | 0.9629 | -0.0080 |
| Directional accuracy | 47.0% | 51.6% | 51.0% |

The first two columns are in rupees and comparable with each other. The return
model's errors are fractions of the price and are not comparable with them.

The price model attains an $R^2$ of 0.936, but the random walk attains 0.963 with
27% lower mean absolute error. The price model is therefore worse than the
no-change forecast on every measure in the table. Its high $R^2$ arises because
daily prices are highly autocorrelated: the denominator of $R^2$ is the variance
of the price level over the test sample, which is large relative to the size of
a single day's change. Any forecast close to the previous close attains a high
$R^2$ by this measure, whether or not it has predictive ability.

The parity plots below show the same 347 days for both models. Points on the
45-degree line are perfect forecasts.

![Parity plots for the price model and the return model](https://arjun-quant-projects.vercel.app/figures/parity-price-vs-return.png)

In the price model the points lie close to the diagonal because the prediction is
close to the previous close and prices change little from day to day. In the
return model the predictions occupy a narrow band within about half a percentage
point of zero, while realised returns range from -4.6% to +5.3%. A model with
predictive ability would produce a cloud elongated along the diagonal. A
vertical band indicates that the predictions do not vary with the outcome.

![Price model: actual and predicted close](https://arjun-quant-projects.vercel.app/figures/reliance-price-fit.png)

![Return model: actual and predicted daily return](https://arjun-quant-projects.vercel.app/figures/reliance-return-fit.png)

A near-constant return forecast is the expected outcome of least squares when the
regressors are uninformative. In that case the coefficients estimated on the
training sample are close to zero and the fitted value converges to the training
mean of the target. For a large-capitalisation stock the mean daily return is
close to zero, so the prediction is close to zero on every day.

![Residuals over the test period](https://arjun-quant-projects.vercel.app/figures/residuals.png)

Because the predictions are close to zero, the residuals are approximately equal
to the realised returns and show no structure that the model has removed.

### Coefficients

| Feature | Price model (₹ per standard deviation) | Return model (return per standard deviation) |
|---|---:|---:|
| `ma5` | +277.43 | -0.0188 |
| `ma20` | -18.10 | +0.0178 |
| `ret` | +11.70 | -0.0012 |
| `ma_ratio` | +1.89 | +0.0025 |

![Coefficients of both models on a common axis](https://arjun-quant-projects.vercel.app/figures/feature-weights.png)

The price model places almost all its weight on `ma5`, which is the feature
closest to the current price. The return model's coefficients are small, and the
two largest, on `ma5` (-0.0188) and `ma20` (+0.0178), are nearly equal and
opposite. This is the pattern multicollinearity produces when two correlated
regressors are fitted to noise: their effects offset, and the net contribution to
the forecast is close to zero.

![A two-feature slice of the fitted regression plane](https://arjun-quant-projects.vercel.app/figures/hyperplane-slice.png)

The figure above shows the fitted relationship between `ma5`, `ma20` and the
predicted return, with `ret` and `ma_ratio` held at their means. The surface is
close to flat and the realised returns lie well above and below it.

The general point is that $R^2$ measures variance explained relative to a chosen
reference forecast. For autocorrelated series such as price levels, the
appropriate reference is the random walk, not the sample mean. Evaluating the
level model against the mean produces a high $R^2$ that is consistent with no
forecasting ability.

## 6. Discussion

The results are consistent with the weak form of the efficient market hypothesis
(Fama, 1970), which states that current prices reflect the information contained
in past prices. Under this hypothesis, a rule based on past prices that reliably
preceded price increases would be traded until the associated return was
competed away.

Moving-average features are a demanding test of that hypothesis in one sense and
a lenient one in another. They are among the most widely computed technical
indicators, so any predictability they once carried is likely to have been
exploited. At the same time, the study uses only four such features, a linear
model and a single horizon, so a null result is informative about this
specification and not about technical analysis in general.

The results do not contradict the momentum literature. Jegadeesh and Titman
(1993) document that stocks with high returns over the previous 3 to 12 months
outperform those with low returns over the following months, and this effect is
measured in the cross-section of stocks over monthly horizons. This study
measures the time-series relationship between short-term moving averages and the
next day's return for each stock separately, which is a different hypothesis.
Its conclusion is limited to that hypothesis: on this universe and over this
period, the four features in a linear model do not predict next-day returns well
enough for a forecast based on them to be distinguished from one made without
them.

## 7. Limitations

- **Sample length.** Each stock has about 1,750 observations, of which about 345
  are held out. The standard error of a single stock's accuracy is therefore about
  2.7 percentage points, which is too large to detect an effect of one point or
  less at the level of an individual stock. Studies that report technical-rule
  effects typically use several decades of data.
- **Single test window.** All 98 test samples cover the same 16 months. Results
  for different stocks are therefore correlated, and a window with different
  market conditions could produce a different benchmark and a different edge.
- **Linear specification.** A relationship that operates through thresholds or
  interactions, such as a crossing that predicts returns only in low-volatility
  regimes, would not be captured by a linear model.
- **Multicollinearity.** The `ma_ratio` coefficient is poorly identified because
  the feature is a function of `ma5` and `ma20` (section 4.4).
- **Corporate actions.** Price adjustment does not correct demergers. Raymond
  (2025-05-14, -65%) and Tata Motors (2025-10-14, -40%) each show a one-day price
  fall caused by a demerger, and both fall inside the test period. The two stocks
  are retained and flagged.
- **Price returns.** Dividends are excluded, so returns are price returns and not
  total returns.
- **Transaction costs.** None are deducted. A strategy that traded on daily
  forecasts would incur brokerage, the bid-ask spread and short-term capital
  gains tax, so a small positive edge before costs would not imply a profitable
  strategy.
- **Universe.** Most of the stocks are large and mid capitalisation NSE
  constituents, which are among the most widely followed Indian equities. A null
  result is less surprising here than it would be in less liquid stocks.
- **Capitalisation labels.** Bands are assigned as of June 2021 and are not
  updated for stocks that moved between bands during the sample.

## 8. Further work

- **Longer horizons and cross-sectional tests.** Testing 3 to 12 month momentum in
  the cross-section of NSE stocks, net of costs, would address the horizon at which
  the literature finds the strongest evidence.
- **A broader small-capitalisation sample.** The 26 small-cap stocks here are too
  few to test whether predictability is concentrated among less liquid names.
- **Non-price predictors.** Earnings revisions and analyst recommendation changes
  are documented predictors that do not depend on the price history used here.
- **Non-linear models with walk-forward validation.** Tree ensembles can represent
  thresholds and interactions, but require walk-forward cross-validation to avoid
  overfitting on samples of this size.
- **A discrete crossing indicator.** Replacing `ma_ratio` with an indicator for a
  crossing in the previous $n$ days would remove its collinearity with `ma5` and
  `ma20` and test the rule in the form in which it is used.
- **Formal forecast comparison.** A Pesaran and Timmermann (1992) test of
  directional accuracy, which accounts for the base rate of up days, would replace
  the comparison with a fixed 50%.

## References

Benjamini, Y., & Hochberg, Y. (1995). Controlling the false discovery rate: A
practical and powerful approach to multiple testing. *Journal of the Royal
Statistical Society: Series B*, 57(1), 289-300.

Brock, W., Lakonishok, J., & LeBaron, B. (1992). Simple technical trading rules
and the stochastic properties of stock returns. *Journal of Finance*, 47(5),
1731-1764.

Campbell, J. Y., & Thompson, S. B. (2008). Predicting excess stock returns out of
sample: Can anything beat the historical average? *Review of Financial Studies*,
21(4), 1509-1531.

Fama, E. F. (1970). Efficient capital markets: A review of theory and empirical
work. *Journal of Finance*, 25(2), 383-417.

Jegadeesh, N., & Titman, S. (1993). Returns to buying winners and selling losers:
Implications for stock market efficiency. *Journal of Finance*, 48(1), 65-91.

Pesaran, M. H., & Timmermann, A. (1992). A simple nonparametric test of
predictive performance. *Journal of Business & Economic Statistics*, 10(4),
461-465.

Sullivan, R., Timmermann, A., & White, H. (1999). Data-snooping, technical trading
rule performance, and the bootstrap. *Journal of Finance*, 54(5), 1647-1691.

Welch, I., & Goyal, A. (2008). A comprehensive look at the empirical performance
of equity premium prediction. *Review of Financial Studies*, 21(4), 1455-1508.

## Appendix: figures

All findings figures are generated by
[`scripts/ml/06_figures.py`](../scripts/ml/06_figures.py) from the committed
results, using the shared style in [`figstyle.py`](../scripts/ml/figstyle.py).
They cannot differ from the values in the tables.

Polarity (above or below zero, positive or negative) is encoded in blue and
orange rather than green and red. Under deuteranopia, the most common form of
colour vision deficiency, the standard green and red differ by a colour distance
of about 3.5 ΔE, against 24.7 for the blue and orange used here. Every polarity
is also shown by position, so colour is never the only channel.
