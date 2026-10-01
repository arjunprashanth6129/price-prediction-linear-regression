import TopBar from "../components/TopBar";
import { Reveal } from "../components/Motion";
import { Section, Sub, V, C, StatCard, Note, Table, TH, Bullets } from "../components/Page";
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
  getByPvalue,
  getCostSensitivity,
  getExamplePair,
  getExits,
  getPairsEquity,
  getPairsMeta,
  getPairsSummary,
  getReversion,
  getTopPairs,
} from "@/lib/pairs";

const META = PROJECTS[2];

export const metadata = { title: META.name, description: META.blurb };

const SECTIONS = [
  { id: "result", label: "Performance" },
  { id: "selection", label: "Pair selection" },
  { id: "rules", label: "Trading rules" },
  { id: "pnl", label: "P&L by exit type" },
  { id: "formation", label: "Formation estimates" },
  { id: "equity", label: "By period" },
  { id: "costs", label: "Transaction costs" },
  { id: "neutral", label: "Market exposure" },
  { id: "bug", label: "Error correction" },
  { id: "limits", label: "Limitations" },
];

const REASON_LABEL: Record<string, string> = {
  reverted: "Converged within the exit band",
  stop: "Stopped out at the stop level",
  timeout: "Timed out at 60 days",
  window_end: "Trading period ended",
};

