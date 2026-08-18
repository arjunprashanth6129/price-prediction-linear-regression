import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import CrossDiagram from "../components/CrossDiagram";
import Hyperplane3D from "../components/Hyperplane3D";
import {
  AccuracyScatter,
  EdgeRanked,
  MaRatioSigns,
  ParityScatter,
  PriceFit,
  R2Histogram,
  ResidualPlot,
  ReturnFit,
  WeightBars,
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

export const metadata = {
  title: META.name,
  description: META.blurb,
};

/** In-page anchors, rendered as the header's second row. */
const SECTIONS = [
  { id: "question", label: "Question" },
  { id: "method", label: "Method" },
  { id: "findings", label: "Findings" },
  { id: "worked", label: "Worked example" },
  { id: "emh", label: "Why" },
  { id: "limits", label: "Limitations" },
];

/* ---------------- primitives ---------------- */

function Section({
  id,
  index,
  title,
  children,
}: {
  id: string;
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-line py-10">
      <div className="flex items-baseline gap-3">
        <span className="tnum text-[13px] font-medium text-accent">
          {String(index).padStart(2, "0")}
        </span>
        <h2 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
          {title}
        </h2>
      </div>
      <div className="mt-4 space-y-4 text-[15px] leading-[1.75] text-fg-muted">
        {children}
      </div>
    </section>
  );
}

function StatCard({
  value,
  label,
  tone = "fg",
}: {
  value: string;
  label: string;
  tone?: "fg" | "pos" | "neg" | "accent";
}) {
  const toneClass = {
    fg: "text-fg",
    pos: "text-pos",
    neg: "text-neg",
    accent: "text-accent",
  }[tone];
  return (
    <div className="rounded-xl border border-line bg-ink-850/50 px-4 py-4">
      <div className={`tnum text-[22px] font-semibold tracking-tight ${toneClass}`}>
        {value}
      </div>
      <div className="mt-1.5 text-[12px] leading-snug text-fg-dim">{label}</div>
    </div>
  );
}

function Spec({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line/60 py-3 first:border-t-0 sm:grid sm:grid-cols-[170px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-[13px] font-medium text-fg">{term}</dt>
      <dd className="mt-1 text-[14px] leading-relaxed text-fg-muted sm:mt-0">
        {children}
      </dd>
    </div>
  );
}

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-[14px] leading-relaxed">
          <span
            aria-hidden
            className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-accent"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function C({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded border border-line bg-ink-850 px-1.5 py-0.5 font-mono text-[13px] text-accent">
      {children}
    </code>
  );
}

/* ---------------- page ---------------- */

