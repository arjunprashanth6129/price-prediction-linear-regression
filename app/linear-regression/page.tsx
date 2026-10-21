import TopBar from "../components/TopBar";
import { Reveal, CountUp } from "../components/Motion";
import { Section, V, StatCard, PaperCTA, SummaryNote, Table, TH, Bullets } from "../components/Page";
import { AccuracyScatter, type ScatterPoint } from "../components/Charts";
import {
  EdgeBreakdown,
  GrowthChart,
  RandomHistogram,
  SignalBars,
  SurvivorshipBars,
  YearBars,
} from "../components/StrategyCharts";
import { PROJECTS } from "@/lib/project";
import { companyName } from "@/lib/universe";
import { getAllMlSignals, getMlSummary } from "@/lib/ml";
import { getStrategy, pct } from "@/lib/strategy";

const META = PROJECTS[0];

export const metadata = { title: META.name, description: META.blurb };

const SECTIONS = [
  { id: "first", label: "The first attempt" },
  { id: "redesign", label: "The redesign" },
  { id: "result", label: "The result" },
  { id: "survivorship", label: "Survivorship bias" },
  { id: "luck", label: "Luck or skill?" },
  { id: "what", label: "What it is" },
  { id: "limits", label: "Where it breaks" },
  { id: "verdict", label: "Verdict" },
];

const STEPS = [
  { n: "1", title: "Score", text: "Four price signals: 12-month momentum, distance from the 52-week high, the 200-day trend, a volume surge." },
  { n: "2", title: "Rank", text: "Every month-end, across the 400 most-traded NSE stocks at the time." },
  { n: "3", title: "Buy", text: "The top fifth, equal weight, at the next day's close. Long only." },
  { n: "4", title: "Pay", text: "STT, stamp duty, exchange fees and the spread, on every trade." },
];

