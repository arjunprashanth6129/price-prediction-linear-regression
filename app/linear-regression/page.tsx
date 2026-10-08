import TopBar from "../components/TopBar";
import { Reveal, CountUp } from "../components/Motion";
import { Section, V, C, StatCard, PaperCTA, SummaryNote } from "../components/Page";
import CrossDiagram from "../components/CrossDiagram";
import Hyperplane3D from "../components/Hyperplane3D";
import {
  AccuracyScatter,
  CapBreakdown,
  EdgeRanked,
  MaRatioSigns,
  ParityScatter,
  R2Histogram,
  type CapRow,
  type EdgeBar,
  type R2Bucket,
  type ScatterPoint,
} from "../components/Charts";
import { PROJECTS } from "@/lib/project";
import { companyName } from "@/lib/universe";
import {
  getAllMlSignals,
  getMlSummary,
  getWorkedExample,
  directionalStandardError,
} from "@/lib/ml";

const META = PROJECTS[0];

export const metadata = { title: META.name, description: META.blurb };

const SECTIONS = [
  { id: "signal", label: "The signal and the test" },
  { id: "fit", label: "Explained variance" },
  { id: "direction", label: "Direction and the benchmark" },
  { id: "significance", label: "Significance" },
  { id: "ratio", label: "The moving-average ratio" },
  { id: "size", label: "By market cap" },
  { id: "worked", label: "Why the target is a return" },
  { id: "surface", label: "The fitted surface" },
  { id: "conclusion", label: "Conclusion" },
];

