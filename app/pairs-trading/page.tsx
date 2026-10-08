import TopBar from "../components/TopBar";
import { Reveal } from "../components/Motion";
import { Section, V, StatCard, PaperCTA, SummaryNote } from "../components/Page";
import {
  AnnualChart,
  CostChart,
  EquityChart,
  ExitWaterfall,
  PairMechanism,
} from "../components/PairsCharts";
import { PROJECTS } from "@/lib/project";
import {
  breakEvenBps,
  getAnnual,
  getCostSensitivity,
  getExamplePair,
  getExits,
  getPairsEquity,
  getPairsMeta,
  getPairsSummary,
} from "@/lib/pairs";

const META = PROJECTS[2];

export const metadata = { title: META.name, description: META.blurb };

const SECTIONS = [
  { id: "strategy", label: "The strategy" },
  { id: "pnl", label: "P&L by exit type" },
  { id: "equity", label: "Performance" },
  { id: "years", label: "Year by year" },
  { id: "costs", label: "Transaction costs" },
  { id: "conclusion", label: "Conclusion" },
];

export default function PairsTrading() {
  const m = getPairsMeta();
  const s = getPairsSummary();
  const eq = getPairsEquity();
  const cost = getCostSensitivity();
  const example = getExamplePair();
  const exits = getExits();
  const annual = getAnnual();
  const be = breakEvenBps();

  const signed = (v: number, d = 2) => `${v >= 0 ? "+" : ""}${v.toFixed(d)}%`;
  const mult = (v: number) => `${(1 + v / 100).toFixed(2)}x`;
  const inr = (v: number) =>
    `${v < 0 ? "-" : ""}₹${Math.abs(Math.round(v)).toLocaleString("en-IN")}`;
  const n = s.trades.n_trades;
  const ex = Object.fromEntries(exits.map((e) => [e.reason, e]));
  const gross = exits.reduce((a, e) => a + e.gross, 0);
  const costs = exits.reduce((a, e) => a + e.cost, 0);
  const avgRev = ex.reverted.gross / ex.reverted.n;
  const avgStop = ex.stop.gross / ex.stop.n;
  const grossBps = (gross / n / 100_000) * 10_000;
  const fullYears = annual.filter((r) => r.days > 200);
  const posYears = fullYears.filter((r) => r.gross > 0).length;
  const rate = s.neutrality_net;

  return (
    <>
      <TopBar
        eyebrow="Applied 01"
        title="Pairs-trading backtester"
        sections={SECTIONS}
        repo={META.repo}
        paper={META.paper}
      />

      <main id="top" className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8">
        {/* ---------------- hero ---------------- */}
        <Reveal>
          <header>
            <p className="eyebrow">Research summary</p>
            <h1 className="mt-2 text-[32px] font-semibold leading-[1.12] tracking-tight text-ink sm:text-[42px]">
              Cointegration-based pairs trading in {m.traded.length} Indian bank
              stocks
            </h1>
            <p className="mt-5 text-[17px] leading-[1.7] text-ink-muted">
              Pairs of bank stocks that moved together over the past year were
              traded on the bet that they would keep doing so. Over nine and a half
              years the strategy returned{" "}
              <V>{signed(s.gross["ann_return_%"])} a year before costs</V> and{" "}
              <V>{signed(s.net["ann_return_%"])} after</V>. It was market-neutral,
              but the relationships it traded broke down more often than they
              held.
            </p>
            <SummaryNote paper={META.paper} />
          </header>
        </Reveal>

        <Reveal delay={60}>
          <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              value={signed(s.gross["ann_return_%"])}
              label="Annual return, before costs"
              detail={`${mult(s.gross["total_return_%"])} over the whole period. Not distinguishable from zero.`}
            />
            <StatCard
              value={signed(s.net["ann_return_%"])}
              label="Annual return, after costs"
              detail={`${mult(s.net["total_return_%"])}, at ${m.bps_per_leg} bps per leg.`}
            />
            <StatCard
              value={`${ex.stop.n} of ${n}`}
              label="Trades stopped out"
              detail={`Against ${ex.reverted.n} that converged.`}
            />
            <StatCard
              value={rate.beta_to_market.toFixed(3)}
              label="Beta to the Nifty 50"
              detail={`The market explains ${(rate.r_squared * 100).toFixed(1)}% of the daily variance.`}
              tone="accent"
            />
          </div>
        </Reveal>

        {/* ---------------- 01 strategy ---------------- */}
        <Section
          id="strategy"
          index={1}
          title="The strategy"
          summary={
            <>
              Every six months, all {m.candidate_pairs} pairs of banks are tested
              for cointegration on the past year, and up to {m.max_pairs} that pass
              are traded for the next six months on a fixed rule.
            </>
          }
        >
          {example && (
            <PairMechanism
              example={example}
              entryZ={m.entry_z}
              exitZ={m.exit_z}
              stopZ={m.stop_z}
            />
          )}
          <p>
            Two stocks are cointegrated when a fixed combination of their prices,
            the spread, keeps returning to its mean. That is a stronger condition
            than correlation, and it is the one a convergence trade needs. Each
            pair is tested with the Engle-Granger procedure on {m.formation_months}{" "}
            months of prices, which also fix the hedge ratio and the spread&apos;s
            mean and standard deviation. In the following {m.trading_months}{" "}
            months, the strategy sells the spread when its z-score rises above +
            {m.entry_z} and buys it below -{m.entry_z}, and closes when the spread
            comes back within {m.exit_z}, moves beyond {m.stop_z}, or has been open
            for {m.max_holding_days}{" "}days. Nothing is re-estimated during trading,
            signals are executed at the next day&apos;s close, and every leg pays{" "}
            {m.bps_per_leg} basis points. The chart shows HDFC Bank against Kotak
            Mahindra Bank in the first window.
          </p>
        </Section>

        {/* ---------------- 02 pnl ---------------- */}
        <Section
          id="pnl"
          index={2}
          title="Where the profit and loss came from"
          summary="Converged trades made money, but more trades were stopped out, and their losses cancelled the gains almost exactly."
        >
          <ExitWaterfall exits={exits} />
          <p>
            The {ex.reverted.n} trades that converged earned{" "}
            {inr(ex.reverted.gross)} before costs, and the {ex.stop.n} that were
            stopped out lost {inr(Math.abs(ex.stop.gross))}. What was left,{" "}
            {inr(gross)}, was less than half of the {inr(costs)} paid in costs. A
            converged trade earned {inr(avgRev)} on average and a stopped trade
            lost {inr(-avgStop)}, so converged trades needed to be at least{" "}
            {((-avgStop / (avgRev - avgStop)) * 100).toFixed(1)}% of the two for
            the strategy to break even before costs. They were{" "}
            <V>
              {((ex.reverted.n / (ex.reverted.n + ex.stop.n)) * 100).toFixed(1)}%
            </V>
            . A pair that passed a cointegration test over one year was weak
            evidence that the relationship would hold over the following weeks,
            and the strength of the test result did not predict which pairs
            would.
          </p>
        </Section>

        {/* ---------------- 03 equity ---------------- */}
        <Section
          id="equity"
          index={3}
          title="Performance over time"
          summary={
            <>
              The gross return of {signed(s.gross["ann_return_%"])} a year is not
              distinguishable from zero, and it is below the risk-free rate.
            </>
          }
        >
          <EquityChart gross={eq.gross} net={eq.net} drawdown={eq.drawdown_net} />
          <p>
            The mean daily return before costs has a Newey-West t-statistic of
            0.67 (p = 0.50). Because even the gross return is below the 6%
            risk-free rate, the Sharpe ratio is negative before and after costs.
            Holding the same {m.traded.length} banks in equal weights returned{" "}
            {signed(s.benchmark_universe["ann_return_%"])} a year over the same
            days, with far larger swings.
          </p>
        </Section>

        {/* ---------------- 04 years ---------------- */}
        <Section
          id="years"
          index={4}
          title="Year by year"
          summary={
            <>
              Profitable before costs in {posYears} of {fullYears.length} full
              years. The losses came in two episodes: the 2020 sell-off and one
              crowded bet in early 2025.
            </>
          }
        >
          <AnnualChart rows={annual} />
          <p>
            In the COVID-19 sell-off of 2020, bank stocks fell by very different
            amounts, and two pairs did most of the damage: Axis Bank against
            Federal Bank was stopped out six times for ₹20,810, and IndusInd Bank
            against IDFC First Bank lost ₹20,500 over seven trades.
          </p>
          <p>
            In early 2025, four of the five pairs selected had Kotak Mahindra Bank
            as one leg, and all four were opened on 21 January, each short Kotak.
            They were stopped out within days of each other in March and lost
            ₹44,660 between them, about as much as the strategy&apos;s entire
            gross profit of ₹46,368 over nine and a half years. The selection rule
            places no limit on how many pairs share a stock, so four positions
            were in effect one bet.
          </p>
        </Section>

        {/* ---------------- 05 costs ---------------- */}
        <Section
          id="costs"
          index={5}
          title="Transaction costs"
          summary={
            <>
              The strategy breaks even at{" "}
              {be ? `${be.toFixed(1)} bps` : "below the grid"} per leg, about half
              the assumed cost, and even at zero cost it earns less than cash.
            </>
          }
        >
          <CostChart rows={cost} assumed={m.bps_per_leg} breakEven={be} />
          <p>
            Costs are linear in the rate, so every point on the curve is exact.
            The mean trade earned {grossBps.toFixed(0)} basis points of its
            notional before costs, while a round trip at {m.bps_per_leg} bps per
            leg costs 40. Cheaper execution would help, but not enough: at zero
            cost the return is {signed(s.gross["ann_return_%"])} a year.
          </p>
        </Section>

        {/* ---------------- 06 conclusion ---------------- */}
        <Section
          id="conclusion"
          index={6}
          title="Conclusion"
          summary="The strategy worked as a hedge and failed as a source of return."
        >
          <p>
            Regressing the daily after-cost return on the Nifty 50 gives a beta of{" "}
            <V>{rate.beta_to_market.toFixed(3)}</V>: a 1% move in the index goes
            with a {Math.abs(rate.beta_to_market * 100).toFixed(1)} bps move in the
            strategy, so the long-short construction removed market exposure as
            intended. What failed was persistence. Spreads that converged did so
            at about the speed the formation period predicted, but more than half
            of the trades were stopped out first, and neither the formation
            p-value nor repeated selection identified the pairs that would hold.
          </p>
          <PaperCTA paper={META.paper} repo={META.repo}>
            The paper has the full method and its look-ahead controls, the tests
            behind each result, convergence speed trade by trade, outcomes by
            formation p-value, the pairs selected most often, an implementation
            error found during validation and how it changed the results, and the
            limitations.
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