export default function Study() {
  const s = getMlSummary();
  const all = getAllMlSignals();
  const ex = getWorkedExample();
  const entries = Object.entries(all);

  const pctf = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
  const signed = (x: number, d = 1) =>
    `${x >= 0 ? "+" : ""}${(x * 100).toFixed(d)}%`;

  // ---- chart 1: R2 buckets ----
  // Boundaries are tight because the data is tight: every R2 here falls between
  // -0.13 and +0.05. Wider buckets (the -0.5 / -0.25 / 0.25 scheme this started
  // with) put all 98 stocks in two bars and left three empty, which showed the
  // headline and hid the distribution.
  const BUCKETS = [
    "Below -0.05",
    "-0.05 to -0.02",
    "-0.02 to -0.01",
    "-0.01 to 0",
    "Above 0",
  ] as const;
  const bucketOf = (r2: number) =>
    r2 < -0.05
      ? BUCKETS[0]
      : r2 < -0.02
        ? BUCKETS[1]
        : r2 < -0.01
          ? BUCKETS[2]
          : r2 < 0
            ? BUCKETS[3]
            : BUCKETS[4];
  const r2Data: R2Bucket[] = BUCKETS.map((bucket) => ({
    bucket,
    count: entries.filter(([, r]) => bucketOf(r.r2Return) === bucket).length,
    positive: bucket === "Above 0",
  }));
  const r2AboveZero = entries.filter(([, r]) => r.r2Return > 0).length;

  // ---- chart 2: scatter ----
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

  // ---- chart 4: ranked edge ----
  const edgeData: EdgeBar[] = entries
    .map(([id, r]) => ({ ticker: id, edge: r.mlEdge * 100 }))
    .sort((a, b) => a.edge - b.edge)
    .map((d, i) => ({ ...d, rank: i + 1 }));
  const negativeEdge = edgeData.filter((d) => d.edge <= 0).length;

  // ---- worked example: feature weights on one shared axis ----
  const FEATS = ["ma5", "ma20", "ret", "ma_ratio"];
  const weightBars = (m: ModelScore): WeightBar[] =>
    FEATS.map((f) => ({ feature: f, value: m.featureWeights?.[f] ?? 0 }));
  const priceBars = weightBars(ex.priceModel);
  const returnBars = weightBars(ex.returnModel);
  // Domain comes from the price model alone and is handed to both charts, so
  // the return model's coefficients stay at the scale they actually are.
  const weightMax = Math.ceil(
    Math.max(...priceBars.map((b) => Math.abs(b.value))) / 50,
  ) * 50;
  const weightDomain: [number, number] = [-weightMax, weightMax];
  const heaviestPriceFeature = priceBars.reduce((a, b) =>
    Math.abs(b.value) > Math.abs(a.value) ? b : a,
  ).feature;

  // ---- worked example: parity plots ----
  const priceRows = ex.priceModel.testPeriodData;
  const priceVals = priceRows.flatMap((r) => [r.actual, r.predicted]);
  const priceLo = Math.floor(Math.min(...priceVals) / 25) * 25;
  const priceHi = Math.ceil(Math.max(...priceVals) / 25) * 25;
  const priceParity = priceRows.map((r) => ({
    date: r.date,
    predicted: r.predicted,
    actual: r.actual,
  }));

  const returnRows = ex.returnModel.testPeriodData;
  const returnVals = returnRows.flatMap((r) => [
    r.actualReturn * 100,
    r.predictedReturn * 100,
  ]);
  const returnBound = Math.ceil(Math.max(...returnVals.map(Math.abs)));
  const returnParity = returnRows.map((r) => ({
    date: r.date,
    predicted: r.predictedReturn * 100,
    actual: r.actualReturn * 100,
  }));
  const residuals = returnRows.map((r, i) => ({
    date: r.date,
    residual: r.residual * 100,
    t: i,
  }));

  // The two ranges the "level vs change" argument turns on, read off the data
  // rather than quoted, so the sentence cannot go stale.
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
  const se = directionalStandardError(s.avgTestDays);
  const large = s.byCap.find((g) => g.category === "Large");
  const small = s.byCap.find((g) => g.category === "Small");

  return (
    <>
      <SiteHeader
        context="Linear regression · 98 NSE stocks"
        sections={SECTIONS}
        repo={META.repo}
      />

      <main
        id="top"
        className="mx-auto w-full max-w-4xl flex-1 scroll-mt-24 px-5 py-10"
      >
        {/* ---- 1. Hero ---- */}
        <header>
          <p className="eyebrow">Research</p>
          <h1 className="mt-2 text-[32px] font-semibold tracking-tight text-fg sm:text-[40px]">
            Can price momentum predict tomorrow&apos;s return?
          </h1>
          <p className="mt-4 text-[17px] leading-relaxed text-fg-muted">
            A linear regression study across {s.total} NSE stocks - and what the
            answer reveals about market efficiency
          </p>

          {/* Abstract, styled like a paper's */}
          <div className="mt-6 rounded-xl border-l-2 border-accent/60 bg-ink-850/70 px-5 py-4">
            <p className="eyebrow">Abstract</p>
            <p className="mt-2 text-[14px] leading-[1.75] text-fg-muted">
              Four price-derived signals - a 5-day moving average, a 20-day
              moving average, the day&apos;s own return, and the ratio between
              the two averages that encodes the golden and death cross - were
              tested as predictors of next-day returns across {s.total} NSE
              stocks. A linear regression was trained on seven years of daily
              closes (June 2019 to June 2026) with a strict 80/20 chronological
              split - roughly the first five and a half years to learn from, the
              last year and a half held out and never seen. The model averaged
              an R² of{" "}
              <strong className="font-semibold text-fg">
                {s.avgR2.toFixed(2)}
              </strong>{" "}
              on returns and called direction correctly{" "}
              <strong className="font-semibold text-fg">
                {pctf(s.avgDirAccuracy)}
              </strong>{" "}
              of the time - below a coin flip - against{" "}
              <strong className="font-semibold text-fg">
                {pctf(s.avgNaive)}
              </strong>{" "}
              for simply guessing “up” every day, an average edge of{" "}
              <strong className="font-semibold text-fg">
                {signed(s.avgEdge, 2)}
              </strong>{" "}
              that comes from the baseline being weak in this window rather than
              from the model being good. The golden cross ratio was the largest
              weight for {s.maRatioTopFeature} of {s.total} stocks and split{" "}
              {s.maRatioPositive} positive to {s.maRatioNegative} negative. The
              results are consistent with the weak form of the efficient market
              hypothesis.
            </p>
          </div>
        </header>

        {/* Stat cards */}
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {/* Accuracy is the honest headline and is genuinely bad, so it wears
              the negative tone. The edge and the count that follows are
              positive numbers produced by a weak benchmark rather than by
              skill - colouring them green would claim a result the data does
              not support, and red would misstate their sign. They stay neutral
              and let the labels carry the meaning. */}
          <StatCard
            value={pctf(s.avgDirAccuracy)}
            label="average directional accuracy - still under a coin flip"
            tone="neg"
          />
          <StatCard
            value={s.avgR2.toFixed(2)}
            label="average R² on return prediction - at or below zero"
            tone="neg"
          />
          <StatCard
            value={signed(s.avgEdge)}
            label={`average edge vs the always-up baseline of ${pctf(s.avgNaive)} - a weak benchmark, not a strong model`}
          />
          <StatCard
            value={`${s.maRatioTopFeature} of ${s.total}`}
            label="stocks where the golden cross ratio was the model's heaviest feature"
            tone="neg"
          />
        </div>

        {/* ---- 2. The question ---- */}
        <Section id="question" index={2} title="The question">
          <div className="grid gap-6 md:grid-cols-2">
            <CrossDiagram />
            <div className="space-y-4">
              <p>
                Momentum trading rests on a simple claim: that the recent shape
                of a price chart tells you something about where it goes next. If
                that is true, it should be measurable. If it is not, that should
                be measurable too.
              </p>
              <p>
                So it was measured. {s.total} NSE stocks, seven years of daily
                closes, four of the most widely followed technical signals, and a
                strict chronological split so the model is only ever asked about
                days it has genuinely never seen. No discretion, no hand-picked
                examples, no adjusting the method after seeing the answer.
              </p>
              <p>What came back is below.</p>
            </div>
          </div>
        </Section>

        {/* ---- 3. Method ---- */}
        <Section id="method" index={3} title="How the model was built">
          <dl className="rounded-xl border border-line bg-ink-850/50 px-5 py-2">
            <Spec term="Model">
              Linear regression (scikit-learn). Deliberately the simplest thing
              that could work - if an edge needs an elaborate model to appear, it
              is usually the model talking rather than the data.
            </Spec>
            <Spec term="Features">
              <ul className="space-y-1.5">
                <li>
                  <C>ma5</C> - 5-day moving average, the short-term trend
                </li>
                <li>
                  <C>ma20</C> - 20-day moving average, the medium-term trend
                </li>
                <li>
                  <C>ret</C> - the day&apos;s own percentage move
                </li>
                <li>
                  <C>ma_ratio</C> - <C>ma5 / ma20</C>, which turns the golden and
                  death cross into one continuous number. Above 1.0 the fast
                  average leads (golden cross territory), below 1.0 it lags
                  (death cross territory), and the distance from 1.0 is how
                  emphatic the signal is.
                </li>
              </ul>
            </Spec>
            <Spec term="Training window">
              June 2019 to June 2026 - roughly 1,750 trading days per stock.
              Seven years rather than two, deliberately: it buys a test set of
              around {Math.round(s.avgTestDays)} days instead of 96, and it spans
              several different markets rather than one. The COVID crash, the
              2021 recovery, the 2022-23 rate-hike cycle and what followed are
              all in there, so a result cannot be an artifact of a single mood.
            </Spec>
            <Spec term="Split">
              First 80% of days train, last 20% test, in date order and never
              shuffled.
              <span className="mt-3 block overflow-x-auto rounded-lg border border-line bg-ink-900 px-3 py-2.5 font-mono text-[11px] text-fg-dim">
                [←── TRAIN 80% (Jun 2019 → Jan 2025) ──|── TEST 20% (Feb 2025 →
                Jun 2026) ──→]
              </span>
              <span className="mt-3 block">
                Shuffling a time series leaks twice over: it lets the model study
                2026 before being quizzed on 2019, and it separates
                near-identical neighbours - a 20-day average on consecutive days
                shares nineteen of its twenty inputs - so the test set becomes
                rows the model has effectively already seen.
              </span>
            </Spec>
            <Spec term="Scaling">
              <C>StandardScaler</C> fitted on the training rows only. The scaler
              learns a mean and a spread; if it learns them from the whole
              dataset, the test period&apos;s distribution is baked into the
              training transform. That is the same leak wearing a quieter
              disguise.
            </Spec>
            <Spec term="Target">
              Tomorrow&apos;s return, not tomorrow&apos;s price. Predicting the
              price level scores an R² near 0.9 almost automatically, because
              prices barely move overnight - measured directly here, the price
              model scored {ex.priceModel.r2.toFixed(2)} while a “tomorrow equals
              today” guess needing no model at all scored{" "}
              {ex.naiveModel.r2.toFixed(2)}. That number flatters
              autocorrelation, not skill. Returns strip the head start away.
            </Spec>
            <Spec term="Evaluation">
              R² on returns, directional accuracy, and the edge over an
              always-guess-up baseline. Every score is judged against that
              baseline rather than against zero, because in a rising market
              “up” is a genuinely hard benchmark.
            </Spec>
          </dl>

          <h3 className="pt-4 text-[15px] font-semibold text-fg">
            What “fitting a model” actually means
          </h3>
          <p>
            With one feature, linear regression draws a line through the data.
            With two, it fits a flat plane: for every combination of the two
            inputs the plane gives the model&apos;s answer, and the vertical
            distance from each real day up or down to that surface is the error
            the fitting process is trying to make as small as possible. Adding
            features keeps the idea and loses the picture - with four, the
            surface lives in four dimensions and cannot be drawn at all.
          </p>
          <p>
            Below is a two-feature slice of the real fit: <C>ma5</C> and{" "}
            <C>ma20</C> on the floor, the actual next-day return as height, and
            the fitted plane through them, holding the other two features at
            their averages. It is a slice of the actual model rather than a
            separate one, so the tilt you see is the tilt the model really has.
            Drag to rotate.
          </p>

          <div className="rounded-xl border border-line bg-ink-850/50 p-3">
            <Hyperplane3D
              data={ex.returnModel.testPeriodData}
              weights={{
                ma5: ex.returnModel.featureWeights?.ma5 ?? 0,
                ma20: ex.returnModel.featureWeights?.ma20 ?? 0,
                bias: ex.returnModel.featureWeights?.bias ?? 0,
              }}
            />
            <p className="mt-3 text-[12px] leading-relaxed text-fg-dim">
              The plane is what the model believes: for any pairing of
              short-term and medium-term trend, this is the return it expects.
              The dots are what those days actually did. Watch how little the
              plane tilts as you rotate it - that flatness is the same result as
              the near-zero coefficients, viewed from another angle. A model
              holding real signal would tilt steeply with the dots hugging it
              closely. Here the surface is nearly level and the days scatter far
              above and below.
            </p>
          </div>
        </Section>

        {/* ---- 4. Findings ---- */}
        <Section id="findings" index={4} title="What the data showed">
          <p>
            The model explained essentially nothing. Average R² on next-day
            returns was{" "}
            <strong className="font-semibold text-fg">
              {s.avgR2.toFixed(4)}
            </strong>
            . R² is the share of variation in tomorrow&apos;s move that the model
            accounts for, where zero means none at all - and this sits below
            zero, meaning that on average the model did slightly worse than
            predicting the same average return every single day.
          </p>

          <R2Histogram
            data={r2Data}
            aboveZero={r2AboveZero}
            total={s.total}
          />

          <p>
            Direction told the same story. The model called up-or-down correctly{" "}
            <strong className="font-semibold text-fg">
              {pctf(s.avgDirAccuracy)}
            </strong>{" "}
            of the time; guessing “up” every day scored{" "}
            <strong className="font-semibold text-fg">{pctf(s.avgNaive)}</strong>
            . Read the first number on its own: after seven years of training,
            the model still calls tomorrow&apos;s direction correctly less than
            half the time. The nominal edge of{" "}
            <strong className="font-semibold text-fg">
              {signed(s.avgEdge, 2)}
            </strong>{" "}
            - and {s.positiveEdge} of {s.total} stocks clearing their own
            baseline - comes from the benchmark being unusually weak here, not
            from the model being good. The test window was close to flat, so
            “always guess up” only scored {pctf(s.avgNaive)}, and beating a poor
            benchmark while sitting below a coin flip is not skill. On the chart
            below, the cluster straddles the diagonal rather than sitting above
            it.
          </p>

          <AccuracyScatter
            data={scatter}
            above={beats}
            below={s.total - beats}
          />

          <p>
            The golden cross earned nothing. <C>ma_ratio</C> was the heaviest
            weight for{" "}
            <strong className="font-semibold text-fg">
              {s.maRatioTopFeature} of {s.total}
            </strong>{" "}
            stocks - not one - and its average absolute weight was{" "}
            {s.avgAbsMaRatioWeight.toFixed(4)}, close enough to zero that the
            model is effectively ignoring it. Its sign split{" "}
            {s.maRatioPositive} positive to {s.maRatioNegative} negative.
          </p>
          <p>
            That split is the tell. A signal carrying real directional
            information would push the same way for nearly every stock - golden
            cross territory meaning the same thing for Infosys as for Britannia -
            and would earn a weight large enough to matter. Instead the
            coefficient points whichever way each stock&apos;s own noise happens
            to lean, at a magnitude the model barely acts on. That is what a
            variable with nothing to say looks like once it is fitted.
          </p>

          <MaRatioSigns
            positive={s.maRatioPositive}
            negative={s.maRatioNegative}
            total={s.total}
          />

          <p className="text-[14px]">
            One caveat belongs with those coefficients rather than in a footnote.{" "}
            <C>ma_ratio</C> is <C>ma5 / ma20</C>, a deterministic function of two
            features already in the model. Near-redundant predictors let a linear
            fit trade large offsetting weights between them without changing a
            single prediction, so the individual coefficients are unstable and a
            large one would not by itself prove the cross signal matters. That
            cuts both ways, which is why the argument above leans on directional
            accuracy against the baseline rather than on the weights alone.
          </p>

          {large && small && (
            <p>
              Momentum is documented to bite harder in smaller, less closely
              watched companies, so the universe was split by size. It barely
              mattered. Large caps ({large.n} stocks) averaged{" "}
              {signed(large.avgEdge, 2)} edge at {pctf(large.avgDirAccuracy)}{" "}
              accuracy; small caps ({small.n} stocks){" "}
              {signed(small.avgEdge, 2)} at {pctf(small.avgDirAccuracy)}.
              {small.avgEdge > large.avgEdge
                ? " Small caps come out ahead on nominal edge, which is the direction the literature predicts - but their directional accuracy is indistinguishable from the large caps, so the gap is baseline drift rather than a momentum premium."
                : " Small caps do not come out ahead, which is the opposite of what the literature predicts, and their directional accuracy is indistinguishable from the large caps either way."}{" "}
              Ranked stock by stock, the bars land on both sides of zero in
              roughly the proportion chance would give.
            </p>
          )}

          <EdgeRanked
            data={edgeData}
            negative={negativeEdge}
            total={s.total}
            avgTestDays={Math.round(s.avgTestDays)}
            noiseBand={2 * se * 100}
          />

          <p className="text-[14px]">
            None of the individual results are large enough to lean on. With
            about {Math.round(s.avgTestDays)} test days per stock, the standard
            error on any single accuracy figure is roughly {pctf(se)}, so
            anything inside about ±{pctf(2 * se, 0)} is indistinguishable from
            luck - and ranking {s.total} stocks guarantees a few clear that bar
            by chance alone. The green bars at the top of the ranking are what
            sampling variation looks like, not a shortlist.
          </p>

          <p className="text-[14px]">
            The one number that does hold still is directional accuracy. Across
            every cut of this data - by market cap, by feature weight, stock by
            stock - it sits within a point or so of {pctf(s.avgDirAccuracy)},
            just under a coin flip, through a stretch of market that included a
            crash, a recovery, a rate-hike cycle and its aftermath. The edge
            figure moves around with whatever the benchmark happened to do; the
            accuracy does not move at all.
          </p>
        </Section>

        {/* ---- 5. Worked example ---- */}
        <Section id="worked" index={5} title="A worked example - Reliance">
          <p>
            The aggregates above hide the single most useful thing this project
            turned up, so here is one stock in full. Reliance, same pipeline,
            trained on {ex.trainDateRange.start} to {ex.trainDateRange.end} and
            scored on the {testDays} trading days from {ex.testDateRange.start}{" "}
            to {ex.testDateRange.end}.
          </p>
          <p>
            Two models were fitted on identical features and an identical split.
            The only difference is what they were asked to predict: one
            tomorrow&apos;s <em>price</em>, the other tomorrow&apos;s{" "}
            <em>return</em>. Alongside both sits the rule that requires no model
            at all - assume tomorrow closes where today closed.
          </p>

          <div className="thin-scroll -mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-right">
                  <th className="py-2 text-left text-[11px] font-medium uppercase tracking-wider text-fg-dim">
                    Test-set score
                  </th>
                  <th className="px-2 py-2 text-[11px] font-medium uppercase tracking-wider text-fg-dim">
                    Price model
                  </th>
                  <th className="px-2 py-2 text-[11px] font-medium uppercase tracking-wider text-accent">
                    Naive · tomorrow = today
                  </th>
                  <th className="px-2 py-2 text-[11px] font-medium uppercase tracking-wider text-fg-dim">
                    Return model
                  </th>
                </tr>
              </thead>
              <tbody className="tnum">
                {[
                  [
                    "MAE",
                    `₹${ex.priceModel.mae.toFixed(2)}`,
                    `₹${ex.naiveModel.mae.toFixed(2)}`,
                    ex.returnModel.mae.toFixed(4),
                  ],
                  [
                    "RMSE",
                    `₹${ex.priceModel.rmse.toFixed(2)}`,
                    `₹${ex.naiveModel.rmse.toFixed(2)}`,
                    ex.returnModel.rmse.toFixed(4),
                  ],
                  [
                    "R²",
                    ex.priceModel.r2.toFixed(4),
                    ex.naiveModel.r2.toFixed(4),
                    ex.returnModel.r2.toFixed(4),
                  ],
                  [
                    "Directional accuracy",
                    pctf(ex.priceModel.dirAccuracy),
                    pctf(ex.naiveModel.dirAccuracy),
                    pctf(ex.returnModel.dirAccuracy),
                  ],
                ].map(([label, a, b, c]) => (
                  <tr
                    key={label}
                    className="border-b border-line/60 text-right last:border-b-0"
                  >
                    <th
                      scope="row"
                      className="py-2.5 text-left text-[13px] font-medium text-fg-muted"
                    >
                      {label}
                    </th>
                    <td className="px-2 py-2.5 text-fg">{a}</td>
                    <td className="px-2 py-2.5 font-semibold text-accent">{b}</td>
                    <td className="px-2 py-2.5 text-fg">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[13px] text-fg-dim">
            MAE and RMSE for the first two columns are in rupees and directly
            comparable. The return model predicts a fraction, so its errors are
            on a different scale - only its R² and direction can be read across.
          </p>

          <p>
            Read the middle column first. The price model scores an R² of{" "}
            <strong className="font-semibold text-fg">
              {ex.priceModel.r2.toFixed(4)}
            </strong>{" "}
            - the kind of number that ends a project early. But doing nothing at
            all scores{" "}
            <strong className="font-semibold text-accent">
              {ex.naiveModel.r2.toFixed(4)}
            </strong>
            , which is <em>higher</em>, with an average error of ₹
            {ex.naiveModel.mae.toFixed(2)} against the model&apos;s ₹
            {ex.priceModel.mae.toFixed(2)} - about{" "}
            {Math.round((1 - ex.naiveModel.mae / ex.priceModel.mae) * 100)}% less
            error, for no model. On direction it is ahead too,{" "}
            {pctf(ex.naiveModel.dirAccuracy)} against{" "}
            {pctf(ex.priceModel.dirAccuracy)}.
          </p>
          <p>
            That is the whole trap in one row. A price-level R² near{" "}
            {ex.priceModel.r2.toFixed(2)} is not measuring forecasting skill, it
            is measuring that Reliance costs about the same today as it did
            yesterday. Any model handed today&apos;s price inherits that for
            free. Judged against zero it looks brilliant; judged against the only
            benchmark that matters, it is worse than not bothering.
          </p>

          <PriceFit
            data={ex.pricePeriodData}
            span={`${ex.testDateRange.start} → ${ex.testDateRange.end}`}
          />

          <h3 className="pt-2 text-[15px] font-semibold text-fg">
            Predicted against actual
          </h3>
          <p>
            The standard way to judge any regression is to plot every prediction
            against what actually happened. A flawless model would put every
            point on the 45° diagonal, where predicted equals actual; how far the
            cloud drifts off that line is the error. Below are the same{" "}
            {testDays} days, the same four features and the same algorithm,
            plotted twice. Only the question changed.
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
                  prediction, and it is nothing of the kind - the model is
                  answering with approximately today&apos;s price, and prices
                  move very little overnight. What looks like accuracy here is
                  autocorrelation wearing accuracy&apos;s clothes.
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
                  This is the shape of no predictive power. Horizontally the
                  cloud barely moves - every prediction sits within half a
                  percent of zero. Vertically it covers the whole range of what
                  actually happened. Genuine skill would tilt this into a
                  diagonal cloud following the reference line. A vertical band
                  means the predictions carry no information about which way the
                  day went.
                </>
              }
            />
          </div>

          <p>
            Those two pictures are the finding in its cleanest form. Same model,
            same inputs, same days - the difference is entirely in whether the
            target still contains the answer.
          </p>

          <ResidualPlot
            data={residuals}
            span={`${ex.testDateRange.start} → ${ex.testDateRange.end}`}
          />

          <p>
            The return model is the honest reframing of the same question. Strip
            out the free head start and ask only which way tomorrow moves, and R²
            falls to{" "}
            <strong className="font-semibold text-fg">
              {ex.returnModel.r2.toFixed(4)}
            </strong>{" "}
            - just under zero, meaning it explains none of tomorrow&apos;s
            variation. Its directional accuracy of{" "}
            {pctf(ex.returnModel.dirAccuracy)} against a{" "}
            {pctf(ex.returnModel.naiveDirAccuracy ?? 0)} baseline is the same
            near-nothing the other {s.total - 1} stocks show.
          </p>

          <ReturnFit
            data={ex.returnModel.testPeriodData ?? []}
            span={`${ex.testDateRange.start} → ${ex.testDateRange.end}`}
          />

          <p>
            Those two charts are the same model, the same features and the same{" "}
            {testDays} days, drawn twice. Put them side by side and the first
            looks like a triumph while the second looks like a failure - and that
            reading is exactly backwards.
          </p>
          <p>
            The price chart plots a <em>level</em>. To land on tomorrow&apos;s
            price near ₹{Math.round(meanClose).toLocaleString("en-IN")}, a model
            only has to notice that today&apos;s price is near ₹
            {Math.round(meanClose).toLocaleString("en-IN")}, so the orange line
            traces the blue one almost perfectly. But the quantity it has to get
            right is enormous compared with the amount that actually changes
            overnight: it is scoring well on the ₹
            {Math.round(meanClose).toLocaleString("en-IN")} it was handed, not on
            the ₹{Math.round(meanClose * meanAbsMove)} it was asked to
            anticipate. Tight tracking is guaranteed by the question, not earned
            by the answer.
          </p>
          <p>
            The return chart plots a <em>change</em>, which deletes the part the
            model was given for free and leaves only the part in dispute. Now the
            blue line swings between roughly {actualLo.toFixed(1)}% and +
            {actualHi.toFixed(1)}% while the orange one never leaves a band of
            about {predBand.toFixed(1)}% around zero. Nothing broke between the
            two pictures - the second simply removed the scaffolding and showed
            what was holding the first one up.
          </p>
          <p>
            A flat prediction is also the mathematically correct response to
            having no signal. Least squares minimises squared error; when the
            inputs carry nothing that anticipates the target, the error-minimising
            guess is the training mean, and the mean daily move of a large stock
            is close to zero. So the model converges on “about nothing, again
            today”. That is not the model giving up - it is the model being right
            about how little it knows.
          </p>

          <h3 className="pt-2 text-[15px] font-semibold text-fg">
            What the model actually learned
          </h3>
          <p>
            A linear regression makes its prediction by multiplying each feature
            by a weight and adding the results up, so the weights are a direct
            readout of what it leaned on. A large weight means the feature moved
            the answer; a weight near zero means the model looked at that
            feature and found nothing worth using.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <WeightBars
              title="Price model weights"
              data={priceBars}
              domain={weightDomain}
              rawUnit="rupees"
              caption={
                <>
                  The price model leans hard on <C>{heaviestPriceFeature}</C> -
                  not because a short moving average predicts tomorrow&apos;s
                  direction, but because it stands in for today&apos;s price,
                  which is most of the answer to “what will the price be
                  tomorrow”. The big bar is the autocorrelation shortcut showing
                  up in the coefficients: a symptom of the trap, not evidence of
                  skill.
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
                  On the identical axis, every bar collapses to a sliver you have
                  to look for. Same data, same features, same algorithm - only
                  the target changed, and with it the model&apos;s confidence.
                  Asked the honest question, it assigns weights near zero across
                  the board, which is the model reporting that these four inputs
                  tell it nothing dependable about tomorrow.
                </>
              }
            />
          </div>
          <p className="rounded-xl border border-line bg-ink-850/50 px-5 py-4 text-[14px]">
            <strong className="font-semibold text-fg">
              Why this example is here.
            </strong>{" "}
            Reporting the {ex.priceModel.r2.toFixed(2)} and stopping would have
            produced a far more impressive-looking project. The reason it is not
            reported that way is that R² answers “how much variance did you
            explain”, not “are you useful”, and on an autocorrelated series those
            two questions come apart completely. Choosing the benchmark before
            looking at the score is what keeps the difference visible.
          </p>
        </Section>

        {/* ---- 6. Conclusion ---- */}
        <Section id="conclusion" index={6} title="The conclusion">
          <p className="rounded-xl border border-line bg-ink-850/50 px-5 py-4 text-[15px]">
            These results are what the weak form of the efficient market
            hypothesis predicts. Information sitting in the public price history
            is already reflected in the price. Moving averages and lagged returns
            are the most heavily studied indicators in existence, and any edge
            they carried would have been competed away long before it reached a
            seven-year sample of NSE names. For short-term technical trading that
            is a genuinely discouraging finding - the signals most retail traders
            watch carried nothing exploitable at a one-day horizon here. For
            long-term fundamental investing it changes nothing, because that
            approach never depended on forecasting tomorrow. It depends on buying
            a good business at a fair price and waiting, which is a different
            claim on a different timescale, and one this experiment does not
            test.
          </p>
        </Section>

        {/* ---- 7. EMH ---- */}
        <Section
          id="emh"
          index={7}
          title="Why this happens - the Efficient Market Hypothesis"
        >
          <p>
            The weak form of the efficient market hypothesis makes a narrow
            claim: everything knowable from a stock&apos;s past prices is already
            reflected in what it costs today. If some shape in the chart reliably
            preceded a rise, buyers would move ahead of it until the profit was
            gone. The pattern does not vanish - it just stops paying.
          </p>
          <p>
            Moving averages and the golden cross are the extreme case of this.
            They are simple to compute, taught everywhere, and watched by
            millions of people with real money, alongside professional desks
            running the same arithmetic on faster hardware with better execution.
            An edge that survived all of that and was still sitting in seven
            years of daily NSE closes, waiting to be found by a linear
            regression, would be genuinely surprising. These results say it was
            not there, which is the unglamorous and expected answer.
          </p>
          <p>
            None of which means momentum never works. At institutional scale,
            with transaction costs near zero and execution measured in
            milliseconds, edges far too small to see here can compound into real
            money - and over three to twelve months, cross-sectional momentum is
            one of the better-replicated findings in finance. The claim being
            made is deliberately specific: these four features, in a linear
            model, on daily data, across this universe, offer nothing a retail
            investor could exploit at human speed once real costs are paid.
          </p>
        </Section>

        {/* ---- 8. Long-term investing ---- */}
        <Section
          id="investing"
          index={8}
          title="What this means for long-term investing"
        >
          <p>
            The finding is narrow, and it is worth being precise about what it
            does and does not touch. What has been ruled out is a one-day
            forecast built from price history alone. That is the timescale
            short-term technical trading operates on, and on this universe it
            came up empty.
          </p>
          <p>
            Long-term investing makes a different bet on a different quantity. It
            asks whether a business earns well, reinvests well and is priced
            reasonably against those earnings - questions answered by margins,
            debt, cash flow and promoter holding rather than by the shape of a
            chart. None of those inputs appear anywhere in this model, so nothing
            here confirms or refutes them. What the study does establish is that
            the alternative most often offered as a substitute for reading a
            business carried no information at this horizon. Ruling out the
            shortcut is not the same as validating the long route, and this page
            claims only the first.
          </p>
          <p>
            The honest summary is asymmetric: a negative result about daily
            momentum, and silence about everything else.
          </p>
        </Section>

        {/* ---- 9. Personal ---- */}
        <Section id="why" index={9} title="Why I built this">
          <div className="space-y-4 rounded-xl border border-line bg-ink-850/70 px-6 py-6 text-[15px] leading-[1.8]">
            <p>Three things I care about happened to meet in this project.</p>
            <p>
              I have been interested in markets since studying equity research
              through BugleRock Capital, where I first ran into the argument
              between fundamental analysis and technical trading - between people
              who read balance sheets and people who read price charts. I wanted
              to know which one the data actually backs, rather than which one
              theory prefers.
            </p>
            <p>
              I have also always liked mathematics, particularly the moments when
              something abstract - a bit of statistics, a bit of linear algebra -
              turns out to answer a real question honestly rather than
              comfortably. Machine learning sat exactly where that interest met
              finance.
            </p>
            <p>
              And I wanted to understand ML properly rather than superficially:
              not call a library and repeat whatever it printed, but know what
              the algorithm was fitting, why each evaluation metric means what it
              means, and what the numbers were really saying about the data
              underneath.
            </p>
            <p>
              So I picked a question with a testable answer and a universe I
              could get clean data for: do the momentum signals retail traders
              lean on actually predict anything at a one-day horizon? Choosing
              the benchmark and the metric before running anything mattered more
              than any modelling decision that came after.
            </p>
            <p>
              The answer that came back - R² at zero, directional accuracy a
              shade worse than a coin flip, the golden cross weighted at almost
              nothing and pointing inconsistently - was not a failure. It was the
              correct answer to the question I asked. Finding out that something
              does not work is exactly what research is for, and it is a great
              deal more useful than a result that looks impressive because
              something leaked.
            </p>
          </div>
        </Section>

        {/* ---- 10. Limitations + next ---- */}
        <Section
          id="limits"
          index={10}
          title="Honest limitations, and what comes next"
        >
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="text-[15px] font-semibold text-fg">
                Where this study is weak
              </h3>
              <div className="mt-3">
                <Bullets
                  items={[
                    <>
                      <strong className="font-medium text-fg">
                        Seven years is short for this question.
                      </strong>{" "}
                      Roughly 1,750 trading days per stock, about{" "}
                      {Math.round(s.avgTestDays)} of them held out for testing.
                      That covers several different markets, which is the
                      minimum needed for a result not to be an artifact of one
                      mood - but momentum research in practice runs on decades,
                      not years. The published cross-sectional momentum work
                      spans multiple market cycles and often a century of
                      equity data, precisely because effects this small only
                      separate from noise over very long samples. A seven-year
                      window can show that a signal is not obviously there. It
                      cannot rule out one that is small, slow, and real.
                    </>,
                    <>
                      <strong className="font-medium text-fg">
                        A linear model only.
                      </strong>{" "}
                      If momentum works through thresholds or interactions - a
                      golden cross that matters only in calm conditions, say - a
                      straight-line fit cannot see it, and would report exactly
                      the null found here.
                    </>,
                    <>
                      <strong className="font-medium text-fg">
                        Two uncorrected demergers.
                      </strong>{" "}
                      <C>auto_adjust</C> repairs splits and bonus issues but not
                      demergers. Raymond (May 2025) and Tata Motors (October
                      2025) each show a one-day fall of 65% and 40% that is a
                      corporate action, not a market move, and both land inside
                      the test period. They are reported rather than patched, and
                      they add noise to two of {s.total} stocks.
                    </>,
                    <>
                      <strong className="font-medium text-fg">
                        Price returns, not total returns.
                      </strong>{" "}
                      Dividends are excluded, so real holding-period returns
                      would be higher for the payers.
                    </>,
                    <>
                      <strong className="font-medium text-fg">
                        No transaction costs.
                      </strong>{" "}
                      This flatters the momentum side. A strategy trading daily
                      signals would surrender much of any edge to brokerage,
                      slippage and short-term tax - so breaking even here means
                      losing money in practice.
                    </>,
                    <>
                      <strong className="font-medium text-fg">
                        An efficiently priced universe.
                      </strong>{" "}
                      Mostly large and mid-cap NSE names, among the most closely
                      analysed stocks in the market. Finding no edge where the
                      theory most expects none is a weaker result than finding
                      none in neglected corners.
                    </>,
                  ]}
                />
              </div>
            </div>

            <div>
              <h3 className="text-[15px] font-semibold text-fg">
                What I would explore next
              </h3>
              <div className="mt-3">
                <Bullets
                  items={[
                    <>
                      <strong className="font-medium text-fg">
                        A longer horizon.
                      </strong>{" "}
                      One day is the hardest version of this problem. Three- to
                      twelve-month momentum is one of the most replicated results
                      in the literature, and testing whether it survives here -
                      net of costs - would be a better use of the same machinery.
                    </>,
                    <>
                      <strong className="font-medium text-fg">
                        A genuinely small-cap universe.
                      </strong>{" "}
                      The size split hinted at nothing, but {small?.n ?? 26}{" "}
                      small caps is thin, and the documented premium sits in
                      smaller, less liquid, less analysed names than most of
                      these.
                    </>,
                    <>
                      <strong className="font-medium text-fg">
                        Fundamental momentum.
                      </strong>{" "}
                      Earnings-revision trends and analyst upgrades are
                      price-independent signals with real evidence behind them,
                      and they would test the same question without reusing the
                      price history that has already been shown to be exhausted.
                    </>,
                    <>
                      <strong className="font-medium text-fg">
                        Ensemble methods.
                      </strong>{" "}
                      Random forests or gradient boosting would capture structure
                      a linear fit cannot - but only with walk-forward
                      cross-validation, because a flexible model on 1,750 rows
                      will cheerfully memorise noise and report a wonderful
                      score.
                    </>,
                  ]}
                />
              </div>
            </div>
          </div>
        </Section>

        {/* ---- Footer links ---- */}
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-6 text-[13px]">
          <a
            href="#top"
            className="text-fg-muted transition-colors duration-200 hover:text-fg"
          >
            ↑ Back to the top
          </a>
          <a
            href={`${META.repo}/blob/main/results/RESULTS.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-fg-muted transition-colors duration-200 hover:text-fg"
          >
            Full per-stock results
          </a>
          <a
            href={META.repo}
            target="_blank"
            rel="noopener noreferrer"
            className="text-fg-muted transition-colors duration-200 hover:text-fg"
          >
            Source and pipeline on GitHub
          </a>
        </nav>
      </main>

      <SiteFooter
        note="98 NSE stocks · daily closes June 2019 to June 2026 · fixed dataset, reproducible pipeline."
        repo={META.repo}
      />
    </>
  );
}