export default function LinearRegressionStudy() {
  const s = getMlSummary();
  const all = getAllMlSignals();
  const ex = getWorkedExample();
  const entries = Object.entries(all);

  const pctf = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
  const signed = (x: number, d = 1) =>
    `${x >= 0 ? "+" : ""}${(x * 100).toFixed(d)}`;

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
  const r2Negative = entries.filter(([, r]) => r.r2Return < 0).length;

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
  const predBand = Math.max(...returnRows.map((r) => Math.abs(r.predictedReturn * 100)));
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

  return (
    <>
      <TopBar
        eyebrow="Study 01"
        title="Price prediction with a linear regression model"
        sections={SECTIONS}
        repo={META.repo}
        paper={META.paper}
      />

      <main id="top" className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8">
        {/* ---------------- hero ---------------- */}
        <Reveal>
          <header>
            <p className="eyebrow">Research summary</p>
            <h1 className="mt-2 text-[34px] font-semibold leading-[1.1] tracking-tight text-ink sm:text-[44px]">
              Do moving-average features predict next-day returns?
            </h1>
            <p className="mt-5 text-[17.5px] leading-[1.7] text-ink-muted">
              A separate linear regression was fitted to each of {s.total} NSE
              stocks, using four features built from recent closing prices, and
              scored on the last 17 months of data, which the model never saw. It
              did no better than simple rules that use no model at all.
            </p>
            <SummaryNote paper={META.paper} />
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
              detail={`A forecast with no information would have scored ${signed(randomEdge, 1)}% against the same benchmark.`}
              tone="accent"
            />
            <StatCard
              value={`${s.maRatioTopFeature} of ${s.total}`}
              label="Golden-cross ratio largest"
              detail="Stocks for which ma_ratio had the largest coefficient."
            />
          </div>
        </Reveal>

        {/* ---------------- 01 signal ---------------- */}
        <Section
          id="signal"
          index={1}
          title="The signal and the test"
          summary="The most common technical signal, turned into four features, one regression per stock, and an evaluation period the model never sees."
        >
          <div className="grid gap-6 md:grid-cols-2">
            <Reveal><CrossDiagram /></Reveal>
            <div className="space-y-4">
              <p>
                A golden cross, when a short moving average rises above a long
                one, is read as a signal to buy; the reverse, a death cross, as a
                signal to sell. The figure shows both in Britannia&apos;s price in
                2019.
              </p>
              <p>
                The study turns the rule into four features: the 5-day and 20-day
                moving averages, the one-day return, and the ratio of the two
                averages, <C>ma_ratio</C>, which is above 1 in the golden-cross
                state.
              </p>
            </div>
          </div>
          <p>
            For each stock, a least squares regression is fitted on the first 80%
            of its history, June 2019 to January 2025, and scored on the last
            20%, February 2025 to June 2026. The split is in date order and the
            features are standardised with training-period statistics only, so
            nothing from the evaluation period reaches the model. The benchmarks
            were fixed before any model was estimated.
          </p>
        </Section>

        {/* ---------------- 02 fit ---------------- */}
        <Section
          id="fit"
          index={2}
          title="Explained variance"
          summary={
            <>
              Mean out-of-sample R² is {s.avgR2.toFixed(4)}: for the typical stock
              the model forecasts worse than a constant.
            </>
          }
        >
          <R2Histogram data={r2Data} aboveZero={r2AboveZero} total={s.total} />
          <p>
            {r2Negative} of {s.total} stocks have a negative R², and the{" "}
            {r2AboveZero} positive values are all small. This is what happens when
            the features carry no information: the coefficients fit noise in the
            training period, and the noise does not repeat.
          </p>
        </Section>

        {/* ---------------- 03 direction ---------------- */}
        <Section
          id="direction"
          index={3}
          title="Direction and the benchmark"
          summary="The model beats an always-up rule for most stocks, but only because up days were scarce in the test window."
        >
          <AccuracyScatter data={scatter} above={beats} below={s.total - beats} />
          <p>
            Mean directional accuracy is <V>{pctf(s.avgDirAccuracy)}</V>, and the
            model beats the always-up rule for {s.positiveEdge} of {s.total}{" "}
            stocks, by {signed(s.avgEdge, 2)} points on average. That says more
            about the benchmark than the model. Up days were in the minority for{" "}
            {weakBenchmark} stocks, so the always-up rule averaged only{" "}
            {pctf(s.avgNaive)}. A forecast with no information is right half the
            time, so it would have beaten the same rule by{" "}
            <V>{signed(randomEdge, 1)}</V> points on average, more than the model
            did.
          </p>
        </Section>

        {/* ---------------- 04 significance ---------------- */}
        <Section
          id="significance"
          index={4}
          title="Significance"
          summary="No stock is significantly more accurate than 50%, and none of the significant results survives a correction for testing 98 stocks."
        >
          <EdgeRanked
            data={edgeData}
            negative={negativeEdge}
            total={s.total}
            avgTestDays={Math.round(s.avgTestDays)}
            noiseBand={band}
          />
          <p>
            With about {Math.round(s.avgTestDays)}{" "}test days per stock, one
            stock&apos;s accuracy has a standard error of about {pctf(se)}. In a
            binomial test, <V>{sigAbove}</V> stocks are significantly above 50%
            and {sigBelow} below, against about 2.5 per tail expected by chance in{" "}
            {s.total} tests, and none of the {sigBelow} survives a
            Benjamini-Hochberg correction. The Pesaran-Timmermann test, which
            allows for the share of up days, is significant for 5 of 97 stocks at
            5%, about what chance produces, and for none after the same
            correction.
          </p>
        </Section>

        {/* ---------------- 05 ratio ---------------- */}
        <Section
          id="ratio"
          index={5}
          title="The moving-average ratio"
          summary="The feature that encodes the crossing rule is never the largest coefficient, and its effect is tiny."
        >
          <MaRatioSigns
            positive={s.maRatioPositive}
            negative={s.maRatioNegative}
            total={s.total}
          />
          <p>
            <C>ma_ratio</C> has the largest standardised coefficient for{" "}
            <V>{s.maRatioTopFeature} of {s.total}</V> stocks. Its sign is positive
            for {s.maRatioPositive} and negative for {s.maRatioNegative}, a
            majority unlikely to be chance (sign test, p = 0.02), but a one
            standard deviation change in the ratio moves the forecast daily return
            by only about {(s.avgAbsMaRatioWeight * 100).toFixed(2)} percentage
            points, and accuracy shows no benefit. The ratio is a function of the
            two averages, which move together, so the individual coefficients are
            poorly identified; the conclusion rests on out-of-sample accuracy
            instead.
          </p>
        </Section>

        {/* ---------------- 06 size ---------------- */}
        <Section
          id="size"
          index={6}
          title="By market capitalisation"
          summary="Small caps show the largest edge only because their benchmark was lower. Accuracy is the same across bands."
        >
          <CapBreakdown data={capRows} />
          {large && small && (
            <p>
              Momentum is often stronger in smaller, less followed stocks, so the
              results were split by capitalisation band. Small caps ({small.n}{" "}
              stocks) show the largest mean edge, {signed(small.avgEdge, 2)} points
              against {signed(large.avgEdge, 2)} for large caps ({large.n}), only
              because up days were rarer among them. The spread of results within
              each band is wider than the differences between bands, so size does
              not separate the stocks the model can forecast from those it
              cannot.
            </p>
          )}
        </Section>

        {/* ---------------- 07 worked ---------------- */}
        <Section
          id="worked"
          index={7}
          title="Why the target is a return"
          summary={
            <>
              On Reliance, a model that forecasts the price scores an R² of{" "}
              {ex.priceModel.r2.toFixed(2)}{" "}and still loses to the forecast that
              tomorrow&apos;s close equals today&apos;s.
            </>
          }
        >
          <p>
            Forecasting tomorrow&apos;s price instead of its return looks far
            better on paper. For Reliance Industries the price model&apos;s R² is{" "}
            <V>{ex.priceModel.r2.toFixed(3)}</V>, but the random walk, which simply
            repeats today&apos;s close, scores <V>{ex.naiveModel.r2.toFixed(3)}</V>{" "}
            with no estimation and a mean absolute error of ₹
            {ex.naiveModel.mae.toFixed(2)} against ₹{ex.priceModel.mae.toFixed(2)}.
            Daily changes are small next to the spread of the price level, so any
            forecast near yesterday&apos;s close explains most of the variance.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <ParityScatter
              title="Price model"
              data={priceParity}
              domain={[priceLo, priceHi]}
              unit="rupees"
              caption={
                <>
                  Forecasts lie close to the diagonal because each one is close to
                  the previous close, not because the model anticipates the move.
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
                  Forecasts stay within about {predBand.toFixed(1)}% of zero while
                  realised returns span the whole range.
                </>
              }
            />
          </div>
          <p>
            Both plots use the same {testDays} days, features and estimator; only
            the target differs. Once the level is removed, the forecasts barely
            move with the outcome, which is what least squares produces when the
            features carry no information.
          </p>
        </Section>

        {/* ---------------- 08 surface ---------------- */}
        <Section
          id="surface"
          index={8}
          title="The fitted surface"
          summary="Holding two features fixed, the model is a plane, and for Reliance it is almost flat."
        >
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
            </div>
          </Reveal>
          <p>
            The plane is a two-feature slice of Reliance&apos;s return model, with
            the one-day return and the ratio held at their means, and the points
            are the realised returns of the test days. Because the two averages
            move together, the days lie along a narrow band, and along it the
            plane is almost flat while the returns scatter far above and below. A
            model with predictive power would tilt along the band, with the days
            close to it. Drag the chart to rotate it.
          </p>
        </Section>

        {/* ---------------- 09 conclusion ---------------- */}
        <Section
          id="conclusion"
          index={9}
          title="Conclusion"
          summary="Daily moving-average signals carried no usable information about next-day returns in this sample."
        >
          <p>
            The results are consistent with weak-form market efficiency: a rule
            built from widely watched past prices is among the first to be traded
            away. The conclusion is also narrow. It covers four features, a linear
            model and a one-day horizon, on these stocks in this period, and says
            nothing about momentum at monthly horizons or about investing on
            fundamentals.
          </p>
          <PaperCTA paper={META.paper} repo={META.repo}>
            The paper has the full method, the Pesaran-Timmermann and
            Benjamini-Hochberg tests, the worked example in detail, the
            limitations and the results for every stock.
          </PaperCTA>
        </Section>

        <nav className="-mx-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-4 text-[13px]">
          <a href="#top" className="inline-flex min-h-11 cursor-pointer items-center rounded-lg px-2 text-ink-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink">
            Back to the top
          </a>
        </nav>
      </main>
    </>
  );
}
