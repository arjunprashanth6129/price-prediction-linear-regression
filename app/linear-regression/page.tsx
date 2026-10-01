import TopBar from "../components/TopBar";
import { Reveal, CountUp } from "../components/Motion";
import { Section, Sub, V, C, StatCard, Note, Table, TH, Bullets } from "../components/Page";
import CrossDiagram from "../components/CrossDiagram";
import Hyperplane3D from "../components/Hyperplane3D";
import {
  AccuracyScatter,
  CapBreakdown,
  EdgeRanked,
  MaRatioSigns,
  ParityScatter,
  PriceFit,
  R2Histogram,
  ResidualPlot,
  ReturnFit,
  WeightBars,
  type CapRow,
  type EdgeBar,
  type R2Bucket,
  type ScatterPoint,
  type WeightBar,
} from "../components/Charts";
import { PROJECTS } from "@/lib/project";
import { companyName } from "@/lib/universe";
import {
  getAllMlSignals,
  getMlSummary,
  getWorkedExample,
  directionalStandardError,
  type ModelScore,
} from "@/lib/ml";

const META = PROJECTS[0];

export const metadata = { title: META.name, description: META.blurb };

const SECTIONS = [
  { id: "question", label: "Research question" },
  { id: "method", label: "Data and method" },
  { id: "findings", label: "Results" },
  { id: "size", label: "By market cap" },
  { id: "worked", label: "Level forecasts and R²" },
  { id: "emh", label: "Discussion" },
  { id: "meaning", label: "Scope" },
  { id: "why", label: "Motivation" },
  { id: "limits", label: "Limitations" },
];