export default function PairsTrading() {
  const m = getPairsMeta();
  const s = getPairsSummary();
  const eq = getPairsEquity();
  const cost = getCostSensitivity();
  const example = getExamplePair();
  const top = getTopPairs();
  const exits = getExits();
  const annual = getAnnual();
  const byP = getByPvalue();
  const rev = getReversion();
  const be = breakEvenBps();

  const pct = (v: number, d = 2) => `${v.toFixed(d)}%`;
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
  const costBps = (costs / n / 100_000) * 10_000;
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
      />

      <main id="top" className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8">
        <Reveal>
          <header>
            <p className="eyebrow">Applied system</p>
            <h1 className="mt-2 text-[32px] font-semibold leading-[1.12] tracking-tight text-ink sm:text-[42px]">
              Cointegration-based pairs trading in {m.traded.length} Indian bank
              stocks
            </h1>
            <p className="mt-5 text-[17px] leading-[1.7] text-ink-muted">
              Every six months, all {m.candidate_pairs} pairs of banks are tested
              for cointegration on the preceding {m.formation_months} months, and
              up to {m.max_pairs} pairs that pass are traded over the following{" "}
              {m.trading_months} months on a fixed z-score rule. Over{" "}
              {s.net.days.toLocaleString("en-IN")} out-of-sample trading days from{" "}
              {m.oos_start} to {m.oos_end}, the strategy returned{" "}
              <V>{signed(s.gross["ann_return_%"])} a year before costs</V> and{" "}
              <V>{signed(s.net["ann_return_%"])} after costs</V>; the gross return
              is not significantly different from zero. Converged trades were
              profitable, but stop-outs were more frequent and offset almost all
              of their gains.
            </p>
          </header>
        </Reveal>

        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            value={signed(s.gross["ann_return_%"])}
            label="Annual return, before costs"
            detail={`${mult(s.gross["total_return_%"])} over the whole period.`}
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
            detail={`R² ${rate.r_squared.toFixed(3)}.`}
            tone="accent"
          />
        </div>

        {/* ---------------- 1. result ---------------- */}
        <Section id="result" index={1} title="Result">
          <p>
            The strategy lost money after costs. Before costs it returned{" "}
            {signed(s.gross["ann_return_%"])} a year, below the 6% risk-free
            rate, so its Sharpe ratio is negative in both columns. The mean daily
            return before costs has a Newey-West t-statistic of 0.67 (p = 0.50),
            so it is not distinguishable from zero. An equal-weighted buy-and-hold
            position in the same {m.traded.length} banks returned{" "}
            {signed(s.benchmark_universe["ann_return_%"])} a year over the same
            days, with substantially higher volatility and drawdown.
          </p>

          <Table
            minWidth={560}
            head={
              <thead>
                <tr className="border-b border-line">
                  <TH align="left">Measure</TH>
                  <TH>Before costs</TH>
                  <TH>After costs</TH>
                  <TH>Hold the banks</TH>
                  <TH>Nifty 50</TH>
                </tr>
              </thead>
            }
            caption={`Costs are ${m.bps_per_leg} bps per leg, charged on both legs at entry and again at exit. Sharpe uses a 6% risk-free rate.`}
          >
            <tbody className="tnum">
              {[
                ["Growth of 1", mult(s.gross["total_return_%"]), mult(s.net["total_return_%"]), mult(s.benchmark_universe["total_return_%"]), mult(s.benchmark_nifty["total_return_%"])],
                ["Annualised", signed(s.gross["ann_return_%"]), signed(s.net["ann_return_%"]), signed(s.benchmark_universe["ann_return_%"]), signed(s.benchmark_nifty["ann_return_%"])],
                ["Volatility", pct(s.gross["ann_vol_%"]), pct(s.net["ann_vol_%"]), pct(s.benchmark_universe["ann_vol_%"]), pct(s.benchmark_nifty["ann_vol_%"])],
                ["Sharpe", s.gross.sharpe.toFixed(2), s.net.sharpe.toFixed(2), s.benchmark_universe.sharpe.toFixed(2), s.benchmark_nifty.sharpe.toFixed(2)],
                ["Max drawdown", pct(s.gross["max_drawdown_%"]), pct(s.net["max_drawdown_%"]), pct(s.benchmark_universe["max_drawdown_%"]), pct(s.benchmark_nifty["max_drawdown_%"])],
              ].map(([k, a, b, c, d]) => (
                <tr key={k} className="border-b border-line/70 text-right">
                  <th scope="row" className="py-2.5 text-left text-[13px] font-medium text-ink-muted">
                    {k}
                  </th>
                  <td className="px-2 py-2.5 text-ink">{a}</td>
                  <td className="px-2 py-2.5 font-semibold text-ink">{b}</td>
                  <td className="px-2 py-2.5 text-ink-dim">{c}</td>
                  <td className="px-2 py-2.5 text-ink-dim">{d}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>

        {/* ---------------- 2. selection ---------------- */}
        <Section id="selection" index={2} title="Pair selection">
          <p>
            The sample is divided into {m.n_windows} windows. Each consists of a{" "}
            {m.formation_months}-month formation period, in which pairs are
            selected and all parameters estimated, followed by a{" "}
            {m.trading_months}-month trading period in which those parameters are
            applied unchanged. Windows advance by {m.trading_months} months, so
            the trading periods do not overlap.
          </p>
          <p>
            Pairs are selected with the two-step Engle-Granger procedure: the
            hedge ratio β is estimated by regressing one price on the other, and
            the residual is tested for a unit root with an augmented Dickey-Fuller
            test. A pair is retained at p ≤ {m.pvalue_threshold}, at most{" "}
            {m.max_pairs} per window, lowest p-value first. Cointegration is a
            stricter condition than correlation: two stocks can have daily returns
            with a correlation of 0.99 and still diverge without bound if one has
            a slightly higher drift. The test suite includes that case and checks
            that Engle-Granger rejects it.
          </p>
          <p>
            Across all windows, {s.selection.pair_windows} pair-windows were
            selected from {s.selection.unique_pairs} distinct pairs, with a median
            p-value of {s.selection.median_pvalue?.toFixed(3)} and a median
            half-life of {s.selection.median_half_life_days?.toFixed(1)} days.
          </p>

          <Table
            minWidth={480}
            head={
              <thead>
                <tr className="border-b border-line">
                  <TH align="left">Pair</TH>
                  <TH>Windows selected</TH>
                  <TH>Median p-value</TH>
                  <TH>Median half-life</TH>
                </tr>
              </thead>
            }
            caption="The pairs selected most often. The half-life is the number of trading days for a deviation to halve, estimated by regressing the daily change in the formation spread on its lagged level."
          >
            <tbody className="tnum">
              {top.slice(0, 6).map((p) => (
                <tr key={p.pair} className="border-b border-line/70 text-right">
                  <th scope="row" className="py-2.5 text-left text-[13px] font-medium text-ink-muted">
                    {p.pair.replace(/\.NS/g, "").replace("~", " / ")}
                  </th>
                  <td className="px-2 py-2.5 text-ink">{p.times_selected}</td>
                  <td className="px-2 py-2.5 text-ink-muted">{p.median_pvalue.toFixed(3)}</td>
                  <td className="px-2 py-2.5 text-ink-muted">{p.median_half_life.toFixed(1)} days</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>

        {/* ---------------- 3. rules ---------------- */}
        <Section id="rules" index={3} title="Trading rules">
          <p>
            In the trading period the spread is <C>y - βx</C> and the z-score is
            its deviation from the formation-period mean in units of the
            formation-period standard deviation. Each position has a gross
            notional of ₹1 lakh across its two legs, and costs of{" "}
            {m.bps_per_leg} bps per leg are charged at entry and at exit.
          </p>

          <Table
            minWidth={420}
            head={
              <thead>
                <tr className="border-b border-line">
                  <TH align="left">Condition</TH>
                  <TH align="left">Action</TH>
                </tr>
              </thead>
            }
          >
            <tbody>
              {[
                [`z above +${m.entry_z}`, "Short the spread: sell y, buy β units of x"],
                [`z below -${m.entry_z}`, "Long the spread: buy y, sell β units of x"],
                [`|z| back inside ${m.exit_z}`, "Close, converged"],
                [`|z| beyond ${m.stop_z}`, "Close, stopped out"],
                [`Open ${m.max_holding_days} trading days`, "Close, timed out"],
                ["Trading period ends", "Close at the last bar"],
                [`Flat and |z| already beyond ${m.stop_z}`, "Do not enter"],
              ].map(([c, a]) => (
                <tr key={c} className="border-b border-line/70">
                  <th scope="row" className="tnum py-2.5 text-left text-[13px] font-medium text-ink">
                    {c}
                  </th>
                  <td className="px-3 py-2.5 text-[13px] text-ink-muted">{a}</td>
                </tr>
              ))}
            </tbody>
          </Table>

          {example && (
            <PairMechanism
              example={example}
              entryZ={m.entry_z}
              exitZ={m.exit_z}
              stopZ={m.stop_z}
            />
          )}

          <Sub>Controls against look-ahead</Sub>
          <p>
            Three mechanisms prevent trading-period data from entering any
            decision, and each is covered by a test that fails when the mechanism
            is removed. The hedge ratio, mean and standard deviation are computed
            by a single function that receives only formation data. The z-score
            function takes the mean and standard deviation as arguments, so a
            spread cannot be standardised against its own statistics. Signals
            computed from one day&apos;s close are executed at the next day&apos;s
            close.
          </p>
        </Section>

        {/* ---------------- 4. P&L ---------------- */}
        <Section id="pnl" index={4} title="Where the P&L came from">
          <p>
            Decomposing the P&amp;L by exit type accounts for the result. The{" "}
            {ex.reverted.n} trades that converged earned {inr(ex.reverted.gross)}{" "}
            before costs and the {ex.stop.n} that were stopped out lost{" "}
            {inr(ex.stop.gross)}. The remaining {inr(gross)} was less than half of
            the {inr(costs)} paid in costs.
          </p>

          <ExitWaterfall exits={exits} />

          <Table
            minWidth={620}
            head={
              <thead>
                <tr className="border-b border-line">
                  <TH align="left">How it ended</TH>
                  <TH>Trades</TH>
                  <TH>Gross P&amp;L</TH>
                  <TH>Costs</TH>
                  <TH>Net P&amp;L</TH>
                  <TH>Median days</TH>
                </tr>
              </thead>
            }
          >
            <tbody className="tnum">
              {exits.map((e) => (
                <tr key={e.reason} className="border-b border-line/70 text-right">
                  <th scope="row" className="py-2.5 text-left text-[13px] font-medium text-ink-muted">
                    {REASON_LABEL[e.reason]}
                  </th>
                  <td className="px-2 py-2.5 text-ink">{e.n}</td>
                  <td className="px-2 py-2.5 text-ink">{inr(e.gross)}</td>
                  <td className="px-2 py-2.5 text-ink-dim">{inr(e.cost)}</td>
                  <td className="px-2 py-2.5 font-semibold text-ink">{inr(e.net)}</td>
                  <td className="px-2 py-2.5 text-ink-dim">{e.median_hold}</td>
                </tr>
              ))}
            </tbody>
          </Table>

          <p>
            A converged trade earned {inr(avgRev)} on average and a stopped trade
            lost {inr(-avgStop)}. At these payoffs, converged trades must make up
            at least {((-avgStop / (avgRev - avgStop)) * 100).toFixed(1)}% of
            converged and stopped trades combined for the strategy to break even
            before costs. The realised share was{" "}
            {((ex.reverted.n / (ex.reverted.n + ex.stop.n)) * 100).toFixed(1)}%,
            which is not significantly different from that threshold.
          </p>
        </Section>

        {/* ---------------- 5. formation ---------------- */}
        <Section id="formation" index={5} title="What the formation estimates predicted">
          <Sub>Speed of convergence</Sub>
          <p>
            For the {rev.n} trades that converged, the median holding period was{" "}
            {rev.median_hold} days against a median formation half-life of{" "}
            {rev.median_half_life.toFixed(1)} days, a ratio of{" "}
            {rev.median_hold_over_half_life.toFixed(2)}. From the median entry at
            |z| = {rev.median_entry_abs_z.toFixed(2)} to the exit at {m.exit_z},
            the deviation must decline by a factor of{" "}
            {(rev.median_entry_abs_z / m.exit_z).toFixed(1)}, which takes{" "}
            {Math.log2(rev.median_entry_abs_z / m.exit_z).toFixed(1)} half-lives.
            Conditional on convergence, spreads reverted at approximately the
            rate estimated in the formation period.
          </p>

          <Sub>Persistence of the relationship</Sub>
          <p>
            {((ex.stop.n / n) * 100).toFixed(0)}% of trades were stopped out. If
            the formation p-value measured how reliable a pair&apos;s relationship
            would be, a smaller p-value should be associated with fewer
            stop-outs. The stop-out rate does not decline with the p-value, and a
            χ² test of independence gives χ²(2) = 3.40, p = 0.18.
          </p>

          <Table
            minWidth={480}
            head={
              <thead>
                <tr className="border-b border-line">
                  <TH align="left">Formation p-value</TH>
                  <TH>Trades</TH>
                  <TH>Stopped out</TH>
                  <TH>Converged</TH>
                  <TH>Avg gross P&amp;L</TH>
                </tr>
              </thead>
            }
            caption="Within the pairs that pass the 0.05 threshold, the p-value carries no detectable information about outcomes in the following six months."
          >
            <tbody className="tnum">
              {byP.map((r) => (
                <tr key={r.lo} className="border-b border-line/70 text-right">
                  <th scope="row" className="py-2.5 text-left text-[13px] font-medium text-ink-muted">
                    {r.lo} to {r.hi}
                  </th>
                  <td className="px-2 py-2.5 text-ink">{r.n}</td>
                  <td className="px-2 py-2.5 text-ink">{(r.stop_rate * 100).toFixed(1)}%</td>
                  <td className="px-2 py-2.5 text-ink-muted">{(r.reverted_rate * 100).toFixed(1)}%</td>
                  <td className="px-2 py-2.5 text-ink-muted">{inr(r.avg_gross)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>

        {/* ---------------- 6. equity ---------------- */}
        <Section id="equity" index={6} title="Performance by period">
          <EquityChart gross={eq.gross} net={eq.net} drawdown={eq.drawdown_net} />
          <p>
            Before costs the strategy was profitable in {posYears} of{" "}
            {fullYears.length} full calendar years. The losses are concentrated
            in two episodes.
          </p>
          <AnnualChart rows={annual} />
          <p>
            <V>2020.</V> During the COVID-19 sell-off, bank stocks fell by very
            different amounts. Axis Bank against Federal Bank was stopped out six
            times during the year, and IndusInd Bank against IDFC First Bank lost
            over seven trades.
          </p>
          <p>
            <V>January to June 2025.</V> Four of the five pairs selected on the
            2024 formation period had Kotak Mahindra Bank as a leg. On 21 January
            2025 three of them entered on the same day, each short Kotak against a
            public-sector bank, and all three were stopped out on 24 March for
            about ₹12,000 each. The three positions amounted to a single exposure
            to Kotak. The window lost ₹43,737 before costs, approximately the
            strategy&apos;s entire gross profit over nine and a half years.
          </p>
          <Note>
            The selection rule does not limit how many selected pairs share a
            stock. In 7 of the {m.n_windows} windows, one bank was a leg of three
            or more selected pairs.
          </Note>
        </Section>

        {/* ---------------- 7. costs ---------------- */}
        <Section id="costs" index={7} title="Transaction costs">
          <p>
            The signal does not depend on costs, so the same trades can be
            repriced at any cost level. Costs are linear in the rate, so each
            point on the curve is exact, and the value at {m.bps_per_leg} bps
            equals the backtest&apos;s net result.
          </p>
          <CostChart rows={cost} assumed={m.bps_per_leg} breakEven={be} />
          <p>
            The mean trade earned {grossBps.toFixed(0)} bps of notional before
            costs and paid {costBps.toFixed(0)} bps, since a round trip charges
            both legs twice. The break-even cost is{" "}
            {be ? `${be.toFixed(1)} bps` : "below the grid"} per leg, roughly half
            the assumed cost. At zero cost the strategy would return{" "}
            {signed(s.gross["ann_return_%"])} a year, below the risk-free rate, so
            lower execution costs alone would not make it viable.
          </p>
        </Section>

        {/* ---------------- 8. neutrality ---------------- */}
        <Section id="neutral" index={8} title="Market exposure">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              value={rate.beta_to_market.toFixed(3)}
              label="Beta to the Nifty 50"
              detail="Slope of daily strategy returns on daily Nifty 50 returns."
              tone="accent"
            />
            <StatCard
              value={rate.corr_to_market.toFixed(3)}
              label="Correlation"
              detail="Over the full out-of-sample period."
            />
            <StatCard
              value={rate.r_squared.toFixed(3)}
              label="R²"
              detail="Share of daily return variance explained by the Nifty 50."
            />
            <StatCard
              value={signed(s.benchmark_nifty["ann_return_%"], 1)}
              label="Nifty 50, annual return"
              detail="Over the same days."
            />
          </div>
          <p className="mt-6">
            A beta of {rate.beta_to_market.toFixed(3)} implies that a 1% move in
            the Nifty 50 is associated with a{" "}
            {Math.abs(rate.beta_to_market * 100).toFixed(1)} bps move in the
            strategy. The long-short construction removed market exposure as
            intended, and the return derives from relative price movements
            between banks.
          </p>
        </Section>

        {/* ---------------- 9. bug ---------------- */}
        <Section id="bug" index={9} title="Correction of an entry-rule error">
          <p>
            The first complete run of the backtest reported 1,008 trades, an
            after-cost return of -9.82% a year and a break-even cost of 1.9 bps
            per leg. A breakdown by exit type showed 892 stop-outs with a median
            holding period of one day.
          </p>
          <p>
            The entry rule opened a position whenever |z| reached {m.entry_z}
            without checking whether it also exceeded the stop level of{" "}
            {m.stop_z}. When a spread moved beyond the stop, the strategy entered,
            was stopped out the next day and re-entered, for as long as the spread
            remained beyond the stop, paying four legs of cost on each cycle. The
            correction is the last row of the rules table, and two tests cover
            it.
          </p>
          <Table
            minWidth={440}
            head={
              <thead>
                <tr className="border-b border-line">
                  <TH align="left">Measure</TH>
                  <TH>First run</TH>
                  <TH>Corrected</TH>
                </tr>
              </thead>
            }
            caption="First-run figures are taken from the run before the correction and are stated rather than recomputed."
          >
            <tbody className="tnum">
              {[
                ["Trades", "1,008", n.toLocaleString("en-IN")],
                ["Entered with |z| already past the stop", "816", "0"],
                ["Stopped out", "892", `${ex.stop.n}`],
                ["Annualised, before costs", "+1.04%", signed(s.gross["ann_return_%"])],
                ["Annualised, after costs", "-9.82%", signed(s.net["ann_return_%"])],
                ["Break-even cost per leg", "1.9 bps", be ? `${be.toFixed(1)} bps` : "n/a"],
              ].map(([k, a, b]) => (
                <tr key={k} className="border-b border-line/70 text-right">
                  <th scope="row" className="py-2.5 text-left text-[13px] font-medium text-ink-muted">
                    {k}
                  </th>
                  <td className="px-2 py-2.5 text-ink-dim">{a}</td>
                  <td className="px-2 py-2.5 font-semibold text-ink">{b}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p>
            The error changed the after-cost return by 8.5 percentage points a
            year and the before-cost return by 0.2. Because its effect appeared
            almost entirely as cost, the first run was consistent with a strategy
            that has a gross edge but cannot cover its costs. The decomposition by
            exit type showed that this reading was incorrect.
          </p>
        </Section>

        {/* ---------------- 10. limits ---------------- */}
        <Section id="limits" index={10} title="Limitations">
          <Bullets
            items={[
              <><strong className="font-semibold text-ink">One sector, one market.</strong> <span className="text-ink-muted">All {m.traded.length} stocks are Indian banks, and the results do not extend to other sectors or markets.</span></>,
              <><strong className="font-semibold text-ink">No interest on collateral.</strong> <span className="text-ink-muted">A long-short portfolio earns interest on posted margin. Crediting it would make the Sharpe ratio less negative but would not change the trade-level results.</span></>,
              <><strong className="font-semibold text-ink">Short positions assumed costless.</strong> <span className="text-ink-muted">Holding a short equity position in India for more than a day requires securities lending or single-stock futures. Futures are available on all {m.traded.length} banks, but their basis and roll costs are not modelled.</span></>,
              <><strong className="font-semibold text-ink">Constant costs.</strong> <span className="text-ink-muted">{m.bps_per_leg} bps per leg does not vary with volatility and is likely too low on the days when spreads widen sharply and stops are triggered.</span></>,
              <><strong className="font-semibold text-ink">Daily closing prices.</strong> <span className="text-ink-muted">All trades execute at closing prices, at which large orders could not be filled.</span></>,
              <><strong className="font-semibold text-ink">Thresholds not validated.</strong> <span className="text-ink-muted">The entry, exit and stop levels are conventional values fixed in advance. Testing alternatives properly would require a further holdout period.</span></>,
              <><strong className="font-semibold text-ink">Survivorship.</strong> <span className="text-ink-muted">The universe consists of banks listed in 2026. Banks merged during the sample, including those in the 2020 public-sector mergers, were never candidates.</span></>,
            ]}
          />
        </Section>

        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-6 text-[13px]">
          <a href="#top" className="text-ink-muted transition-colors duration-200 hover:text-ink">
            Back to the top
          </a>
          <a
            href={META.repo}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-muted transition-colors duration-200 hover:text-ink"
          >
            Full report, source and tests on GitHub
          </a>
        </nav>
      </main>
    </>
  );
}
