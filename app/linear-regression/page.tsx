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
  { id: "question", label: "The question" },
  { id: "method", label: "How it was built" },
  { id: "findings", label: "What the data showed" },
  { id: "size", label: "Does size help" },
  { id: "worked", label: "The R² trap" },
  { id: "emh", label: "Why this happens" },
  { id: "meaning", label: "For investing" },
  { id: "why", label: "Why I built it" },
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
              Can price momentum predict tomorrow&apos;s return?
            </h1>
            <p className="mt-5 text-[17.5px] leading-[1.7] text-ink-muted">
              A linear regression study across {s.total} NSE stocks, and what the
              answer reveals about market efficiency.
            </p>

            <div className="mt-7 rounded-xl border-l-2 border-accent bg-surface px-6 py-5">
              <p className="eyebrow">Abstract</p>
              <p className="mt-3 text-[14.5px] leading-[1.8] text-ink-muted">
                Four price-derived signals were tested as predictors of next-day
                returns across {s.total} NSE stocks: a 5-day moving average, a
                20-day moving average, the day&apos;s own return, and the ratio
                between the two averages, which encodes the golden and death
                cross as one continuous number. A linear regression was trained
                per stock on seven years of daily closes, from June 2019 to June
                2026, using a strict 80/20 chronological split, with features
                standardised by a scaler fitted on the training rows only. The
                model averaged an R² of <V>{s.avgR2.toFixed(4)}</V> on returns
                and called direction correctly{" "}
                <V>{pctf(s.avgDirAccuracy)}</V> of the time, which is below a
                coin flip, against <V>{pctf(s.avgNaive)}</V> for simply guessing
                &ldquo;up&rdquo; every day. The resulting edge of{" "}
                <V>{signed(s.avgEdge, 2)}</V> comes from the baseline being weak
                over this window rather than from the model being good. The
                golden cross ratio was the largest weight for{" "}
                <V>{s.maRatioTopFeature} of {s.total}</V> stocks. The results are
                consistent with the weak form of the efficient market hypothesis.
              </p>
            </div>
          </header>
        </Reveal>

        <Reveal delay={60}>
          <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              value={<CountUp value={s.avgDirAccuracy * 100} decimals={1} suffix="%" />}
              label="Directional accuracy"
              detail="Below a coin flip, after seven years of training data."
            />
            <StatCard
              value={<CountUp value={s.avgR2} decimals={2} />}
              label="Average R² on returns"
              detail="Below zero, so worse than guessing the average every day."
            />
            <StatCard
              value={<CountUp value={s.avgEdge * 100} decimals={1} prefix="+" suffix="%" />}
              label="Edge over the baseline"
              detail={`Against an always-up rule that scored only ${pctf(s.avgNaive)}.`}
              tone="accent"
            />
            <StatCard
              value={`${s.maRatioTopFeature} of ${s.total}`}
              label="Golden cross led"
              detail="Stocks where the cross ratio was the heaviest feature."
            />
          </div>
        </Reveal>

        {/* ---------------- 01 question ---------------- */}
        <Section id="question" index={1} title="The question">
          <p>
            Momentum trading rests on a simple claim: that the recent shape of a
            price chart tells you something about where the price goes next.
            Moving averages and the golden cross are the most widely taught
            version of that claim. Every trading platform draws them by default,
            every introductory course explains them, and a great deal of retail
            decision-making rests on reading them. If the claim holds, it should
            be measurable. If it does not, that should be measurable too.
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            <Reveal><CrossDiagram /></Reveal>
            <div className="space-y-4">
              <p>
                The event being tested is drawn on the left, from real closes
                rather than an illustration. When a fast moving average climbs
                above a slow one, traders call it a golden cross and read it as
                bullish. When it falls back below, that is a death cross. The
                appeal is obvious: it is easy to compute, easy to see, and it
                appears to describe a change in trend.
              </p>
              <p>
                The question asked here is deliberately narrow, because a narrow
                question has a checkable answer: given only a stock&apos;s recent
                price history, expressed through four of the most widely followed
                technical indicators, can a linear model predict the direction and
                size of tomorrow&apos;s return better than a benchmark that
                requires no model at all?
              </p>
              <p>
                {s.total} NSE stocks, seven years of daily closes, and a strict
                chronological split, so the model is only ever asked about days it
                has genuinely never seen. No discretion, no hand-picked examples,
                and no adjusting the method after seeing the answer.
              </p>
            </div>
          </div>
          <Note>
            The benchmark and the metric were both chosen before any model was
            fitted. That ordering is the single most important decision in this
            project, and the worked example in section five is entirely about why.
          </Note>
        </Section>

        {/* ---------------- 02 method ---------------- */}
        <Section id="method" index={2} title="How the model was built">
          <p>
            The model is an ordinary linear regression from scikit-learn, fitted
            independently for each stock. That is deliberately the simplest thing
            that could work. If an edge only appears once you reach for an
            elaborate model, that is usually the model talking rather than the
            data, and a simple fit makes it much harder to fool yourself.
          </p>

          <Sub>The four features</Sub>
          <p>
            All four are computed from closes up to and including today. Only the
            target looks forward, which is the property that has to hold for the
            exercise to mean anything.
          </p>
          <Table
            minWidth={560}
            head={
              <thead className="bg-surface-2">
                <tr className="border-b border-line">
                  <TH align="left">Feature</TH>
                  <TH align="left">Definition</TH>
                  <TH align="left">What it encodes</TH>
                </tr>
              </thead>
            }
          >
            <tbody>
              {[
                ["ma5", "5-day rolling mean of close", "short-term trend"],
                ["ma20", "20-day rolling mean of close", "medium-term trend"],
                ["ret", "(close today - close yesterday) / close yesterday", "today's own move"],
                ["ma_ratio", "ma5 / ma20", "the golden and death cross as one continuous number"],
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
            The last of these is the one the project is really about.{" "}
            <C>ma_ratio</C> turns a discrete event into a continuous quantity:
            above 1.0 the fast average leads, which is golden cross territory,
            below 1.0 it lags, and the distance from 1.0 is how emphatic the
            signal is. That makes it something a regression can actually weigh,
            rather than a yes-or-no flag that fires a handful of times.
          </p>

          <Sub>The target, and why it is a return</Sub>
          <p>
            The model predicts tomorrow&apos;s <em>return</em>, not
            tomorrow&apos;s price. This is the decision that determines whether
            the whole study measures anything at all. Predicting the price level
            scores an R² near 0.9 almost automatically, because prices barely move
            overnight. Measured directly here, the price model scored{" "}
            <V>{ex.priceModel.r2.toFixed(2)}</V> while a &ldquo;tomorrow equals
            today&rdquo; guess needing no model at all scored{" "}
            <V>{ex.naiveModel.r2.toFixed(2)}</V>. That number flatters
            autocorrelation, not skill. Returns strip the head start away.
          </p>

          <Sub>The split, and why it is never shuffled</Sub>
          <p>
            The first 80% of days train and the last 20% test, in date order.
          </p>
          <div className="overflow-x-auto rounded-lg border border-line bg-surface-2 px-4 py-3 font-mono text-[12px] text-ink-muted">
            [&lt;-- TRAIN 80% (Jun 2019 to Jan 2025) --|-- TEST 20% (Feb 2025 to
            Jun 2026) --&gt;]
          </div>
          <p>
            The usual <C>train_test_split(shuffle=True)</C> is correct for
            independent samples and wrong here, for two separate reasons. It leaks
            the future into the past, scattering 2026 days into the training set
            and 2024 days into the test set, so the model studies the future and
            is then examined on the past. In live use there is no future to study,
            so the resulting score measures nothing. And neighbouring rows are
            near-duplicates: a 20-day average on Tuesday and on Wednesday share
            nineteen of their twenty inputs, so shuffling puts one in train and
            one in test and the model is scored on rows it has effectively already
            seen.
          </p>
          <p>
            The scaler follows the same rule. <C>StandardScaler</C> is fitted on
            the training rows only, then applied to both. Fitting it on the whole
            dataset would bake the test period&apos;s mean and spread into the
            training transform, which is the same leak wearing a quieter disguise.
          </p>

          <Sub>What fitting a model actually means</Sub>
          <p>
            With one feature, linear regression draws a line through the data.
            With two, it fits a flat plane: for every combination of the two
            inputs the plane gives the model&apos;s answer, and the vertical
            distance from each real day up or down to that surface is the error
            the fitting process is trying to make as small as possible. Adding
            features keeps the idea and loses the picture, because with four the
            surface lives in four dimensions and cannot be drawn at all.
          </p>
          <p>
            Below is a two-feature slice of the real fit, with <C>ret</C> and{" "}
            <C>ma_ratio</C> held at their averages. It is a slice of the actual
            model rather than a separately fitted one, so the tilt is the tilt the
            model really has. Drag to rotate it.
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
                The plane is what the model believes: for any pairing of
                short-term and medium-term trend, this is the return it expects.
                The dots are what those days actually did. Watch how little the
                plane tilts as you rotate it. A model holding real signal would
                tilt steeply with the days hugging it closely; here the surface is
                nearly level and the observations scatter far above and below.
              </p>
            </div>
          </Reveal>
        </Section>

        {/* ---------------- 03 findings ---------------- */}
        <Section id="findings" index={3} title="What the data showed">
          <p>
            R² is the share of variation in tomorrow&apos;s move that the model
            accounts for, where zero means none at all. The average across all{" "}
            {s.total} stocks is <V>{s.avgR2.toFixed(4)}</V>, which sits{" "}
            <em>below</em> zero, meaning that on average the model did slightly
            worse than predicting the same average return every single day.
          </p>
          <R2Histogram data={r2Data} aboveZero={r2AboveZero} total={s.total} />
          <p>
            The distribution is the point rather than the average. Every stock
            lands between {Math.min(...r2Values).toFixed(2)} and{" "}
            {Math.max(...r2Values).toFixed(2)}, a tight pile just below zero.
            There is no tail of stocks where the model quietly worked, and the{" "}
            {r2AboveZero} that clear zero clear it by a margin too small to matter.
          </p>

          <Sub>Direction, which is the easier question</Sub>
          <p>
            R² punishes a model for missing the size of a move. Direction is
            easier and is the question a decision actually rests on: buy or not.
            The model called it correctly <V>{pctf(s.avgDirAccuracy)}</V> of the
            time. Read that number on its own before reading anything else. After
            seven years of training data, the model calls tomorrow&apos;s
            direction correctly <V>less than half the time</V>.
          </p>
          <AccuracyScatter data={scatter} above={beats} below={s.total - beats} />
          <p>
            The nominal edge is positive, at {signed(s.avgEdge, 2)}, and{" "}
            {s.positiveEdge} of {s.total} stocks beat their own baseline. That
            looks like a result and is not one. The always-up rule only scored{" "}
            {pctf(s.avgNaive)} here because the test window was close to flat, so
            the benchmark was unusually easy to clear.{" "}
            <V>Beating a poor benchmark from below a coin flip is not skill.</V>{" "}
            This is exactly why the edge is reported next to the raw accuracy
            rather than instead of it.
          </p>

          <Sub>Almost nothing survives its own error bar</Sub>
          <p>
            With about {Math.round(s.avgTestDays)} test days per stock, treating
            each day as a coin flip gives a standard error on any single accuracy
            figure of roughly {pctf(se)}. Two standard errors is about ±
            {pctf(2 * se, 0)}, and any edge inside that band is indistinguishable
            from luck.
          </p>
          <EdgeRanked
            data={edgeData}
            negative={negativeEdge}
            total={s.total}
            avgTestDays={Math.round(s.avgTestDays)}
            noiseBand={band}
          />
          <p>
            Only <V>{outsideBand} of {s.total}</V> bars clear that band, which is
            roughly what ranking {s.total} noisy estimates produces by chance
            alone. The green end of this ranking is what sampling variation looks
            like, not a shortlist. It is also worth noticing that several of the
            largest edges belong to stocks with clearly negative R²: they called
            direction slightly better than their baseline while modelling the size
            of the move worse than a constant guess. That combination is the
            signature of noise rather than signal.
          </p>

          <Sub>The golden cross earned nothing</Sub>
          <p>
            <C>ma_ratio</C> was the single heaviest weight for{" "}
            <V>{s.maRatioTopFeature} of {s.total}</V> stocks. Not one. Its average
            absolute coefficient was {s.avgAbsMaRatioWeight.toFixed(4)}, close
            enough to zero that the model is effectively ignoring it, and its sign
            split {s.maRatioPositive} positive to {s.maRatioNegative} negative.
          </p>
          <MaRatioSigns
            positive={s.maRatioPositive}
            negative={s.maRatioNegative}
            total={s.total}
          />
          <p>
            That split is the tell. A signal carrying real directional information
            would push the same way for nearly every stock, with golden cross
            territory meaning the same thing for Infosys as for Britannia, and
            would earn a weight large enough to matter. Instead the coefficient
            points whichever way each stock&apos;s own noise happens to lean, at a
            magnitude the model barely acts on. That is what a variable with
            nothing to say looks like once it has been fitted.
          </p>
          <p className="text-[14.5px]">
            One caveat belongs with those coefficients rather than in a footnote.{" "}
            <C>ma_ratio</C> is <C>ma5 / ma20</C>, a deterministic function of two
            features already in the model. Near-redundant predictors let a linear
            fit trade large offsetting weights between them without changing a
            single prediction, so the individual coefficients are unstable and a
            large one would not by itself prove the cross signal mattered. That
            cuts both ways, which is why the argument above rests on directional
            accuracy against the baseline rather than on the weights alone.
          </p>
        </Section>

        {/* ---------------- 04 size ---------------- */}
        <Section id="size" index={4} title="Does company size rescue it?">
          <p>
            Momentum is documented to bite harder in smaller, less closely watched
            companies, where less analyst attention plausibly leaves more pattern
            unexploited. If the signal exists anywhere in this universe, that is
            where it should be. So the {s.total} stocks were split by market
            capitalisation, anchored at June 2021, and scored separately.
          </p>
          <CapBreakdown data={capRows} />
          {large && small && (
            <p>
              It barely mattered. Large caps ({large.n} stocks) averaged{" "}
              {signed(large.avgEdge, 2)} of edge at {pctf(large.avgDirAccuracy)}{" "}
              accuracy; small caps ({small.n} stocks) {signed(small.avgEdge, 2)} at{" "}
              {pctf(small.avgDirAccuracy)}. Small caps do come out ahead on
              nominal edge, which is the direction the literature predicts, but{" "}
              <V>their directional accuracy is essentially identical to the large
              caps</V>. The entire difference comes from the small-cap baseline
              being weaker, not from the model performing better on them. That is
              baseline drift dressed as a momentum premium.
            </p>
          )}
        </Section>

        {/* ---------------- 05 worked ---------------- */}
        <Section id="worked" index={5} title="A worked example, and the R² trap">
          <p>
            The aggregates hide the single most useful thing this project turned
            up, so here is one stock in full. Reliance, same pipeline, trained on{" "}
            {ex.trainDateRange.start} to {ex.trainDateRange.end} and scored on the{" "}
            {testDays} trading days from {ex.testDateRange.start} to{" "}
            {ex.testDateRange.end}.
          </p>
          <p>
            Two models were fitted on identical features and an identical split.
            The only difference is what they were asked to predict: one
            tomorrow&apos;s <em>price</em>, the other tomorrow&apos;s{" "}
            <em>return</em>. Alongside both sits the rule that requires no model
            at all, which is to assume tomorrow closes where today closed.
          </p>

          <Table
            minWidth={560}
            head={
              <thead className="bg-surface-2">
                <tr className="border-b border-line text-right">
                  <TH align="left">Test-set score</TH>
                  <TH>Price model</TH>
                  <TH>Naive: tomorrow = today</TH>
                  <TH>Return model</TH>
                </tr>
              </thead>
            }
            caption={
              <>
                MAE and RMSE for the first two columns are in rupees and directly
                comparable. The return model predicts a fraction, so only its R²
                and direction can be read across.
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
            Read the middle column first. The price model scores an R² of{" "}
            <V>{ex.priceModel.r2.toFixed(4)}</V>, the kind of number that ends a
            project early and goes straight into a slide deck. But doing nothing
            at all scores <V>{ex.naiveModel.r2.toFixed(4)}</V>, which is{" "}
            <em>higher</em>, with an average error of ₹
            {ex.naiveModel.mae.toFixed(2)} against the model&apos;s ₹
            {ex.priceModel.mae.toFixed(2)}, about{" "}
            {Math.round((1 - ex.naiveModel.mae / ex.priceModel.mae) * 100)}% less
            error for no model. On direction the do-nothing rule is ahead too.
          </p>
          <Note>
            That is the whole trap in one row. A price-level R² near{" "}
            {ex.priceModel.r2.toFixed(2)} is not measuring forecasting skill, it
            is measuring that Reliance costs about the same today as it did
            yesterday. Any model handed today&apos;s price inherits that for free.
            Judged against zero it looks brilliant; judged against the only
            benchmark that matters, it is worse than not bothering.
          </Note>

          <PriceFit
            data={ex.pricePeriodData}
            span={`${ex.testDateRange.start} to ${ex.testDateRange.end}`}
          />

          <Sub>Predicted against actual</Sub>
          <p>
            The standard way to judge any regression is to plot every prediction
            against what actually happened. A flawless model would put every point
            on the 45° diagonal, where predicted equals actual, and how far the
            cloud drifts off that line is the error. Below are the same {testDays}{" "}
            days, the same four features and the same algorithm, plotted twice.
            Only the question changed.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <ParityScatter
              title="Price model"
              data={priceParity}
              domain={[priceLo, priceHi]}
              unit="rupees"
              caption={
                <>
                  The dots press so tightly against the diagonal that the line is
                  hard to pick out beneath them. It reads as near-perfect
                  prediction and is nothing of the kind: the model is answering
                  with approximately today&apos;s price, and prices move very
                  little overnight. This is autocorrelation wearing
                  accuracy&apos;s clothes.
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
                  This is the shape of no predictive power. Horizontally the cloud
                  barely moves, with every prediction inside half a percent of
                  zero. Vertically it covers the whole range of what actually
                  happened. Genuine skill would tilt this into a diagonal cloud
                  following the reference line; a vertical band means the
                  predictions carry no information about which way the day went.
                </>
              }
            />
          </div>
          <p>
            Those two pictures are the finding in its cleanest form. Same model,
            same inputs, same days. The difference is entirely in whether the
            target still contains the answer.
          </p>

          <ResidualPlot
            data={residuals}
            span={`${ex.testDateRange.start} to ${ex.testDateRange.end}`}
          />
          <p>
            The residuals confirm there is nothing left in there. A model with
            real signal leaves small errors scattered evenly around zero. These
            span the entire range of daily moves, because the prediction was near
            zero every day, so the errors are essentially the returns themselves.
          </p>

          <ReturnFit
            data={ex.returnModel.testPeriodData ?? []}
            span={`${ex.testDateRange.start} to ${ex.testDateRange.end}`}
          />
          <p>
            Put the price chart and the return chart side by side and the first
            looks like a triumph while the second looks like a failure. That
            reading is exactly backwards. The price chart plots a <em>level</em>:
            to land near ₹{Math.round(meanClose).toLocaleString("en-IN")}{" "}
            tomorrow, a model only has to notice that today&apos;s price is near ₹
            {Math.round(meanClose).toLocaleString("en-IN")}, so the two lines
            trace each other. But the quantity it must get right is enormous
            compared with the amount that actually changes overnight: it is
            scoring well on the ₹{Math.round(meanClose).toLocaleString("en-IN")}{" "}
            it was handed, not on the ₹{Math.round(meanClose * meanAbsMove)} it
            was asked to anticipate.
          </p>
          <p>
            The return chart plots a <em>change</em>, which deletes the part the
            model was given for free and leaves only the part in dispute. The
            actual line swings between {actualLo.toFixed(1)}% and +
            {actualHi.toFixed(1)}% while the prediction never leaves a band of
            about {predBand.toFixed(1)}% around zero. Nothing broke between the
            two pictures; the second simply removed the scaffolding and showed
            what was holding the first one up.
          </p>
          <p>
            A flat prediction is also the mathematically correct response to
            having no signal. Least squares minimises squared error, and when the
            inputs carry nothing that anticipates the target, the error-minimising
            guess is the training mean. The mean daily move of a large stock is
            close to zero, so the model converges on &ldquo;about nothing, again
            today&rdquo;. That is not the model giving up. It is the model being
            right about how little it knows.
          </p>

          <Sub>What each model actually learned</Sub>
          <p>
            A linear regression makes its prediction by multiplying each feature
            by a weight and adding the results, so the weights are a direct
            readout of what it leaned on. Drawn on one shared axis:
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <WeightBars
              title="Price model weights"
              data={priceBars}
              domain={weightDomain}
              rawUnit="rupees"
              caption={
                <>
                  The price model leans hard on <C>{heaviestPriceFeature}</C>, not
                  because a short moving average predicts tomorrow&apos;s
                  direction but because it stands in for today&apos;s price, which
                  is most of the answer to &ldquo;what will the price be
                  tomorrow&rdquo;. The big bar is the autocorrelation shortcut
                  showing up in the coefficients: a symptom of the trap, not
                  evidence of skill.
                </>
              }
            />
            <WeightBars
              title="Return model weights"
              data={returnBars}
              domain={weightDomain}
              rawUnit="fraction"
              caption={
                <>
                  On the identical axis every bar collapses to a sliver you have
                  to look for. Same data, same features, same algorithm. Only the
                  target changed, and with it the model&apos;s confidence. Asked
                  the honest question, it assigns weights near zero across the
                  board, which is the model reporting that these four inputs tell
                  it nothing dependable about tomorrow.
                </>
              }
            />
          </div>
          <Note>
            Reporting the {ex.priceModel.r2.toFixed(2)} and stopping would have
            produced a far more impressive-looking project. The reason it is not
            reported that way is that R² answers &ldquo;how much variance did you
            explain&rdquo;, not &ldquo;are you useful&rdquo;, and on an
            autocorrelated series those two questions come apart completely.
            Choosing the benchmark before looking at the score is what keeps the
            difference visible.
          </Note>
        </Section>

        {/* ---------------- 06 emh ---------------- */}
        <Section id="emh" index={6} title="Why this happens">
          <p>
            These results are what the weak form of the efficient market
            hypothesis predicts. The weak form makes a narrow claim: everything
            knowable from a stock&apos;s past prices is already reflected in what
            it costs today. If some shape in the chart reliably preceded a rise,
            buyers would move ahead of it until the profit was gone. The pattern
            does not vanish. It stops paying.
          </p>
          <p>
            Moving averages and the golden cross are the extreme case. They are
            trivial to compute, taught everywhere, and watched by millions of
            people with real money, alongside professional desks running the same
            arithmetic on faster hardware with better execution. An edge that
            survived all of that and was still sitting in seven years of daily NSE
            closes, waiting to be found by a linear regression, would be genuinely
            surprising. These results say it was not there, which is the
            unglamorous and expected answer.
          </p>
          <p>
            None of which means momentum never works. At institutional scale, with
            transaction costs near zero and execution measured in milliseconds,
            edges far too small to see here can compound into real money, and over
            three to twelve months cross-sectional momentum is one of the
            better-replicated findings in finance. The claim being made is
            deliberately specific: these four features, in a linear model, on
            daily data, across this universe, offer nothing a retail investor
            could exploit at human speed once real costs are paid.
          </p>
        </Section>

        {/* ---------------- 07 meaning ---------------- */}
        <Section id="meaning" index={7} title="What this means for investing">
          <p>
            The finding is narrow, and it is worth being precise about what it
            does and does not touch. What has been ruled out is a one-day forecast
            built from price history alone. That is the timescale short-term
            technical trading operates on, and on this universe it came up empty.
          </p>
          <p>
            Long-term investing makes a different bet on a different quantity. It
            asks whether a business earns well, reinvests well and is priced
            reasonably against those earnings, questions answered by margins,
            debt, cash flow and ownership rather than by the shape of a chart.
            None of those inputs appear anywhere in this model, so nothing here
            confirms or refutes them. What the study does establish is that the
            alternative most often offered as a substitute for reading a business
            carried no information at this horizon. Ruling out the shortcut is not
            the same as validating the long route, and this page claims only the
            first.
          </p>
          <p>
            The honest summary is asymmetric: a negative result about daily
            momentum, and silence about everything else.
          </p>
        </Section>

        {/* ---------------- 08 why ---------------- */}
        <Section id="why" index={8} title="Why I built this">
          <div className="space-y-4 rounded-xl border border-line bg-surface px-6 py-6 text-[15.5px] leading-[1.8]">
            <p>Three things I care about happened to meet in this project.</p>
            <p>
              I have been interested in markets since studying equity research
              through BugleRock Capital, where I first ran into the argument
              between fundamental analysis and technical trading, between people
              who read balance sheets and people who read price charts. I wanted
              to know which one the data actually backs, rather than which one
              theory prefers.
            </p>
            <p>
              I have also always liked mathematics, particularly the moments when
              something abstract turns out to answer a real question honestly
              rather than comfortably. Machine learning sat exactly where that
              interest met finance.
            </p>
            <p>
              And I wanted to understand the modelling properly rather than
              superficially: not call a library and repeat whatever it printed,
              but know what the algorithm was fitting, why each evaluation metric
              means what it means, and what the numbers were really saying about
              the data underneath. Choosing the benchmark and the metric before
              running anything mattered more than any modelling decision that came
              after.
            </p>
            <p>
              The answer that came back, with R² at zero, directional accuracy a
              shade worse than a coin flip and the golden cross weighted at almost
              nothing, was not a failure. It was the correct answer to the
              question I asked. Finding out that something does not work is
              exactly what research is for, and it is a great deal more useful
              than a result that looks impressive because something leaked.
            </p>
          </div>
        </Section>

        {/* ---------------- 09 limits ---------------- */}
        <Section id="limits" index={9} title="Limitations, and what comes next">
          <Sub>Where this study is weak</Sub>
          <Bullets
            items={[
              <><V>Seven years is short for this question.</V> Roughly 1,750 trading days per stock, about {Math.round(s.avgTestDays)} of them held out. That covers several market regimes, which is the minimum for a result not to be an artifact of one mood, but published momentum work runs on decades and often a century of equity data, precisely because effects this small only separate from noise over very long samples. A seven-year window can show that a signal is not obviously there. It cannot rule out one that is small, slow and real.</>,
              <><V>A linear model only.</V> If momentum works through thresholds or interactions, such as a golden cross that matters only in calm conditions, a straight-line fit cannot see it and would report exactly the null found here.</>,
              <><V>Two uncorrected demergers.</V> Split and bonus adjustment does not repair demergers. Raymond in May 2025 and Tata Motors in October 2025 each show a one-day fall that is a corporate action rather than a market move, and both land inside the test period. They are reported rather than patched, and they add noise to two of the {s.total} stocks.</>,
              <><V>Price returns, not total returns.</V> Dividends are excluded, so real holding-period returns would be higher for the payers.</>,
              <><V>No transaction costs.</V> This flatters the momentum side. A strategy trading daily signals would surrender much of any edge to brokerage, slippage and short-term tax, so breaking even here means losing money in practice.</>,
              <><V>An efficiently priced universe.</V> Mostly large and mid-cap NSE names, among the most closely analysed stocks in the market. Finding no edge where theory most expects none is a weaker result than finding none in neglected corners.</>,
            ]}
          />
          <Sub>What I would explore next</Sub>
          <Bullets
            items={[
              <><V>A longer horizon.</V> One day is the hardest version of this problem. Three- to twelve-month momentum is one of the most replicated results in the literature, and testing whether it survives here net of costs would be a better use of the same machinery.</>,
              <><V>A genuinely small-cap universe.</V> The size split hinted at nothing, but {small?.n ?? 26} small caps is thin, and the documented premium sits in smaller, less liquid, less analysed names than most of these.</>,
              <><V>Fundamental momentum.</V> Earnings-revision trends and analyst upgrades are price-independent signals with real evidence behind them, and they would test the same question without reusing a price history already shown to be exhausted.</>,
              <><V>Ensemble methods.</V> Random forests or gradient boosting would capture structure a linear fit cannot, but only with walk-forward cross-validation, because a flexible model on 1,750 rows will cheerfully memorise noise and report a wonderful score.</>,
            ]}
          />
        </Section>

        <nav className="-mx-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-4 text-[13px]">
          <a href="#top" className="inline-flex min-h-11 cursor-pointer items-center rounded-lg px-2 text-ink-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink">
            Back to the top
          </a>
          <a
            href={`${META.repo}/blob/main/results/RESULTS.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 cursor-pointer items-center rounded-lg px-2 text-ink-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
          >
            Full per-stock results
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
