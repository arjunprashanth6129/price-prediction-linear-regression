# Price prediction with a linear regression model

A test of whether moving-average features predict next-day returns for 98
NSE-listed stocks. One ordinary least squares regression is estimated per stock
on daily closes from June 2019 to June 2026, with a chronological 80/20 split and
benchmarks fixed before estimation.

**Paper (PDF):** [Do Moving-Average Signals Predict Next-Day Returns?](https://arjun-quant-projects.vercel.app/papers/moving-average-signals.pdf)
&nbsp;·&nbsp; **Interactive version:** https://arjun-quant-projects.vercel.app/linear-regression

---

## Contents

- [Summary of results](#summary-of-results)
- [Quick start](#quick-start)
- [Pipeline](#pipeline)
- [Leakage controls](#leakage-controls)
- [Selected figures](#selected-figures)
- [Outputs](#outputs)
- [Repository layout](#repository-layout)
- [Limitations](#limitations)
- [Further work](#further-work)

## Summary of results

The regressors are a 5-day moving average (`ma5`), a 20-day moving average
(`ma20`), the one-day return (`ret`) and their ratio `ma_ratio = ma5 / ma20`, which
represents the golden-cross condition as a continuous variable. The target is the
next day's return.

| Statistic (test sample, 98 stocks) | Value |
|---|---|
| Mean out-of-sample $R^2$ | -0.0155 |
| Stocks with $R^2 > 0$ | 17 |
| Mean directional accuracy | 49.6% |
| Mean always-up benchmark | 47.8% |
| Mean edge over the benchmark | +1.85 pts |
| Expected edge of a random forecast over the same benchmark | +2.22 pts |
| Stocks with accuracy significantly above 50% (binomial test, 5%) | 0 |
| Stocks with significant directional ability (Pesaran-Timmermann, 5%) | 5 of 97; 0 after a Benjamini-Hochberg correction |
| Stocks for which `ma_ratio` has the largest coefficient | 0 |

The positive edge over the always-up rule is a property of the test window, in
which up days were less frequent than down days for 73 of the 98 stocks. A
forecast with no information would have exceeded the same benchmark by more. The
results are consistent with weak-form market efficiency for these four features,
a linear model and a one-day horizon. They do not address longer horizons or other
predictors.

## Quick start

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install yfinance pandas numpy scikit-learn matplotlib
```

`scripts/ml/raw_prices.csv` is committed, so stages 2 to 6 run offline and
reproduce every published number and figure:

```bash
python3 scripts/ml/02_features.py          # features for the worked example
python3 scripts/ml/03_split.py             # chronological split and its figure
python3 scripts/ml/04_model.py             # price model, return model and random walk
python3 scripts/ml/05_generate_signals.py  # all 98 stocks; writes data/ and results/
python3 scripts/ml/06_figures.py           # every figure in docs/figures/
```

Stage 1 is the only stage that requires network access. It rebuilds the dataset
from Yahoo Finance; skip it to reproduce the published results exactly.

```bash
python3 scripts/ml/01_fetch_data.py        # -> scripts/ml/raw_prices.csv
```

To run the site locally:

```bash
npm install
npm run dev     # http://localhost:3000/linear-regression
```

The data is static and ships with the build. No API keys or environment
variables are required.

## Pipeline

```
data/universe.json                 100 NSE tickers
        |
        v
  [1] 01_fetch_data.py             yfinance, auto_adjust=True, 2019-06-01 to 2026-06-30
        |                          -> raw_prices.csv (committed)
        v
  [2] 02_features.py               ma5, ma20, ret, ma_ratio
        |                          target = next-day return
        v
  [3] 03_split.py                  first 80% of days train, last 20% test, in date order
        |
        v
  [4] 04_model.py                  worked example on Reliance: price model,
        |                          return model and the random-walk forecast
        v
  [5] 05_generate_signals.py       for each of the 98 stocks:
        |                            scaler estimated on training rows only
        |                            OLS on the next-day return
        |                            evaluation against the always-up benchmark
        |                          -> data/ml-signals.json, results/
        v
  [6] 06_figures.py                every figure, from that JSON
```

The site reads the JSON written by stages 4 and 5, and `paper/make_assets.py`
re-estimates every model, checks the result against that JSON and generates every
number, table and figure in the paper, so the paper, the figures and the site use
the same values.

## Leakage controls

**Chronological split.** A shuffled split is valid for independent observations
and invalid for a time series. It places later observations in the training
sample, and because adjacent rows share most of their inputs (`ma20` on
consecutive days shares 19 of 20 closes), it evaluates the model on near-copies
of training rows.

**Training-only standardisation.** `StandardScaler` is estimated on the training
rows and then applied to both samples. Estimating it on the full series would pass
the test sample's mean and variance into the training data.

**Backward-looking features.** All four features use closes up to and including
day $t$. Only the target uses day $t+1$.

**Benchmarks fixed in advance.** Accuracy is reported against an always-up rule
and against 50%, and $R^2$ against the test-sample mean. These were chosen before
any model was estimated.

The choice of target matters for the same reason. A model of the next day's price
reaches an $R^2$ of 0.94 on Reliance, but the random-walk forecast
$\hat P_{t+1} = P_t$ reaches 0.96 without estimation, because daily prices are
highly autocorrelated. Predicting returns removes that component. Section 5 of the
[paper](https://arjun-quant-projects.vercel.app/papers/moving-average-signals.pdf)
works through the example.

## Selected figures

Out-of-sample $R^2$ across the 98 stocks:

![Distribution of R² on next-day returns across 98 stocks](https://arjun-quant-projects.vercel.app/figures/r2-distribution.png)

The same features and test days with two different targets. The price model's
points lie on the diagonal because each forecast is close to the previous close;
the return model's forecasts do not vary with the outcome.

![Parity plots for the price model and the return model](https://arjun-quant-projects.vercel.app/figures/parity-price-vs-return.png)

The remaining figures are in [`docs/figures/`](docs/figures/), and the paper
redraws the main ones as vector figures.

## Outputs

Written by stage 5 to `results/` and `data/`:

| File | Contents |
|---|---|
| [`results/per-stock.csv`](results/per-stock.csv) | one row per stock: capitalisation band, test days, directional accuracy, benchmark, edge, $R^2$, largest coefficient, `ma_ratio` coefficient |
| [`results/full_analysis.txt`](results/full_analysis.txt) | the generated summary |
| [`results/RESULTS.md`](results/RESULTS.md) | the results tables as a standalone document |
| [`data/ml-signals.json`](data/ml-signals.json) | per-stock results as read by the site |
| [`data/ml-missing.json`](data/ml-missing.json) | the two excluded stocks (`GUJGASLTD`, `JPASSOCIAT`) and the reason |
| [`data/reliance-model-detail.json`](data/reliance-model-detail.json) | the worked example, including test-period predictions |

Stage 6 writes 13 figures to [`docs/figures/`](docs/figures/) using the shared
style in `figstyle.py`. Polarity is encoded in blue and orange, which remain
distinguishable under deuteranopia, and is also shown by position.

## Repository layout

```
scripts/ml/
  01_fetch_data.py            daily closes for the universe        (network)
  02_features.py              features for the worked example
  03_split.py                 chronological split and figure
  04_model.py                 price model, return model, random walk
  05_generate_signals.py      all 98 stocks and the full analysis
  06_figures.py               every findings figure
  figstyle.py                 figure style shared by every stage that plots
  raw_prices.csv              the dataset behind every number (committed)
data/
  universe.json               100 tickers and company names
  market-caps.json            large, mid or small band per ticker
  ml-signals.json             per-stock results
  ml-missing.json             excluded stocks and the reason
  reliance-model-detail.json  the worked example
  cvar/, pairs/               exported results of the other two projects
results/                      RESULTS.md, per-stock.csv, full_analysis.txt
docs/figures/                 every figure
paper/                        the paper: LaTeX source, PDF, and make_assets.py,
                              which generates its numbers, tables and figures
public/figures/               copies of the figures served by the site
public/papers/                PDFs of the three papers, served by the site
app/                          Next.js App Router site
  linear-regression/          this study's page
  cvar/, pairs-trading/       the other two projects' pages
  components/                 chart and layout components
lib/
  ml.ts                       typed access to this study's results
  universe.ts                 ticker to company name
  project.ts                  site metadata and the project registry
```

## Limitations

The full list is in section 7 of the
[paper](https://arjun-quant-projects.vercel.app/papers/moving-average-signals.pdf).
The most important are:

- **Statistical power.** About 345 test days per stock gives a standard error of
  2.7 percentage points on a single stock's accuracy, too large to detect an
  effect of one point.
- **One test window.** All stocks are evaluated within the same 17 months
  (February 2025 to June 2026), so their results are correlated.
- **Linear specification.** Threshold or interaction effects would not be
  detected.
- **Multicollinearity.** `ma_ratio` is a function of `ma5` and `ma20`, so its
  coefficient is poorly identified. The conclusion rests on out-of-sample
  accuracy, which is unaffected.
- **No transaction costs; price returns only.** Two demergers (Raymond, Tata
  Motors) in the test period are retained and flagged.

## Further work

- Cross-sectional momentum at 3 to 12 month horizons, net of costs.
- A larger small-capitalisation sample.
- Non-price predictors such as earnings revisions.
- Tree ensembles with walk-forward cross-validation.
- A discrete crossing indicator in place of `ma_ratio`.

## Scope

This is a student project and not investment advice. It tests whether a set of
signals carries information; it does not propose a trading strategy.

## License

MIT. See [LICENSE](LICENSE).
