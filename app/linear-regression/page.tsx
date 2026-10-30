import TopBar from "../components/TopBar";
import { Reveal, CountUp } from "../components/Motion";
import { Section, Sub, V, StatCard, PaperCTA, SummaryNote, Table, TH, Bullets } from "../components/Page";
import { AccuracyScatter, type ScatterPoint } from "../components/Charts";
import {
  CostLine,
  DrawdownChart,
  EdgeBreakdown,
  GrowthChart,
  QuintileBars,
  RandomHistogram,
  SignalBars,
  SurvivorshipBars,
  SurvivorshipGrowth,
  YearBars,
} from "../components/StrategyCharts";
import { PROJECTS } from "@/lib/project";
import { companyName } from "@/lib/universe";
import { getAllMlSignals, getMlSummary, getWorkedExample } from "@/lib/ml";
import { getStrategy, pct } from "@/lib/strategy";

const META = PROJECTS[0];

export const metadata = { title: META.name, description: META.blurb };

const SECTIONS = [
  { id: "findings", label: "Key findings" },
  { id: "first", label: "The daily forecast" },
  { id: "redesign", label: "Ranking stocks monthly" },
  { id: "survivors", label: "Too good to trust" },
  { id: "result", label: "Results" },
  { id: "survivorship", label: "Survivorship bias" },
  { id: "luck", label: "Luck and leaks" },
  { id: "what", label: "Where it comes from" },
  { id: "limits", label: "Weak points" },
  { id: "verdict", label: "Conclusion" },
];

const STEPS = [
  {
    n: "1",
    title: "Score",
    text: "Every stock gets four price scores: 12-month momentum, closeness to its 52-week high, its position against the 200-day average and a surge in traded volume.",
  },
  {
    n: "2",
    title: "Rank",
    text: "At each month-end the stocks are ranked against each other, using only data available on that date.",
  },
  {
    n: "3",
    title: "Buy",
    text: "The top fifth, about 80 stocks, is bought in equal weights at the next day's close and held for a month.",
  },
  {
    n: "4",
    title: "Pay",
    text: "Every trade pays transaction tax, stamp duty, exchange fees and a bid-ask spread that widens for less liquid stocks.",
  },
];