export default function StrategyStudy() {
  const ml = getMlSummary();
  const all = Object.entries(getAllMlSignals());
  const st = getStrategy();
  const h = st.headline.pit.full;
  const hold = st.headline.pit.holdout;
  const dev = st.headline.pit.development;
  const g = st.growth.pit;
  const last = (xs: number[]) => xs[xs.length - 1];
  const surv = st.headline.survivor.full;
  const bias = ((surv.cagr - h.cagr) + (surv.ewCagr - h.ewCagr)) / 2;

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

  const compare = [
    { label: "Strategy", cagr: h.cagr, sharpe: h.sharpe, dd: h.maxDrawdown, strong: true },
    { label: "Nifty500 Momentum 50", cagr: h.mom50Cagr ?? 0, sharpe: h.mom50Sharpe ?? 0, dd: h.mom50MaxDrawdown ?? null, strong: false },
    { label: "Equal-weight benchmark", cagr: h.ewCagr, sharpe: h.ewSharpe, dd: h.ewMaxDrawdown, strong: false },
    { label: "Nifty 500", cagr: h.nifty500Cagr, sharpe: h.nifty500Sharpe, dd: h.nifty500MaxDrawdown, strong: false },
  ];
  const td = "px-3 py-2.5 text-right tnum text-[13.5px]";

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
            <p className="mt-5 text-[18px] leading-[1.6] text-ink-muted">
              Forecasting tomorrow failed. Ranking stocks once a month worked, after
              costs, and it survived a test that put back every company that later
              failed.
            </p>
            <SummaryNote paper={META.paper} />
          </header>
        </Reveal>

        <Reveal delay={60}>
          <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              value={<CountUp value={h.cagr * 100} decimals={1} suffix="%" />}
              label="A year, 2009 to 2026"
              detail={`Net of costs, survivorship-free. Nifty 500: ${pct(h.nifty500Cagr)}.`}
              tone="accent"
            />
            <StatCard
              value={<CountUp value={hold.activeReturn * 100} decimals={1} prefix="+" suffix="%" />}
              label="A year over the benchmark"
              detail={`In the 2019-2026 holdout, run once. t = ${hold.activeT.toFixed(2)}.`}
            />
            <StatCard
              value={<CountUp value={bias * 100} decimals={0} prefix="~" suffix=" pts" />}
              label="Survivorship bias removed"
              detail="It inflated the strategy and its benchmark alike."
            />
            <StatCard
              value={<CountUp value={ml.avgDirAccuracy * 100} decimals={1} suffix="%" />}
              label="First attempt's accuracy"
              detail="Next-day direction. A coin toss."
            />
          </div>
        </Reveal>

        {/* ---------------- 01 first attempt ---------------- */}
        <Section
          id="first"
          index={1}
          title="The first attempt: forecast tomorrow"
          summary={
            <>
              One regression per stock on four moving-average features, {ml.total}{" "}
              NSE stocks. Out of sample it called the next day right{" "}
              {pct(ml.avgDirAccuracy)} of the time.
            </>
          }
        >
          <AccuracyScatter data={scatter} above={beats} below={ml.total - beats} />
          <p>
            Beating the always-up rule meant nothing: up days were scarce in the test
            window, so a coin would have beaten it by more. No stock was significantly
            better than 50%. Part I of the paper has the full test.
          </p>
        </Section>

        {/* ---------------- 02 redesign ---------------- */}
        <Section
          id="redesign"
          index={2}
          title="The redesign: rank stocks, every month"
          summary="Stop forecasting one stock. Compare all of them, buy the strongest, pay real costs."
        >
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
          <SignalBars signals={st.signals} />
          <p>
            Every rule was committed to git before the first backtest. The 2019-2026
            holdout was opened once.
          </p>
        </Section>

        {/* ---------------- 03 result ---------------- */}
        <Section
          id="result"
          index={3}
          title="The result"
          summary={
            <>
              ₹1 in March 2009 became <V>₹{last(g.strategy).toFixed(1)}</V>, against ₹
              {last(g.nifty500).toFixed(1)} in the Nifty 500.
            </>
          }
        >
          <GrowthChart
            months={st.growth.months}
            pit={st.growth.pit}
            survivor={st.growth.survivor}
            holdoutStart="2019-01"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              value={`${h.sharpe.toFixed(2)} vs ${h.ewSharpe.toFixed(2)}`}
              label="Sharpe ratio"
              detail="Strategy against the equal-weight benchmark."
            />
            <StatCard
              value={`${pct(h.maxDrawdown, 0)} vs ${pct(h.ewMaxDrawdown, 0)}`}
              label="Worst drawdown"
              detail="Shallower than the benchmark's."
            />
            <StatCard
              value={`${pct(h.costDrag)} a year`}
              label="Trading costs paid"
              detail={`Survives up to ${h.breakEven.toFixed(1)}x the real cost schedule.`}
            />
          </div>
        </Section>

        {/* ---------------- 04 survivorship ---------------- */}
        <Section
          id="survivorship"
          index={4}
          title="Survivorship bias, measured"
          summary="Today's Nifty 500 holds only survivors. Putting the failures back cut returns by about 8 points a year. The gap didn't move."
        >
          <SurvivorshipBars rows={st.survivorship} />
          <p>
            The fix: every NSE daily price file since 2005, corporate actions from
            NSE&apos;s own records, and a final return for each of the{" "}
            {st.data.exitsInUniverse} stocks that stopped trading. Where both sources
            exist, {pct(st.data.yahooWithin1pct)} of stock-months match Yahoo to within a
            point.
          </p>
        </Section>

        {/* ---------------- 05 luck ---------------- */}
        <Section
          id="luck"
          index={5}
          title="Luck, or skill?"
          summary={`Better than all ${st.random.n.toLocaleString("en-IN")} random portfolios, in every period.`}
        >
          <RandomHistogram
            edges={st.random.edges}
            counts={st.random.counts}
            strategy={st.random.strategy}
            n={st.random.n}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              value={`t = ${st.skill.full.icT.toFixed(2)}`}
              label="Signal strength"
              detail="Monthly rank correlation of the score with next month's return."
            />
            <StatCard
              value={h.dsr.toFixed(2)}
              label="Deflated Sharpe ratio"
              detail="Probability of skill, allowing for 20 variants tried."
            />
            <StatCard
              value="Passes"
              label="Look-ahead test"
              detail={`Cheating on purpose scores a Sharpe of ${st.skill.full.canary.toFixed(1)}. The real engine doesn't.`}
            />
          </div>
        </Section>

        {/* ---------------- 06 what ---------------- */}
        <Section
          id="what"
          index={6}
          title="What it is: momentum"
          summary={
            <>
              Control for the momentum factor and the edge disappears (alpha{" "}
              {pct(st.factors.activeAlpha, 1, true)}, t = {st.factors.activeAlphaT.toFixed(2)}).
              NSE&apos;s own momentum index did about as well.
            </>
          }
        >
          <Table
            minWidth={520}
            head={
              <thead className="border-b border-line bg-surface">
                <tr>
                  <TH align="left">March 2009 to June 2026</TH>
                  <TH>A year</TH>
                  <TH>Sharpe</TH>
                  <TH>Worst drawdown</TH>
                </tr>
              </thead>
            }
            caption="Net of costs for the strategy and the benchmark. The indices are NSE Indices' total return series, which pay no costs; their history before 2024 was back-calculated by NSE."
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
            Not a new anomaly. A known premium, held long only, after Indian costs, with
            no survivorship bias.
          </p>
        </Section>

        {/* ---------------- 07 limits ---------------- */}
        <Section
          id="limits"
          index={7}
          title="Where it breaks"
          summary="The edge lives outside the largest stocks, and momentum crashes in sharp rebounds."
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
          <YearBars rows={st.byYear} />
          <Bullets
            items={[
              <>
                <V>2009 to 2018 alone is weak:</V> {pct(dev.activeReturn, 1, true)} a year over
                the benchmark, t = {dev.activeT.toFixed(2)}.
              </>,
              <>
                <V>Not modelled:</V> 20% short-term capital gains tax and the price impact
                of large orders.
              </>,
              <>
                <V>A replication, not a new test:</V> the holdout had been seen before the
                survivorship-free rerun.
              </>,
            ]}
          />
        </Section>

        {/* ---------------- 08 verdict ---------------- */}
        <Section
          id="verdict"
          index={8}
          title="Verdict"
          summary="Price signals don't predict tomorrow. Ranked monthly, they capture the momentum premium, after costs and without survivorship bias."
        >
          <PaperCTA paper={META.paper} repo={META.repo}>
            The paper has the full method, the daily regression in detail, every test,
            the data rules and the limitations.
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
