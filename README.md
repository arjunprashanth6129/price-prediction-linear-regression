# Price prediction with a linear regression model

Can price momentum predict tomorrow's return? A linear regression per stock,
fitted on seven years of daily closes for 98 NSE companies, with a strict
chronological split and a benchmark chosen before any score was seen.

**Live report:** https://arjun-quant-projects.vercel.app/linear-regression
&nbsp;·&nbsp; **Full write-up:** [the wiki report](https://github.com/arjunprashanth6129/price-prediction-linear-regression/wiki/Report)

This is the first of three projects in my quant portfolio. The other two are a
[CVaR portfolio optimiser](https://github.com/arjunprashanth6129/cvar-portfolio-optimizer)
and a [pairs-trading backtester](https://github.com/arjunprashanth6129/pairs-trading-backtester).
This one is the research study: it asks whether a popular trading signal carries
any information at all, and the answer is no.

The repository also holds the Next.js site that presents all three projects. The
analysis in `scripts/ml/`, `data/` and `results/` belongs to this study. The CVaR
and pairs-trading pages are rendered from JSON vendored under `data/cvar/` and
`data/pairs/`; their analysis lives in their own repositories.

---

## Contents

- [The result in brief](#the-result-in-brief)
- [Quick start](#quick-start)
- [What the pipeline does](#what-the-pipeline-does)
- [How leakage is prevented](#how-leakage-is-prevented)
- [A look at the results](#a-look-at-the-results)
- [Outputs](#outputs)
- [Repository layout](#repository-layout)
- [Limitations](#limitations)
- [Extending it](#extending-it)

## The result in brief

Four features built from price alone (`ma5`, `ma20`, `ret` and `ma_ratio`, which
encodes the golden and death cross as one number) were used to predict the next
day's return for each stock. The model did not beat the benchmark in any way that
matters.

| Metric | Value |
|---|---|
| Stocks modelled | 98 of 100 |
| Average R² on next-day returns | -0.0155 |
| Average directional accuracy | 49.6% |
| Average always-up baseline | 47.8% |
| Average edge over baseline | +1.85 pts |
| Stocks outside the ±5.4-pt noise band | 16 of 98 |
| Stocks where the golden cross ratio had the largest weight | 0 of 98 |

The edge is positive only because the always-up baseline was weak over this
window. An edge earned from below a coin flip reflects an easy benchmark, not a
good model. The claim is deliberately narrow: these four features, in a linear model,
at a one-day horizon, on this universe, carry nothing a retail investor could act
on. It is consistent with the weak form of the efficient market hypothesis, and
it says nothing about longer horizons or other signals.

## Quick start

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install yfinance pandas numpy scikit-learn matplotlib
```

`scripts/ml/raw_prices.csv` is committed, so stages 2 to 6 run offline and
reproduce every published number and figure:

```bash
python3 scripts/ml/02_features.py          # features for the worked example
python3 scripts/ml/03_split.py             # the chronological split, plus its figure
python3 scripts/ml/04_model.py             # price vs return vs naive, worked example
python3 scripts/ml/05_generate_signals.py  # all 98 stocks, writes data/ and results/
python3 scripts/ml/06_figures.py           # every figure in docs/figures/
```

Stage 1 is the only one that touches the network. Skip it to reproduce the
published results exactly, or run it to rebuild the dataset from Yahoo:

```bash
python3 scripts/ml/01_fetch_data.py        # -> scripts/ml/raw_prices.csv
```

To run the site locally:

```bash
npm install
npm run dev     # http://localhost:3000/linear-regression
```

There are no API keys and no environment variables. The data is static and ships
with the build.

## What the pipeline does

```
data/universe.json                 100 NSE tickers
        |
        v
  [1] 01_fetch_data.py             yfinance, auto_adjust=True, 2019-06-01 to 2026-06-30
        |                          -> raw_prices.csv (committed)
        v
  [2] 02_features.py               ma5, ma20, ret, ma_ratio
        |                          target = tomorrow's return
        v
  [3] 03_split.py                  first 80% of days train, last 20% test, in date order
        |
        v
  [4] 04_model.py                  worked example on Reliance:
        |                          price model vs return model vs "tomorrow = today"
        v
  [5] 05_generate_signals.py       for each of the 98 stocks:
        |                            scaler fitted on train rows only
        |                            LinearRegression on the return
        |                            score against the always-up baseline
        |                          -> data/ml-signals.json, results/
        v
  [6] 06_figures.py                every figure, regenerated from that JSON
```

The website reads the same JSON that stages 4 and 5 write, so the report and the
site can't disagree. Every number in `results/full_analysis.txt` is computed, not
typed in.

## How leakage is prevented

A model that sees the future fails quietly: it posts better numbers, not an
error. Four choices keep it out.

**The split is chronological.** `train_test_split(shuffle=True)` is right for
independent samples and wrong for a time series, for two reasons. It puts 2026
days in the training set and 2024 days in the test set, so the model studies the
future and is scored on the past. And neighbouring rows are near-duplicates: the
20-day average on Tuesday and Wednesday share 19 of 20 inputs, so a shuffled
split scores the model on rows it has effectively seen.

**The scaler is fitted on training rows only.** Fitting `StandardScaler` on the
whole dataset would carry the test period's mean and spread into the training
transform. It's the same leak, just harder to see.

**Features only look backwards.** All four use closes up to and including today.
Only the target looks forward.

**The benchmark was chosen before the score.** Every result is read against an
always-guess-up baseline, not against zero. In a flat market "up" is an easy
benchmark to clear, and reading accuracy without it is how a 52% model gets
mistaken for a good one.

The choice of target matters just as much. Predicting tomorrow's *price* gives an
R² of 0.94 on Reliance, and guessing "tomorrow = today" scores 0.96 with no model
at all. That high R² comes from prices barely moving overnight, so the study
predicts returns instead. The [wiki report](https://github.com/arjunprashanth6129/price-prediction-linear-regression/wiki/Report#5-worked-example-the-r-trap)
walks through this in full.

## A look at the results

R² on next-day returns, one bar per bucket of stocks. Nothing sits meaningfully
above zero:

![Distribution of R² on next-day returns across 98 stocks](https://raw.githubusercontent.com/arjunprashanth6129/price-prediction-linear-regression/main/docs/figures/r2-distribution.png)

The same model, features and days, asked two different questions. On the left it
predicts the price and looks near-perfect; on the right it predicts the return and
shows no skill at all:

![Parity plots for the price model and the return model](https://raw.githubusercontent.com/arjunprashanth6129/price-prediction-linear-regression/main/docs/figures/parity-price-vs-return.png)

The remaining figures, per-stock edge against its noise band, the `ma_ratio`
coefficients, the market-cap split and the residuals, are in
[`docs/figures/`](docs/figures/) and in the
[wiki report](https://github.com/arjunprashanth6129/price-prediction-linear-regression/wiki/Report).

## Outputs

Written by stage 5 to `results/` and `data/`:

| File | Contents |
|---|---|
| [`results/per-stock.csv`](results/per-stock.csv) | all 98 stocks: market-cap band, test days, directional accuracy, baseline, edge, R², top feature, `ma_ratio` weight |
| [`results/full_analysis.txt`](results/full_analysis.txt) | the printed summary, every figure computed |
| [`results/RESULTS.md`](results/RESULTS.md) | the findings as a standalone document |
| [`data/ml-signals.json`](data/ml-signals.json) | per-stock results as the site reads them |
| [`data/ml-missing.json`](data/ml-missing.json) | the two excluded stocks (`GUJGASLTD`, `JPASSOCIAT`) and why |
| [`data/reliance-model-detail.json`](data/reliance-model-detail.json) | the worked example in full, including test-period predictions |

And to [`docs/figures/`](docs/figures/): 13 figures. The findings figures are
drawn by `06_figures.py` in the shared style from `figstyle.py`. They use blue
and orange instead of green and red, because green and red are close to
indistinguishable under deuteranopia, and every polarity is also encoded by
position.

## Repository layout

```
scripts/ml/
  01_fetch_data.py            daily closes for the universe        (network)
  02_features.py              features for the worked example
  03_split.py                 chronological split + figure
  04_model.py                 price vs return vs naive comparison
  05_generate_signals.py      all 98 stocks + the full analysis
  06_figures.py               every findings figure
  figstyle.py                 one figure style shared by every stage that plots
  raw_prices.csv              the exact dataset behind every number (committed)
data/
  universe.json               100 tickers -> company names
  market-caps.json            large / mid / small band per ticker
  ml-signals.json             per-stock results
  ml-missing.json             excluded stocks and why
  reliance-model-detail.json  the worked example
  cvar/, pairs/               vendored output of the other two projects
results/                      RESULTS.md, per-stock.csv, full_analysis.txt
docs/figures/                 every figure
app/                          Next.js App Router site
  linear-regression/          this study's page
  cvar/, pairs-trading/       the other two projects' pages
  components/                 Charts, CrossDiagram, Hyperplane3D, Sidebar, TopBar, ...
lib/
  ml.ts                       typed access to this study's results
  universe.ts                 ticker -> company name
  project.ts                  site metadata and the project registry
```

## Limitations

The full list is in the [wiki report](https://github.com/arjunprashanth6129/price-prediction-linear-regression/wiki/Report#7-limitations).
The ones that matter most:

- **Seven years is short.** Published momentum research runs on decades. This
  window can show a signal isn't obviously there, not rule out a small, slow one.
- **Linear only.** A golden cross that matters only under certain conditions
  would look like a null to a straight-line fit.
- **No transaction costs, price returns only.** Costs would make a daily-signal
  strategy worse, so breaking even here would still lose money in practice.
- **Two uncorrected demergers** (Raymond and Tata Motors) fall inside the test
  period. They're flagged, not patched.
- **`ma_ratio` is collinear with `ma5` and `ma20`**, so its individual coefficient
  is unstable. The accuracy-against-baseline result doesn't depend on it.

## Extending it

In the order I'd do them:

- **A longer horizon.** One day is the hardest version of the problem. Three- to
  twelve-month momentum is one of the better-replicated results in finance, and
  testing it here after costs would be a better use of the same setup.
- **A real small-cap universe.** 26 small caps is thin, and the documented premium
  sits in smaller, less liquid names than most of these.
- **Fundamental momentum.** Earnings revisions and analyst upgrades don't depend
  on price, so they'd test the same question without reusing a price history that
  has already come up empty.
- **Tree ensembles, with walk-forward cross-validation.** A flexible model on
  1,750 rows will memorise noise and report a great score unless it's validated
  properly.
- **Replace `ma_ratio` with a cross event flag.** A binary "crossed in the last n
  days" feature would test the indicator the way traders actually use it.

## A note on scope

This is a student project. It isn't investment advice, and the results should be
read as a study of whether a signal carries information, not as a strategy to
run.

## License

MIT. See [LICENSE](LICENSE).