export default function LinearRegressionStudy() {
  const s = getMlSummary();
  const all = getAllMlSignals();
  const ex = getWorkedExample();
  const entries = Object.entries(all);

  const pctf = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
  const signed = (x: number, d = 1) =>
    `${x >= 0 ? "+" : ""}${(x * 100).toFixed(d)}%`;

  // ---- R2 buckets. Tight boundaries, because the data is tight: every R2
  // here falls between -0.13 and +0.05, so wider buckets leave three empty.
  const BUCKETS = [
    "Below -0.05",
    "-0.05 to -0.02",
    "-0.02 to -0.01",
    "-0.01 to 0",
    "Above 0",
  ] as const;
  const bucketOf = (r2: number) =>
    r2 < -0.05 ? BUCKETS[0]
      : r2 < -0.02 ? BUCKETS[1]
        : r2 < -0.01 ? BUCKETS[2]
          : r2 < 0 ? BUCKETS[3] : BUCKETS[4];
  const r2Data: R2Bucket[] = BUCKETS.map((bucket) => ({
    bucket,
    count: entries.filter(([, r]) => bucketOf(r.r2Return) === bucket).length,
    positive: bucket === "Above 0",
  }));
  const r2AboveZero = entries.filter(([, r]) => r.r2Return > 0).length;
  const r2Values = entries.map(([, r]) => r.r2Return);

  const scatter: ScatterPoint[] = entries.map(([id, r]) => ({
    ticker: id,
    name: companyName(id),
    naive: r.naiveBaseline * 100,
    model: r.dirAccuracy * 100,
    edge: r.mlEdge * 100,
    r2: r.r2Return,
    maRatioWeight: r.maRatioWeight,
    topFeature: r.topFeature,
    beats: r.dirAccuracy > r.naiveBaseline,
  }));
  const beats = scatter.filter((p) => p.beats).length;

  const edgeData: EdgeBar[] = entries
    .map(([id, r]) => ({ ticker: id, edge: r.mlEdge * 100 }))
    .sort((a, b) => a.edge - b.edge)
    .map((d, i) => ({ ...d, rank: i + 1 }));
  const negativeEdge = edgeData.filter((d) => d.edge <= 0).length;
  const se = directionalStandardError(s.avgTestDays);
  const band = 2 * se * 100;
  const outsideBand = edgeData.filter((d) => Math.abs(d.edge) > band).length;

  const capRows: CapRow[] = s.byCap.map((g) => ({
    category: g.category,
    n: g.n,
    accuracy: g.avgDirAccuracy * 100,
    baseline: (g.avgDirAccuracy - g.avgEdge) * 100,
    edge: g.avgEdge * 100,
  }));
  const large = s.byCap.find((g) => g.category === "Large");
  const small = s.byCap.find((g) => g.category === "Small");

  // ---- worked example ----
  const FEATS = ["ma5", "ma20", "ret", "ma_ratio"];
  const weightBars = (m: ModelScore): WeightBar[] =>
    FEATS.map((f) => ({ feature: f, value: m.featureWeights?.[f] ?? 0 }));
  const priceBars = weightBars(ex.priceModel);
  const returnBars = weightBars(ex.returnModel);
  const weightMax =
    Math.ceil(Math.max(...priceBars.map((b) => Math.abs(b.value))) / 50) * 50;
  const weightDomain: [number, number] = [-weightMax, weightMax];
  const heaviestPriceFeature = priceBars.reduce((a, b) =>
    Math.abs(b.value) > Math.abs(a.value) ? b : a,
  ).feature;

  const priceRows = ex.priceModel.testPeriodData;
  const priceVals = priceRows.flatMap((r) => [r.actual, r.predicted]);
  const priceLo = Math.floor(Math.min(...priceVals) / 25) * 25;
  const priceHi = Math.ceil(Math.max(...priceVals) / 25) * 25;
  const priceParity = priceRows.map((r) => ({
    date: r.date, predicted: r.predicted, actual: r.actual,
  }));

  const returnRows = ex.returnModel.testPeriodData;
  const returnVals = returnRows.flatMap((r) => [
    r.actualReturn * 100, r.predictedReturn * 100,
  ]);
  const returnBound = Math.ceil(Math.max(...returnVals.map(Math.abs)));
  const returnParity = returnRows.map((r) => ({
    date: r.date,
    predicted: r.predictedReturn * 100,
    actual: r.actualReturn * 100,
  }));
  const residuals = returnRows.map((r, i) => ({
    date: r.date, residual: r.residual * 100, t: i,
  }));
  const actualPct = returnRows.map((r) => r.actualReturn * 100);
  const predPct = returnRows.map((r) => r.predictedReturn * 100);
  const actualLo = Math.min(...actualPct);
  const actualHi = Math.max(...actualPct);
  const predBand = Math.max(...predPct.map(Math.abs));
  const meanClose = ex.priceModel.meanTestClose ?? 0;
  const meanAbsMove =
    returnRows.reduce((a, r) => a + Math.abs(r.actualReturn), 0) /
    (returnRows.length || 1);
  const testDays = ex.metrics.testDays;


  // A forecast with no information is right half the time whatever the
  // benchmark, so its expected edge over the always-up rule is 0.5 minus it.
  const randomEdge =
    entries.reduce((a, [, r]) => a + (0.5 - r.naiveBaseline), 0) / entries.length;
  const weakBenchmark = entries.filter(([, r]) => r.naiveBaseline < 0.5).length;
  // Two-sided binomial test of accuracy against 50%, by the normal
  // approximation with a continuity correction. On this data it gives the same
  // counts as the exact test.
  const sig = entries.map(([, r]) => {
    const k = Math.round(r.dirAccuracy * r.testDays);
    const z = (Math.abs(k - r.testDays / 2) - 0.5) / Math.sqrt(r.testDays / 4);
    return { above: k > r.testDays / 2, significant: z > 1.959964 };
  });
  const sigAbove = sig.filter((x) => x.significant && x.above).length;
  const sigBelow = sig.filter((x) => x.significant && !x.above).length;
  const r2Negative = entries.filter(([, r]) => r.r2Return < 0).length;

  return (
    <>
      <TopBar
        eyebrow="Study 01"
        title="Price prediction with a linear regression model"
        sections={SECTIONS}
        repo={META.repo}
      />

      <main id="top" className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8">
        {/* ---------------- hero ---------------- */}
        <Reveal>
          <header>
            <p className="eyebrow">Research</p>
            <h1 className="mt-2 text-[34px] font-semibold leading-[1.1] tracking-tight text-ink sm:text-[44px]">
              Do moving-average features predict next-day returns?
            </h1>
            <p className="mt-5 text-[17.5px] leading-[1.7] text-ink-muted">
              A linear regression for each of {s.total} NSE stocks, evaluated
              out of sample against benchmarks that use no model.
            </p>

            <div className="mt-7 rounded-xl border-l-2 border-accent bg-surface px-6 py-5">
              <p className="eyebrow">Abstract</p>
              <p className="mt-3 text-[14.5px] leading-[1.8] text-ink-muted">
                This study tests whether four price-derived features predict the
                next-day return of individual Indian equities: a 5-day and a
                20-day moving average, the one-day return, and the ratio of the
                two averages, which expresses the golden-cross condition as a
                continuous variable. An ordinary least squares regression is
                estimated separately for each of {s.total} NSE stocks on daily
                closes from June 2019 to June 2026, with the final 20% of each
                series held out. Out of sample, the mean coefficient of
                determination is <V>{s.avgR2.toFixed(4)}</V> and mean directional
                accuracy is <V>{pctf(s.avgDirAccuracy)}</V>. No stock&apos;s
                accuracy is significantly above 50%. The model exceeds an
                always-up benchmark by <V>{signed(s.avgEdge, 2)}</V> on average,
                but a forecast with no information would have exceeded the same
                benchmark by {signed(randomEdge, 1)}, because up days were scarce
                in the test window. The moving-average ratio is the largest
                coefficient for {s.maRatioTopFeature} of {s.total} stocks. The
                results are consistent with weak-form market efficiency for this
                feature set, model and horizon.
              </p>
            </div>
          </header>
        </Reveal>

        <Reveal delay={60}>
          <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              value={<CountUp value={s.avgDirAccuracy * 100} decimals={1} suffix="%" />}
              label="Directional accuracy"
              detail={`Mean across ${s.total} stocks. ${sigAbove} are significantly above 50%.`}
            />
            <StatCard
              value={<CountUp value={s.avgR2} decimals={4} />}
              label="Out-of-sample R²"
              detail={`Mean across stocks. ${r2Negative} of ${s.total} are below zero.`}
            />
            <StatCard
              value={<CountUp value={s.avgEdge * 100} decimals={2} prefix="+" suffix="%" />}
              label="Edge over always-up"
              detail={`A random forecast would have scored ${signed(randomEdge, 1)} against the same benchmark.`}
              tone="accent"
            />
            <StatCard
              value={`${s.maRatioTopFeature} of ${s.total}`}
              label="Golden-cross ratio largest"
              detail="Stocks for which ma_ratio had the largest coefficient."
            />
          </div>
        </Reveal>

        {/* ---------------- 01 question ---------------- */}
        <Section id="question" index={1} title="Research question">
          <p>
            Technical analysis assumes that the recent path of a price contains
            information about its next move, and moving-average rules are its
            most common form. Brock, Lakonishok and LeBaron (1992) found that such
            rules earned returns on the Dow Jones index from 1897 to 1986 that
            standard null models could not explain. Sullivan, Timmermann and White
            (1999) showed that, after correcting for data snooping, the best rule
            did not repeat its performance in the following decade.
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            <Reveal><CrossDiagram /></Reveal>
            <div className="space-y-4">
              <p>
                The figure shows the rule under test, drawn from real closes. A
                golden cross occurs when a short moving average rises above a long
                one and is read as a buy signal. The reverse crossing, the death
                cross, is read as a sell signal.
              </p>
              <p>
                The question is whether a linear model given only four standard
                technical features predicts the sign and size of the next
                day&apos;s return more accurately than benchmarks that use no
                model. The null hypothesis is that the features carry no
                information about that return.
              </p>
              <p>
                The test covers {s.total} NSE stocks over seven years, with a
                chronological split so that every evaluation day comes after every
                training day. The method was not changed after the results were
                seen.
              </p>
            </div>
          </div>
          <Note>
            The benchmarks and metrics were fixed before any model was estimated.
            Section 5 shows how much the conclusion depends on that choice.
          </Note>
        </Section>

        {/* ---------------- 02 method ---------------- */}
        <Section id="method" index={2} title="Data and method">
          <p>
            One ordinary least squares regression is estimated for each stock
            with scikit-learn. A linear specification has five parameters per
            stock, which limits overfitting on roughly 1,400 training
            observations, and its coefficients can be read directly.
          </p>

          <Sub>Features</Sub>
          <p>
            All four features use closes up to and including day t. Only the
            target uses day t+1.
          </p>
          <Table
            minWidth={560}
            head={
              <thead className="bg-surface-2">
                <tr className="border-b border-line">
                  <TH align="left">Feature</TH>
                  <TH align="left">Definition</TH>
                  <TH align="left">Interpretation</TH>
                </tr>
              </thead>
            }
          >
            <tbody>
              {[
                ["ma5", "5-day rolling mean of close", "short-term price level"],
                ["ma20", "20-day rolling mean of close", "medium-term price level"],
                ["ret", "close(t) / close(t-1) - 1", "one-day return"],
                ["ma_ratio", "ma5 / ma20", "moving-average crossing condition"],
              ].map(([f, d, e]) => (
                <tr key={f} className="border-b border-line/70 last:border-b-0">
                  <th scope="row" className="px-3 py-3 text-left">
                    <C>{f}</C>
                  </th>
                  <td className="px-3 py-3 font-mono text-[12.5px] text-ink-muted">{d}</td>
                  <td className="px-3 py-3 text-[13.5px] text-ink-muted">{e}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p>
            <C>ma_ratio</C> is above 1 when the short average is above the long
            one (the golden-cross state) and below 1 in the death-cross state, and
            its distance from 1 measures how far apart the averages are. As a
            continuous variable it can be given a regression coefficient, which a
            binary crossing indicator that fires a few times a year could not
            support. Features are standardised, so each coefficient is the change
            in predicted return for a one standard deviation change in the
            feature.
          </p>

          <Sub>Target</Sub>
          <p>
            The target is the next day&apos;s return, not its price. Daily prices
            are highly autocorrelated, so any forecast close to the previous close
            attains a high R² against the sample mean. On Reliance, a price model
            scores <V>{ex.priceModel.r2.toFixed(2)}</V> and the random-walk
            forecast (tomorrow&apos;s close equals today&apos;s) scores{" "}
            <V>{ex.naiveModel.r2.toFixed(2)}</V> with no estimation. A return
            target removes that component. Section 5 works through the example.
          </p>

          <Sub>Sample split</Sub>
          <p>
            The first 80% of each stock&apos;s observations form the training
            sample and the last 20% the test sample, in date order.
          </p>
          <div className="overflow-x-auto rounded-lg border border-line bg-surface-2 px-4 py-3 font-mono text-[12px] text-ink-muted">
            [&lt;-- TRAIN 80% (Jun 2019 to Jan 2025) --|-- TEST 20% (Feb 2025 to
            Jun 2026) --&gt;]
          </div>
          <p>
            A shuffled split (<C>train_test_split(shuffle=True)</C>) would be
            invalid for two reasons. It would place later observations in the
            training sample and evaluate on earlier ones. And because adjacent
            rows share most of their inputs (<C>ma20</C> on consecutive days is
            computed from 19 common closes), it would evaluate the model on rows
            that are close to copies of training rows, which overstates
            accuracy.
          </p>
          <p>
            <C>StandardScaler</C> is estimated on the training rows only and then
            applied to both samples. Estimating it on the full series would pass
            the test sample&apos;s mean and variance into the training data.
          </p>

          <Sub>Evaluation</Sub>
          <p>
            Three statistics are computed on each test sample. R² uses
            scikit-learn&apos;s <C>r2_score</C>, which compares the model with a
            constant forecast equal to the test-sample mean; a negative value
            means the model&apos;s squared error is larger. Directional accuracy
            is the share of days on which the predicted and realised returns have
            the same sign. The edge is directional accuracy minus the share of up
            days, which is the accuracy of a rule that always predicts a rise.
            Each stock&apos;s accuracy is also tested against 50% with a two-sided
            binomial test.
          </p>

          <Sub>The fitted surface</Sub>
          <p>
            With two features, a linear regression is a plane: for each pair of
            inputs it gives a predicted return, and the vertical distance from each
            observation to the plane is the error that least squares minimises.
            The figure below is a two-feature slice of the actual four-feature
            model for Reliance, with <C>ret</C> and <C>ma_ratio</C> held at their
            means. It can be rotated.
          </p>
          <Reveal>
            <div className="rounded-xl border border-line bg-surface p-3">
              <Hyperplane3D
                data={ex.returnModel.testPeriodData}
                weights={{
                  ma5: ex.returnModel.featureWeights?.ma5 ?? 0,
                  ma20: ex.returnModel.featureWeights?.ma20 ?? 0,
                  bias: ex.returnModel.featureWeights?.bias ?? 0,
                }}
              />
              <p className="mt-3 text-[12px] leading-relaxed text-ink-dim">
                The plane is the predicted next-day return for each combination of
                the two moving averages; the points are realised returns on test
                days. The plane is close to flat and the points lie well above and
                below it. A model with predictive ability would have a visible
                slope with the points close to it.
              </p>
            </div>
          </Reveal>
        </Section>

        {/* ---------------- 03 findings ---------------- */}
        <Section id="findings" index={3} title="Results">
          <Sub>Explained variance</Sub>
          <p>
            The mean out-of-sample R² across {s.total} stocks is{" "}
            <V>{s.avgR2.toFixed(4)}</V>, and {r2Negative} stocks have a negative
            value. For the typical stock, the fitted model forecasts next-day
            returns less accurately than a constant equal to the test-period mean.
          </p>
          <R2Histogram data={r2Data} aboveZero={r2AboveZero} total={s.total} />
          <p>
            All values lie between {Math.min(...r2Values).toFixed(2)} and{" "}
            {Math.max(...r2Values).toFixed(2)}. The {r2AboveZero} positive values
            are all small, and there is no group of stocks on which the model
            performs well. This is the expected outcome when regressors carry no
            information: coefficients estimated on noise in the training sample do
            not carry over to the test sample.
          </p>

          <Sub>Directional accuracy</Sub>
          <p>
            Mean directional accuracy is <V>{pctf(s.avgDirAccuracy)}</V>. The
            model exceeds the always-up benchmark for {s.positiveEdge} of{" "}
            {s.total} stocks, by {signed(s.avgEdge, 2)} on average.
          </p>
          <AccuracyScatter data={scatter} above={beats} below={s.total - beats} />
          <p>
            The positive edge reflects the benchmark, not the model. Up days were
            less frequent than down days for {weakBenchmark} of the {s.total}{" "}
            stocks in the test window, so the always-up rule averaged only{" "}
            {pctf(s.avgNaive)}. A forecast with no information is right 50% of
            the time on average, so its expected edge over this benchmark is{" "}
            <V>{signed(randomEdge, 1)}</V>, more than the model achieved.
          </p>

          <Sub>Statistical significance</Sub>
          <p>
            With about {Math.round(s.avgTestDays)} test days per stock, the
            standard error of a single stock&apos;s accuracy under the null of 50%
            is about {pctf(se)}. In a two-sided binomial test at the 5% level,{" "}
            <V>{sigAbove}</V> stocks are significantly above 50% and {sigBelow}{" "}
            are significantly below. About 2.5 would be expected in each tail by
            chance, and none of the {sigBelow} remains significant after a
            Benjamini-Hochberg correction for {s.total} tests.
          </p>
          <EdgeRanked
            data={edgeData}
            negative={negativeEdge}
            total={s.total}
            avgTestDays={Math.round(s.avgTestDays)}
            noiseBand={band}
          />
          <p>
            {outsideBand} of {s.total} edges lie outside a band of two standard
            errors around zero. This count overstates the evidence, because the
            band is centred on zero while the edges are centred on{" "}
            {signed(s.avgEdge, 2)} for the reason given above. Several of the
            largest edges also have a clearly negative R²: those models predicted
            the sign slightly better than the benchmark while predicting the size
            of the move worse than a constant.
          </p>

          <Sub>The moving-average ratio</Sub>
          <p>
            <C>ma_ratio</C> has the largest standardised coefficient for{" "}
            <V>{s.maRatioTopFeature} of {s.total}</V> stocks. Its mean absolute
            coefficient is {s.avgAbsMaRatioWeight.toFixed(4)}, so a one standard
            deviation change in the ratio moves the predicted daily return by
            about {(s.avgAbsMaRatioWeight * 100).toFixed(2)} percentage points. The
            sign is positive for {s.maRatioPositive} stocks and negative for{" "}
            {s.maRatioNegative}.
          </p>
          <MaRatioSigns
            positive={s.maRatioPositive}
            negative={s.maRatioNegative}
            total={s.total}
          />
          <p>
            A sign test against an even split gives p = 0.02, so the positive
            majority is unlikely to be chance alone. It does not translate into
            forecasting value: the coefficients are small and, as explained
            below, poorly identified, and the out-of-sample accuracy shows no
            benefit.
          </p>
          <p className="text-[14.5px]">
            <C>ma_ratio</C> is a deterministic function of <C>ma5</C> and{" "}
            <C>ma20</C>, which are themselves highly correlated. Under this degree
            of multicollinearity, least squares can assign large offsetting
            coefficients to correlated regressors with little change in the
            fitted values, so individual coefficients have high variance. The
            conclusion therefore rests on out-of-sample accuracy, which does not
            depend on how the fitted values are divided among the regressors.
          </p>
        </Section>

        {/* ---------------- 04 size ---------------- */}
        <Section id="size" index={4} title="Results by market capitalisation">
          <p>
            Momentum effects are documented to be stronger among smaller and less
            widely followed stocks. The {s.total} stocks were therefore divided
            into three capitalisation bands, assigned as of June 2021, and scored
            separately.
          </p>
          <CapBreakdown data={capRows} />
          {large && small && (
            <p>
              Small-cap stocks ({small.n}) have the largest mean edge,{" "}
              {signed(small.avgEdge, 2)} against {signed(large.avgEdge, 2)} for
              large caps ({large.n}). Their mean accuracy, however, is{" "}
              {pctf(small.avgDirAccuracy)} against {pctf(large.avgDirAccuracy)}.
              The difference in edge arises from a lower small-cap benchmark, not
              from more accurate forecasts, and the dispersion within each band is
              larger than the differences between bands.
            </p>
          )}
        </Section>

        {/* ---------------- 05 worked ---------------- */}
        <Section id="worked" index={5} title="Level forecasts and the coefficient of determination">
          <p>
            This section uses Reliance Industries to show why the target is a
            return. The model was estimated on{" "}
            <span className="whitespace-nowrap">{ex.trainDateRange.start}</span>{" "}
            to <span className="whitespace-nowrap">{ex.trainDateRange.end}</span>{" "}
            and evaluated on the {testDays} trading days from{" "}
            <span className="whitespace-nowrap">{ex.testDateRange.start}</span>{" "}
            to <span className="whitespace-nowrap">{ex.testDateRange.end}</span>.
            Two regressions were fitted with identical features and the same
            split, one predicting the next day&apos;s closing price and one its
            return. A third forecast, the random walk, sets tomorrow&apos;s close
            equal to today&apos;s and requires no estimation.
          </p>

          <Table
            minWidth={560}
            head={
              <thead className="bg-surface-2">
                <tr className="border-b border-line text-right">
                  <TH align="left">Test-sample statistic</TH>
                  <TH>Price model</TH>
                  <TH>Random walk</TH>
                  <TH>Return model</TH>
                </tr>
              </thead>
            }
            caption={
              <>
                MAE and RMSE in the first two columns are in rupees and comparable
                with each other. The return model&apos;s errors are fractions of
                the price, so only its R² and directional accuracy are comparable
                across columns.
              </>
            }
          >
            <tbody className="tnum">
              {[
                ["MAE", `₹${ex.priceModel.mae.toFixed(2)}`, `₹${ex.naiveModel.mae.toFixed(2)}`, ex.returnModel.mae.toFixed(4)],
                ["RMSE", `₹${ex.priceModel.rmse.toFixed(2)}`, `₹${ex.naiveModel.rmse.toFixed(2)}`, ex.returnModel.rmse.toFixed(4)],
                ["R²", ex.priceModel.r2.toFixed(4), ex.naiveModel.r2.toFixed(4), ex.returnModel.r2.toFixed(4)],
                ["Directional accuracy", pctf(ex.priceModel.dirAccuracy), pctf(ex.naiveModel.dirAccuracy), pctf(ex.returnModel.dirAccuracy)],
              ].map(([label, a, b, c]) => (
                <tr key={label} className="border-b border-line/70 text-right last:border-b-0">
                  <th scope="row" className="px-3 py-3 text-left text-[13px] font-medium text-ink-muted">
                    {label}
                  </th>
                  <td className="px-3 py-3 text-ink">{a}</td>
                  <td className="px-3 py-3 font-semibold text-accent">{b}</td>
                  <td className="px-3 py-3 text-ink">{c}</td>
                </tr>
              ))}
            </tbody>
          </Table>

          <p>
            The price model attains an R² of <V>{ex.priceModel.r2.toFixed(4)}</V>,
            but the random walk attains <V>{ex.naiveModel.r2.toFixed(4)}</V> with
            a mean absolute error of ₹{ex.naiveModel.mae.toFixed(2)} against ₹
            {ex.priceModel.mae.toFixed(2)}, about{" "}
            {Math.round((1 - ex.naiveModel.mae / ex.priceModel.mae) * 100)}% lower.
            The price model is worse than the no-change forecast on every measure
            in the table.
          </p>
          <Note>
            The denominator of R² is the variance of the target over the test
            sample. For a price level that variance is large relative to a single
            day&apos;s change, so a forecast close to the previous close attains a
            high R² whether or not it has predictive ability. For autocorrelated
            series the appropriate reference forecast is the random walk, not the
            sample mean.
          </Note>

          <PriceFit
            data={ex.pricePeriodData}
            span={`${ex.testDateRange.start} to ${ex.testDateRange.end}`}
          />

          <Sub>Predicted against realised values</Sub>
          <p>
            A parity plot places each forecast against the realised value; points
            on the 45-degree line are perfect forecasts. Both plots below use the
            same {testDays} days, features and estimator. Only the target differs.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <ParityScatter
              title="Price model"
              data={priceParity}
              domain={[priceLo, priceHi]}
              unit="rupees"
              caption={
                <>
                  Points lie close to the diagonal because each forecast is close
                  to the previous close and the price changes little from one day
                  to the next. The fit reflects autocorrelation in the price level.
                </>
              }
            />
            <ParityScatter
              title="Return model"
              data={returnParity}
              domain={[-returnBound, returnBound]}
              unit="percent"
              caption={
                <>
                  Forecasts occupy a narrow vertical band near zero while realised
                  returns span the full range. A model with predictive ability
                  would produce a cloud elongated along the diagonal.
                </>
              }
            />
          </div>

          <ResidualPlot
            data={residuals}
            span={`${ex.testDateRange.start} to ${ex.testDateRange.end}`}
          />
          <p>
            Because the return forecasts are close to zero, the residuals are
            approximately equal to the realised returns and show no structure
            that the model has removed.
          </p>

          <ReturnFit
            data={ex.returnModel.testPeriodData ?? []}
            span={`${ex.testDateRange.start} to ${ex.testDateRange.end}`}
          />
          <p>
            The price chart plots a level. The mean test-period close is about ₹
            {Math.round(meanClose).toLocaleString("en-IN")}, while the mean
            absolute daily change is about ₹
            {Math.round(meanClose * meanAbsMove)}, so a forecast that repeats the
            previous close tracks the series closely. The return chart removes
            the level. Realised returns range from {actualLo.toFixed(1)}% to +
            {actualHi.toFixed(1)}%, while the forecasts stay within about{" "}
            {predBand.toFixed(1)}% of zero.
          </p>
          <p>
            A near-constant forecast is what least squares produces when the
            regressors are uninformative. The estimated coefficients are close to
            zero and the fitted value converges to the training mean of the target,
            which for a large stock&apos;s daily return is close to zero.
          </p>

          <Sub>Coefficients</Sub>
          <p>
            Each coefficient is the change in the forecast for a one standard
            deviation change in the feature. Both models are drawn on one axis.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <WeightBars
              title="Price model coefficients"
              data={priceBars}
              domain={weightDomain}
              rawUnit="rupees"
              caption={
                <>
                  The weight is concentrated on <C>{heaviestPriceFeature}</C>, the
                  feature closest to the current price. The model forecasts
                  tomorrow&apos;s price mainly by reproducing today&apos;s.
                </>
              }
            />
            <WeightBars
              title="Return model coefficients"
              data={returnBars}
              domain={weightDomain}
              rawUnit="fraction"
              caption={
                <>
                  On the same axis all four coefficients are close to zero. The two
                  largest, on <C>ma5</C> and <C>ma20</C>, are nearly equal and
                  opposite, the pattern produced when correlated regressors are
                  fitted to noise.
                </>
              }
            />
          </div>
        </Section>

        {/* ---------------- 06 emh ---------------- */}
        <Section id="emh" index={6} title="Discussion">
          <p>
            The results are consistent with the weak form of the efficient market
            hypothesis (Fama, 1970), under which current prices reflect the
            information in past prices. A rule based on past prices that reliably
            preceded rises would be traded until its return was competed away.
          </p>
          <p>
            Moving averages are among the most widely computed indicators, so any
            predictability they once carried is likely to have been exploited. At
            the same time, this study uses four features, a linear model and one
            horizon, so the null result applies to that specification and not to
            technical analysis in general.
          </p>
          <p>
            The results do not contradict the momentum literature. Jegadeesh and
            Titman (1993) document that stocks with high returns over the previous
            3 to 12 months outperform those with low returns, an effect measured in
            the cross-section of stocks at monthly horizons. This study measures
            the relationship between short moving averages and the next day&apos;s
            return for each stock separately, which is a different hypothesis.
          </p>
        </Section>

        {/* ---------------- 07 meaning ---------------- */}
        <Section id="meaning" index={7} title="Scope of the conclusion">
          <p>
            The study rules out a one-day forecast built from these four
            price-history features with a linear model, on this universe and in
            this period. That is the horizon on which short-term technical trading
            operates.
          </p>
          <p>
            It says nothing about long-horizon investment based on fundamentals.
            Profitability, reinvestment, leverage, cash flow and valuation are not
            inputs to the model, so the results neither support nor contradict
            their use. The conclusion is one-sided: negative for daily
            moving-average signals, and silent on everything else.
          </p>
        </Section>

        {/* ---------------- 08 why ---------------- */}
        <Section id="why" index={8} title="Motivation">
          <div className="space-y-4 rounded-xl border border-line bg-surface px-6 py-6 text-[15.5px] leading-[1.8]">
            <p>
              I started studying markets through an equity research programme at
              BugleRock Capital, where the contrast between fundamental analysis
              and technical trading was a recurring theme. This project tests one
              side of that contrast against data.
            </p>
            <p>
              It was also an exercise in understanding the method rather than
              running a library: what least squares fits, what each metric
              compares against, and how the choice of benchmark determines what a
              score means. Fixing the benchmarks before estimation was the most
              consequential decision in the project, as section 5 shows.
            </p>
          </div>
        </Section>

        {/* ---------------- 09 limits ---------------- */}
        <Section id="limits" index={9} title="Limitations and further work">
          <Sub>Limitations</Sub>
          <Bullets
            items={[
              <><V>Statistical power.</V> About {Math.round(s.avgTestDays)} test days per stock gives a standard error of {pctf(se)} on a single stock&apos;s accuracy, too large to detect an effect of one percentage point. Studies that report technical-rule effects typically use several decades of data.</>,
              <><V>One test window.</V> All stocks are evaluated on the same 16 months, so their results are correlated, and a window with different market conditions could produce a different benchmark and edge.</>,
              <><V>Linear specification.</V> A relationship that operates through thresholds or interactions, such as a crossing that predicts returns only in low-volatility periods, would not be detected.</>,
              <><V>Corporate actions.</V> Price adjustment does not correct demergers. Raymond (May 2025) and Tata Motors (October 2025) each show a one-day fall caused by a demerger inside the test period; both stocks are retained and flagged.</>,
              <><V>Price returns and no costs.</V> Dividends are excluded, and no transaction costs are deducted. A small positive edge before costs would not imply a profitable strategy.</>,
              <><V>Universe.</V> Most stocks are large and mid capitalisation constituents, among the most widely followed Indian equities. A null result is less surprising here than it would be in less liquid stocks.</>,
            ]}
          />
          <Sub>Further work</Sub>
          <Bullets
            items={[
              <><V>Cross-sectional momentum.</V> Test 3 to 12 month momentum across NSE stocks, net of costs, where the literature finds the strongest evidence.</>,
              <><V>A larger small-cap sample.</V> {small?.n ?? 26} small-cap stocks are too few to test whether predictability is concentrated in less liquid names.</>,
              <><V>Non-price predictors.</V> Earnings revisions and analyst recommendation changes do not depend on the price history used here.</>,
              <><V>Non-linear models.</V> Tree ensembles can represent thresholds and interactions, but require walk-forward cross-validation to avoid overfitting on samples of this size.</>,
              <><V>A formal directional test.</V> A Pesaran-Timmermann test accounts for the base rate of up days and would replace the comparison with a fixed 50%.</>,
            ]}
          />
        </Section>

        <nav className="-mx-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-4 text-[13px]">
          <a href="#top" className="inline-flex min-h-11 cursor-pointer items-center rounded-lg px-2 text-ink-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink">
            Back to the top
          </a>
          <a
            href={`${META.repo}/blob/main/docs/REPORT.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 cursor-pointer items-center rounded-lg px-2 text-ink-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
          >
            Full report
          </a>
          <a
            href={`${META.repo}/blob/main/results/RESULTS.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 cursor-pointer items-center rounded-lg px-2 text-ink-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
          >
            Per-stock results
          </a>
          <a
            href={META.repo}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 cursor-pointer items-center rounded-lg px-2 text-ink-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
          >
            Source and pipeline on GitHub
          </a>
        </nav>
      </main>
    </>
  );
}