/** The sample, drawn to scale: warm-up, development and holdout years. */
function Timeline() {
  const parts = [
    { label: "Warm-up", span: "2005 to Feb 2009", years: 4.2, cls: "bg-surface-3 text-ink-muted" },
    { label: "Development", span: "Mar 2009 to Dec 2018", years: 9.8, cls: "bg-accent-soft text-accent-strong" },
    { label: "Holdout, run once", span: "Jan 2019 to Jun 2026", years: 7.5, cls: "bg-[#fef3c7] text-[#92400e]" },
  ];
  return (
    <Reveal className="my-6">
      <div className="flex overflow-hidden rounded-xl border border-line text-[12px]">
        {parts.map((p) => (
          <div key={p.label} className={`${p.cls} min-w-0 px-3 py-2.5`} style={{ flexGrow: p.years, flexBasis: 0 }}>
            <div className="truncate font-semibold">{p.label}</div>
            <div className="truncate opacity-80">{p.span}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-dim">
        The warm-up years supply the 252 trading days of history the signals need. The
        signals were chosen on 2006 to 2018 data, and nothing was fitted to the holdout.
      </p>
    </Reveal>
  );
}

function Findings({ items }: { items: { lead: string; text: React.ReactNode }[] }) {
  return (
    <ol className="space-y-4">
      {items.map((f, i) => (
        <li key={f.lead} className="grid grid-cols-[1.75rem_1fr] gap-x-2">
          <span className="tnum pt-[3px] text-[13px] font-semibold text-accent">{i + 1}</span>
          <p className="text-[15.5px] leading-[1.7] text-ink-muted">
            <strong className="font-semibold text-ink">{f.lead}</strong> {f.text}
          </p>
        </li>
      ))}
    </ol>
  );
}

export default function StrategyStudy() {
  const ml = getMlSummary();
  const all = Object.entries(getAllMlSignals());
  const rel = getWorkedExample();
  const st = getStrategy();
  const h = st.headline.pit.full;
  const hold = st.headline.pit.holdout;
  const dev = st.headline.pit.development;
  const sv = st.headline.survivor.full;
  const g = st.growth.pit;
  const last = (xs: number[]) => xs[xs.length - 1];
  const bias = ((sv.cagr - h.cagr) + (sv.ewCagr - h.ewCagr)) / 2;
  const [yahoo, , full] = st.survivorship;
  const ex = st.data.exits;

  const scatter: ScatterPoint[] = all.map(([id, r]) => ({
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
  const negR2 = all.filter(([, r]) => r.r2Return < 0).length;
  // What a forecast with no information would gain over the always-up rule.
  const coinEdge = (0.5 - ml.avgNaive) * 100;

  const compare = [
    { label: "Strategy", cagr: h.cagr, sharpe: h.sharpe, dd: h.maxDrawdown, strong: true },
    { label: "Nifty500 Momentum 50", cagr: h.mom50Cagr ?? 0, sharpe: h.mom50Sharpe ?? 0, dd: h.mom50MaxDrawdown ?? null, strong: false },
    { label: "Equal-weight benchmark", cagr: h.ewCagr, sharpe: h.ewSharpe, dd: h.ewMaxDrawdown, strong: false },
    { label: "Nifty 500", cagr: h.nifty500Cagr, sharpe: h.nifty500Sharpe, dd: h.nifty500MaxDrawdown, strong: false },
  ];
  const td = "px-3 py-2.5 text-right tnum text-[13.5px]";
  const r2 = (x: number) => x.toFixed(3).replace("-", "−");

  return (
    <>
      <TopBar
        eyebrow="Study 01"
        title={META.name}
        sections={SECTIONS}
        repo={META.repo}
        paper={META.paper}
      />

      <main id="top" className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8">
        {/* ---------------- hero ---------------- */}
        <Reveal>
          <header>
            <p className="eyebrow">Research summary</p>
            <h1 className="mt-2 text-[34px] font-semibold leading-[1.1] tracking-tight text-ink sm:text-[46px]">
              Can price signals beat the Indian market?
            </h1>
            <p className="mt-5 text-[18px] leading-[1.65] text-ink-muted">
              I tested the idea in two ways. A regression that used moving averages to
              forecast each stock&apos;s next-day return did no better than a coin toss.
              A monthly ranking of stocks on similar price signals did beat the market
              after Indian trading costs, and it kept its lead when I rebuilt the market to
              include every company that later failed. The extra return turns out to be
              the momentum premium, which is well documented, rather than anything new.
            </p>
            <SummaryNote paper={META.paper} />
          </header>
        </Reveal>

        <Reveal delay={60}>
          <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              value={<CountUp value={h.cagr * 100} decimals={1} suffix="%" />}
              label="A year, March 2009 to June 2026"
              detail={`Net of costs, on every stock trading at the time. The Nifty 500 returned ${pct(h.nifty500Cagr)}.`}
              tone="accent"
            />
            <StatCard
              value={<CountUp value={hold.activeReturn * 100} decimals={1} prefix="+" suffix="%" />}
              label="A year over the benchmark"
              detail={`In the 2019 to 2026 holdout, which was run once (t = ${hold.activeT.toFixed(2)}).`}
            />
            <StatCard
              value={<CountUp value={bias * 100} decimals={0} prefix="~" suffix=" pts" />}
              label="A year of survivorship bias"
              detail="It lifted the strategy and its benchmark by the same amount."
            />
            <StatCard
              value={<CountUp value={ml.avgDirAccuracy * 100} decimals={1} suffix="%" />}
              label="Daily forecast accuracy"
              detail={`Next-day direction, averaged over ${ml.total} stocks.`}
            />
          </div>
        </Reveal>

        {/* ---------------- key findings ---------------- */}
        <section id="findings" className="mt-11 scroll-mt-24 rounded-xl border border-line bg-surface px-5 py-6 sm:px-7">
          <Reveal>
            <p className="eyebrow">Key findings</p>
            <div className="mt-4">
              <Findings
                items={[
                  {
                    lead: "A daily forecast from moving averages does not work.",
                    text: (
                      <>
                        Across {ml.total}{" "}NSE stocks the average out-of-sample R² was{" "}
                        {r2(ml.avgR2)}{" "}and the model called the next day&apos;s direction
                        right {pct(ml.avgDirAccuracy)}{" "}of the time. No stock was
                        significantly better than 50%.
                      </>
                    ),
                  },
                  {
                    lead: "A high R² on prices is misleading.",
                    text: (
                      <>
                        A model of Reliance&apos;s share price reached an R² of{" "}
                        {rel.priceModel.r2.toFixed(2)}, but simply repeating
                        yesterday&apos;s close scored {rel.naiveModel.r2.toFixed(2)}, and
                        the model got the direction right on only{" "}
                        {pct(rel.priceModel.dirAccuracy, 0)}{" "}of days.
                      </>
                    ),
                  },
                  {
                    lead: "Ranking stocks once a month does work.",
                    text: (
                      <>
                        Holding the top fifth of about {st.data.perMonth}{" "}stocks, ranked on
                        four price signals, returned {pct(h.cagr)}{" "}a year after costs,
                        against {pct(h.ewCagr)}{" "}for an equal-weighted portfolio of the same
                        stocks. In the holdout the lead was{" "}
                        {pct(hold.activeReturn, 1)}{" "}a year (t ={" "}
                        {hold.activeT.toFixed(2)}).
                      </>
                    ),
                  },
                  {
                    lead: "Survivorship bias is large, but it hit both sides equally.",
                    text: (
                      <>
                        Testing only on today&apos;s Nifty 500 added about{" "}
                        {(bias * 100).toFixed(0)}{" "}points a year to the strategy and to its
                        benchmark, so the gap between them stayed at about seven points.
                      </>
                    ),
                  },
                  {
                    lead: "The result is not luck or a coding error.",
                    text: (
                      <>
                        The strategy beat all {st.random.n.toLocaleString("en-IN")}{" "}random
                        portfolios, returns rise steadily from the lowest-ranked fifth of
                        stocks to the highest, and a deliberate look-ahead test behaves as
                        it should.
                      </>
                    ),
                  },
                  {
                    lead: "The edge is momentum, and it sits outside the largest stocks.",
                    text: (
                      <>
                        Once the momentum factor is accounted for, the alpha is{" "}
                        {pct(st.factors.activeAlpha, 1)}{" "}a year (t ={" "}
                        {st.factors.activeAlphaT.toFixed(2)}). NSE&apos;s own momentum
                        index did about as well, and among the 200 most-traded stocks the
                        edge is too small to tell apart from noise.
                      </>
                    ),
                  },
                ]}
              />
            </div>
          </Reveal>
        </section>

        {/* ---------------- 01 the daily forecast ---------------- */}
        <Section
          id="first"
          index={1}
          title="The daily forecast"
          summary="My first model asked whether a stock's recent prices could forecast its return the next day. They could not."
        >
          <p>
            The question came out of an equity research internship, where technical
            trading kept coming up as the alternative to fundamental analysis. Its
            best-known rule is the golden cross: buy when a short moving average rises
            above a long one. I turned that rule into four features for each stock (the
            5-day and 20-day moving averages, the day&apos;s return, and the ratio of the
            two averages, which is above one in the golden-cross state) and fitted one
            least-squares regression per stock for {ml.total}{" "}NSE stocks. Each model was
            estimated on the first 80% of its history, from June 2019, and judged on the
            last 20%, which it had never seen.
          </p>
          <AccuracyScatter data={scatter} above={beats} below={ml.total - beats} />
          <p>
            Over the evaluation days the average R² was {r2(ml.avgR2)}, and {negR2}{" "}of the{" "}
            {ml.total}{" "}stocks had a negative R², which means the model forecast worse than
            a constant would have. Beating the always-up rule for {beats}{" "}stocks sounds
            better than it is. Prices drifted sideways over the test window, so up days
            were in the minority and the always-up rule scored only {pct(ml.avgNaive)}{" "}on
            average. A forecast with no information at all would have beaten it by about{" "}
            {coinEdge.toFixed(1)}{" "}points. No stock&apos;s accuracy was significantly above
            50%, and the moving-average ratio, the feature that encodes the golden cross,
            was never the most important of the four.
          </p>

          <Sub>Why the model forecasts returns, not prices</Sub>
          <p>
            Forecasting tomorrow&apos;s price instead makes the numbers look far better.
            For Reliance Industries, a model with the same features fitted to the next
            day&apos;s close reached an R² of {rel.priceModel.r2.toFixed(3)}. A forecast
            that simply repeats today&apos;s close did better, at{" "}
            {rel.naiveModel.r2.toFixed(3)}, without estimating anything. Prices move
            little from one day to the next, so any forecast close to yesterday&apos;s
            price explains most of their variance whether or not it says anything about
            the change. The fair benchmark for a price forecast is that random walk, and
            on direction, the question a trader cares about, the price model was wrong
            more often than right.
          </p>
          <Table
            minWidth={520}
            head={
              <thead className="border-b border-line bg-surface">
                <tr>
                  <TH align="left">Reliance, {rel.metrics.testDays} evaluation days</TH>
                  <TH>Price model</TH>
                  <TH>Yesterday&apos;s close</TH>
                  <TH>Return model</TH>
                </tr>
              </thead>
            }
            caption="The price and return models use the same four features, the same split and the same estimator; only the target differs. Mean absolute errors are in rupees for the first two columns and in percent of the price for the return model."
          >
            <tbody>
              <tr className="border-b border-line">
                <td className="px-3 py-2.5 text-left text-[13.5px] text-ink-muted">R²</td>
                <td className={`${td} text-ink`}>{r2(rel.priceModel.r2)}</td>
                <td className={`${td} text-ink`}>{r2(rel.naiveModel.r2)}</td>
                <td className={`${td} text-ink`}>{r2(rel.returnModel.r2)}</td>
              </tr>
              <tr className="border-b border-line">
                <td className="px-3 py-2.5 text-left text-[13.5px] text-ink-muted">Mean absolute error</td>
                <td className={`${td} text-ink`}>₹{rel.priceModel.mae.toFixed(1)}</td>
                <td className={`${td} text-ink`}>₹{rel.naiveModel.mae.toFixed(1)}</td>
                <td className={`${td} text-ink`}>{(rel.returnModel.mae * 100).toFixed(2)}%</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 text-left text-[13.5px] text-ink-muted">Direction called right</td>
                <td className={`${td} font-semibold text-ink`}>{pct(rel.priceModel.dirAccuracy)}</td>
                <td className={`${td} text-ink`}>{pct(rel.naiveModel.dirAccuracy)}</td>
                <td className={`${td} text-ink`}>{pct(rel.returnModel.dirAccuracy)}</td>
              </tr>
            </tbody>
          </Table>
        </Section>

        {/* ---------------- 02 ranking ---------------- */}
        <Section
          id="redesign"
          index={2}
          title="Ranking stocks each month"
          summary="Research that does find information in past prices uses it differently. It compares stocks with each other, over months rather than days, and judges the result as a portfolio."
        >
          <p>
            That is the setting in which momentum was first found, and it is how I
            redesigned the study. At each month-end the strategy scores every eligible
            stock, buys the top fifth in equal weights and holds them until the next
            month-end. It is long only, because an investor in India cannot hold a short
            position overnight in the cash market, and it trades at the next day&apos;s
            close, so the price behind a signal is never the price paid.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 60}>
                <div className="h-full rounded-xl border border-line bg-surface px-4 py-4">
                  <span className="tnum text-[12px] font-semibold text-accent">{s.n}</span>
                  <p className="mt-1 text-[16px] font-semibold text-ink">{s.title}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{s.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <p>
            The four signals came from a list of ten, each with a published rationale, and
            were picked by a rule I wrote down before looking at the data: keep any signal
            whose monthly rank correlation with the next month&apos;s return had a
            t-statistic of at least 2 between 2006 and 2018.
          </p>
          <SignalBars signals={st.signals} />
          <p>
            Every choice, including the cost schedule, was committed to GitHub before the
            first backtest, and while the rules were being set the code could not load any
            price after December 2018. One choice did change on the development data. The
            original model weighted the signals with a rolling regression, which put large
            offsetting bets on correlated signals after the 2008 crash, so I replaced it
            with a simple average of the four scores. The holdout was then run once.
          </p>
          <Timeline />
        </Section>

        {/* ---------------- 03 too good ---------------- */}
        <Section
          id="survivors"
          index={3}
          title="A result too good to trust"
          summary={
            <>
              Tested on today&apos;s Nifty 500, the strategy returned <V>{pct(sv.cagr)}</V>{" "}
              a year. The benchmark&apos;s return showed that the data, not the strategy,
              was the reason.
            </>
          }
        >
          <p>
            Over the full sample an equal-weighted portfolio of the same stocks, with no
            signal at all, returned {pct(sv.ewCagr)}{" "}a year, against{" "}
            {pct(sv.nifty500Cagr)}{" "}for the Nifty 500 price index. A portfolio that picks
            nothing should not beat a cap-weighted index by ten points a year for
            seventeen years. The cause is how the list is made. A company is in
            today&apos;s Nifty 500 because it is large today, so companies that were large
            in 2010 and later collapsed, were suspended or were delisted are missing. A
            backtest that starts from today&apos;s list only ever holds the stocks that
            went on to survive.
          </p>
          <p>
            NSE publishes an equal-weight version of the Nifty 500, computed from the
            stocks that were actually in the index on each date, which makes the problem
            measurable. The equal-weighted portfolio of today&apos;s names beat it by{" "}
            {pct(yahoo.ewVsIndex)}{" "}a year, even after paying trading costs that the index
            does not.
          </p>
          <SurvivorshipGrowth
            months={st.growth.months}
            survivorEw={st.growth.survivor.ew}
            pitEw={g.ew}
            indexEw={g.nifty500ew}
          />

          <Sub>Rebuilding the market from NSE&apos;s records</Sub>
          <p>
            To remove the bias I rebuilt the universe from the exchange&apos;s own daily
            files, which list every security that traded in each session from January
            2005 to June 2026. Each month the universe is the 500 most-traded stocks at
            that time, and the usual liquidity checks leave about {st.data.perMonth}.{" "}
            {st.data.stocksEver.toLocaleString("en-IN")}{" "}different stocks pass through it
            over the sample, {st.data.exitsInUniverse}{" "}of which later stopped trading.
          </p>
          <p>
            The exchange&apos;s prices are not adjusted for splits and bonuses, so I
            applied NSE&apos;s corporate action records from 2010 onwards, and before that
            a rule that flags falls close to a standard split ratio, which I checked
            against the records for the years where both exist. A stock that stops trading
            gets a final return of zero after a merger and −30% after a distress
            delisting, the usual convention in the literature. The rebuilt returns match
            Yahoo&apos;s to within one percentage point in {pct(st.data.yahooWithin1pct)}{" "}
            of stock-months since 2010. All of these rules were fixed by checking the data
            alone, before any strategy return on the new universe was computed, and the
            strategy was then rerun once without any change.
          </p>
        </Section>

        {/* ---------------- 04 results ---------------- */}
        <Section
          id="result"
          index={4}
          title="Results on the full market"
          summary={
            <>
              With the failed companies put back, ₹1 invested in March 2009 grew to{" "}
              <V>₹{last(g.strategy).toFixed(1)}</V> by June 2026, against ₹
              {last(g.ew).toFixed(1)}{" "}in the equal-weighted benchmark and ₹
              {last(g.nifty500).toFixed(1)}{" "}in the Nifty 500.
            </>
          }
        >
          <GrowthChart
            months={st.growth.months}
            pit={st.growth.pit}
            survivor={st.growth.survivor}
            holdoutStart="2019-01"
          />
          <p>
            That is {pct(h.cagr)}{" "}a year, against {pct(h.ewCagr)}{" "}for the benchmark and{" "}
            {pct(h.nifty500Cagr)}{" "}for the Nifty 500 total return index, with a Sharpe ratio
            of {h.sharpe.toFixed(2)}{" "}against {h.ewSharpe.toFixed(2)}. The strategy beat its
            benchmark by {pct(h.activeReturn)}{" "}a year over the full sample (t ={" "}
            {h.activeT.toFixed(2)}) and by {pct(hold.activeReturn)}{" "}in the holdout (t ={" "}
            {hold.activeT.toFixed(2)}). The first decade was weaker. From 2009 to 2018 the
            lead was {pct(dev.activeReturn)}{" "}a year, too small to separate from noise,
            although the strategy&apos;s alpha against the benchmark was significant in
            both periods (t = {dev.alphaT.toFixed(2)}{" "}and {hold.alphaT.toFixed(2)}).
          </p>
          <DrawdownChart
            months={st.growth.months}
            strategy={st.drawdown.strategy}
            ew={st.drawdown.ew}
            holdoutStart="2019-01"
            worst={{ strategy: h.maxDrawdown, ew: h.ewMaxDrawdown }}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              value={`${h.sharpe.toFixed(2)} vs ${h.ewSharpe.toFixed(2)}`}
              label="Sharpe ratio"
              detail="The strategy against its equal-weight benchmark, 2009 to 2026."
            />
            <StatCard
              value={h.dsr.toFixed(2)}
              label="Deflated Sharpe ratio"
              detail="The probability the Sharpe ratio reflects skill, allowing for the 20 variants I tested."
            />
            <StatCard
              value={`${pct(h.costDrag)} a year`}
              label="Trading costs"
              detail={`The portfolio turns over about ${Math.round(h.turnover)} times a year.`}
            />
          </div>
        </Section>

        {/* ---------------- 05 survivorship ---------------- */}
        <Section
          id="survivorship"
          index={5}
          title="What survivorship bias cost"
          summary={`Survivorship bias added about ${(bias * 100).toFixed(0)} points a year to every return, but it lifted the strategy and its benchmark by almost exactly the same amount.`}
        >
          <SurvivorshipBars rows={st.survivorship} />
          <p>
            Switching from Yahoo&apos;s prices to NSE&apos;s, with the same list of
            today&apos;s names, barely changed the result, so the data source was not the
            problem. Putting back the stocks that later failed cut the strategy&apos;s
            return by {((yahoo.cagr - full.cagr) * 100).toFixed(1)}{" "}points a year and the
            benchmark&apos;s by {((yahoo.ewCagr - full.ewCagr) * 100).toFixed(1)}.
          </p>
          <p>
            I had expected momentum to suffer more. It buys past winners, and the past
            winners that later collapsed are exactly the stocks a survivors-only list
            leaves out. That did not happen. Of the {ex.exits}{" "}stocks that stopped trading
            after March 2009, only {ex.inStrategy}{" "}were in the strategy&apos;s portfolio
            the month before, and none of those exits was a failure. A company heading for
            trouble loses liquidity long before it stops trading, so it falls out of the
            most-traded stocks, and out of the strategy&apos;s reach, first.
          </p>
        </Section>

        {/* ---------------- 06 luck ---------------- */}
        <Section
          id="luck"
          index={6}
          title="Testing for luck and leaks"
          summary={`Before costs, the strategy's Sharpe ratio was higher than that of every one of ${st.random.n.toLocaleString("en-IN")} random portfolios, and the checks for look-ahead bias came back clean.`}
        >
          <p>
            If the score carries real information, stocks ranked higher should do better
            on average, and not only the top fifth the strategy buys. They do: the average
            monthly return rises across all five fifths, and the score&apos;s monthly rank
            correlation with the next month&apos;s return is {st.skill.full.ic.toFixed(3)}{" "}
            (t = {st.skill.full.icT.toFixed(2)}).
          </p>
          <QuintileBars quintiles={st.quintiles} />
          <RandomHistogram
            edges={st.random.edges}
            counts={st.random.counts}
            strategy={st.random.strategy}
            p95={st.random.p95}
            n={st.random.n}
          />
          <p>
            A backtest can also look good because of a bug that lets tomorrow&apos;s prices
            leak into today&apos;s decisions, so I ran the engine in two ways it should
            fail. Ranking stocks on their actual next-month return, which is cheating on
            purpose, gives a Sharpe ratio of {st.skill.full.canary.toFixed(1)}, as it
            should. Ranking on scores that are a month out of date does slightly worse
            than the live scores, which is what happens when information reaches the
            portfolio on time and not before. A unit test also changes every price after a
            chosen date and confirms that nothing dated earlier moves.
          </p>
        </Section>

        {/* ---------------- 07 what ---------------- */}
        <Section
          id="what"
          index={7}
          title="Where the return comes from"
          summary="The strategy's lead over its benchmark is the momentum premium. Once a momentum factor is accounted for, almost nothing is left."
        >
          <p>
            Regressing the strategy&apos;s return over its benchmark on the standard
            market, size, value and momentum factors for Indian stocks gives a momentum
            loading of {st.factors.activeWml.toFixed(2)}{" "}and an alpha
            of {pct(st.factors.activeAlpha, 1)}{" "}a year, with a t-statistic of{" "}
            {st.factors.activeAlphaT.toFixed(2)}. NSE&apos;s own Nifty500 Momentum 50
            index puts the result in proportion. Over the same period it returned{" "}
            {pct(h.mom50Cagr ?? 0)}{" "}a year with a Sharpe ratio of{" "}
            {(h.mom50Sharpe ?? 0).toFixed(2)}, so the strategy earned a little more at the
            same risk-adjusted return. It lagged the index in the first decade (
            {pct(dev.cagr)}{" "}against {pct(dev.mom50Cagr ?? 0)}) and led it in the holdout (
            {pct(hold.cagr)}{" "}against {pct(hold.mom50Cagr ?? 0)}).
          </p>
          <Table
            minWidth={520}
            head={
              <thead className="border-b border-line bg-surface">
                <tr>
                  <TH align="left">March 2009 to June 2026</TH>
                  <TH>Return a year</TH>
                  <TH>Sharpe ratio</TH>
                  <TH>Worst drawdown</TH>
                </tr>
              </thead>
            }
            caption="The strategy and the benchmark are net of costs. The two indices are NSE Indices' total return series, which pay no costs, and the momentum index's history before its 2024 launch was back-calculated by NSE."
          >
            <tbody>
              {compare.map((r) => (
                <tr key={r.label} className="border-b border-line last:border-0">
                  <td className={`px-3 py-2.5 text-left text-[13.5px] ${r.strong ? "font-semibold text-ink" : "text-ink-muted"}`}>
                    {r.label}
                  </td>
                  <td className={`${td} ${r.strong ? "font-semibold text-accent" : "text-ink"}`}>{pct(r.cagr)}</td>
                  <td className={`${td} text-ink`}>{r.sharpe.toFixed(2)}</td>
                  <td className={`${td} text-ink-muted`}>{r.dd === null ? "-" : pct(r.dd)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p>
            So the study does not find a new anomaly. What it shows is that a
            well-documented premium survives Indian trading costs, a one-day delay in
            execution and a correction for survivorship, in a form that a long-only
            investor could actually hold.
          </p>
        </Section>

        {/* ---------------- 08 limits ---------------- */}
        <Section
          id="limits"
          index={8}
          title="Weak points"
          summary="The edge is concentrated in mid-sized and less liquid stocks, it suffers in sharp market rebounds, and some real costs are left out."
        >
          <EdgeBreakdown
            groups={[
              {
                title: "Within liquidity thirds",
                rows: st.terciles.map((t) => ({ label: t.label, value: t.active, t: t.activeT })),
              },
              {
                title: "By size of universe",
                rows: st.universeSize.map((u) => ({ label: `${u.label} stocks`, value: u.active, t: u.activeT })),
              },
            ]}
          />
          <p>
            Within the most liquid third of the universe the strategy beats that
            third&apos;s own benchmark by only {pct(st.terciles[0].active)}{" "}a year,
            against {pct(st.terciles[1].active)}{" "}in the middle third. Restricting the
            universe to the 200 most-traded stocks cuts the lead to{" "}
            {pct(st.universeSize[0].active)}, and widening it to 1,000 raises it to{" "}
            {pct(st.universeSize[2].active)}. Earlier research has found the same thing:
            momentum is stronger among smaller stocks.
          </p>
          <YearBars rows={st.byYear} />
          <p>
            Momentum strategies are known to crash when the market turns sharply upwards
            after a fall, because the most beaten-down stocks rebound first and a momentum
            portfolio does not own them. That is what happened in 2009, and on a smaller
            scale in 2025.
          </p>
          <CostLine rows={st.costs} breakEven={h.breakEven} />
          <p>
            Costs take {pct(h.costDrag)}{" "}a year, and the strategy would still beat its
            benchmark at well above today&apos;s cost schedule. Two real costs are not
            modelled, though: short-term capital gains tax, at 20% on positions held for
            under a year, and the price impact of large orders. Both would hurt most in
            the less liquid stocks, where the edge is largest.
          </p>

          <Sub>Limits of the evidence</Sub>
          <Bullets
            items={[
              <>
                <V>The holdout had been seen before the rerun.</V>{" "}The survivorship-free
                test used the strategy exactly as fixed, but its holdout years were no
                longer unseen, so it is a replication rather than a second out-of-sample
                test.
              </>,
              <>
                <V>The signals were not chosen blind.</V>{" "}They came from a literature that
                already documents momentum, including Indian evidence that covers part of
                the holdout.
              </>,
              <>
                <V>The data rules involve judgement.</V>{" "}Some exit types are inferred from
                each stock&apos;s own record, a handful of pre-2010 splits in then-illiquid
                stocks remain unadjusted, and about one dividend record in ten after 2010
                gives no amount.
              </>,
              <>
                <V>The universe is not quite the Nifty 500.</V>{" "}It ranks stocks by traded
                value rather than market capitalisation, and the October 2024 cost schedule
                is applied to the whole sample.
              </>,
            ]}
          />
        </Section>

        {/* ---------------- 09 conclusion ---------------- */}
        <Section
          id="verdict"
          index={9}
          title="Conclusion"
          summary="Price signals say nothing useful about tomorrow, but ranked against each other once a month they capture the momentum premium, after costs and without survivorship bias."
        >
          <p>
            For anyone backtesting Indian stocks, the clearest lesson is about the data.
            Testing on today&apos;s list of large companies would have added about{" "}
            {(bias * 100).toFixed(0)}{" "}points a year to every return in the study. The
            natural next steps are a universe ranked by market capitalisation, tax and
            market-impact costs, signals that do not come from prices, such as earnings
            revisions, and a forward test that records the strategy&apos;s holdings each
            month from July 2026.
          </p>
          <PaperCTA paper={META.paper} repo={META.repo}>
            The paper sets out the full method, every statistical test, the data rules and
            the limitations. The repository has the code and data that reproduce every
            number on this page.
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
