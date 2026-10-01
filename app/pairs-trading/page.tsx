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
  { id: "result", label: "Result" },
  { id: "selection", label: "Pair selection" },
  { id: "rules", label: "Trading rules" },
  { id: "pnl", label: "Where the P&L came from" },
  { id: "formation", label: "What held, what did not" },
  { id: "equity", label: "Over time" },
  { id: "costs", label: "Costs" },
  { id: "neutral", label: "Market neutrality" },
  { id: "bug", label: "The re-entry bug" },
  { id: "limits", label: "Limitations" },
];

const REASON_LABEL: Record<string, string> = {
  reverted: "Reverted inside the exit band",
  stop: "Stopped out beyond the stop",
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
              Pairs trading on {m.traded.length} Indian banks, tested out of
              sample
            </h1>
            <p className="mt-5 text-[17px] leading-[1.7] text-ink-muted">
              Every six months, all {m.candidate_pairs} pairs of banks are tested
              for cointegration on the previous {m.formation_months} months, and up
              to {m.max_pairs} that pass are traded for the next{" "}
              {m.trading_months} on a fixed z-score rule. Over{" "}
              {s.net.days.toLocaleString("en-IN")} trading days from{" "}
              {m.oos_start} to {m.oos_end}, it returned{" "}
              <V>{signed(s.gross["ann_return_%"])} a year before costs</V> and{" "}
              <V>{signed(s.net["ann_return_%"])} after them</V>. The pairs that
              reverted made money, but more of them broke apart and were stopped
              out, and those losses cancelled almost all of the gains.
            </p>
          </header>
        </Reveal>

        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            value={signed(s.gross["ann_return_%"])}
            label="A year, before costs"
            detail={`${mult(s.gross["total_return_%"])} over the whole period.`}
          />
          <StatCard
            value={signed(s.net["ann_return_%"])}
            label="A year, after costs"
            detail={`${mult(s.net["total_return_%"])}, at ${m.bps_per_leg} bps per leg.`}
          />
          <StatCard
            value={`${ex.stop.n} of ${n}`}
            label="Trades stopped out"
            detail={`Against ${ex.reverted.n} that reverted.`}
          />
          <StatCard
            value={rate.beta_to_market.toFixed(3)}
            label="Beta to the Nifty"
            detail={`R² ${rate.r_squared.toFixed(3)}.`}
            tone="accent"
          />
        </div>

        {/* ---------------- 1. result ---------------- */}
        <Section id="result" index={1} title="Result">
          <p>
            The strategy did not make money after costs, and before costs it
            earned {signed(s.gross["ann_return_%"])} a year, well under the 6%
            risk-free rate used across this site. That is why the Sharpe ratio is
            negative in both columns. Buying the same {m.traded.length} banks and
            holding them returned {signed(s.benchmark_universe["ann_return_%"])}{" "}
            a year over the same days, with far more risk.
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
            The timeline is cut into {m.n_windows} windows. Each one has a{" "}
            {m.formation_months}-month formation period, where pairs are chosen
            and every parameter is fitted, followed by a {m.trading_months}-month
            trading period that uses those parameters unchanged. Windows step
            forward {m.trading_months} months at a time, so the trading periods
            never overlap.
          </p>
          <p>
            Pairs are chosen by the Engle-Granger test: regress one price on the
            other, then test whether the residual is stationary. A pair passes
            at p ≤ {m.pvalue_threshold}, and at most {m.max_pairs} pass per
            window, lowest p-value first. Correlation would be the wrong filter.
            Two stocks can have daily returns that are 0.99 correlated and still
            drift apart forever if one grows slightly faster, and the test suite
            checks that Engle-Granger rejects exactly that case.
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
            caption="The pairs selected most often. Half-life is the number of days a deviation takes to halve, from an AR(1) fit on the formation spread."
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
            In the trading period the spread is <C>y - βx</C>, and the z-score is
            its distance from the formation mean in formation standard
            deviations. Each position has ₹1 lakh of gross notional across its two
            legs.
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
                [`|z| back inside ${m.exit_z}`, "Close, reverted"],
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

          <Sub>Keeping the future out</Sub>
          <p>
            Three mechanisms stop trading-period data from reaching a decision,
            and each has a test that fails when it is removed. The hedge ratio,
            mean and standard deviation come from one function that only sees the
            formation period. The z-score function takes that mean and standard
            deviation as arguments, so it cannot standardise a spread against its
            own statistics. And fills are booked at the close after the signal,
            not the close that produced it.
          </p>
        </Section>

        {/* ---------------- 4. P&L ---------------- */}
        <Section id="pnl" index={4} title="Where the P&L came from">
          <p>
            Splitting every trade by how it ended shows the result. The{" "}
            {ex.reverted.n} trades that reverted earned {inr(ex.reverted.gross)}{" "}
            before costs. The {ex.stop.n} that were stopped out lost{" "}
            {inr(ex.stop.gross)}. What was left, {inr(gross)}, was less than half
            of the {inr(costs)} paid in costs.
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
            A reverted trade earned {inr(avgRev)} on average and a stopped trade
            lost {inr(-avgStop)}, about half as much. At those
            payoffs, reversions need to be roughly a third of reversions plus
            stops just to break even before costs. They were{" "}
            {((ex.reverted.n / (ex.reverted.n + ex.stop.n)) * 100).toFixed(0)}%.
          </p>
        </Section>

        {/* ---------------- 5. formation ---------------- */}
        <Section id="formation" index={5} title="What the formation window got right, and what it did not">
          <Sub>The speed of reversion held up</Sub>
          <p>
            For the {rev.n} trades that reverted, the median holding period was{" "}
            {rev.median_hold} days against a median formation half-life of{" "}
            {rev.median_half_life.toFixed(1)} days, a ratio of{" "}
            {rev.median_hold_over_half_life.toFixed(2)}. Going from the median
            entry at |z| = {rev.median_entry_abs_z.toFixed(2)} to the exit at{" "}
            {m.exit_z} means the deviation has to shrink by a factor of{" "}
            {(rev.median_entry_abs_z / m.exit_z).toFixed(1)}, which takes{" "}
            {Math.log2(rev.median_entry_abs_z / m.exit_z).toFixed(1)} half-lives.
            When a pair reverted, it did so at about the speed the formation
            window predicted.
          </p>

          <Sub>Whether it would revert at all did not</Sub>
          <p>
            {((ex.stop.n / n) * 100).toFixed(0)}% of trades were stopped out. If
            the cointegration test measured how dependable a pair would be,
            pairs with smaller p-values should have been stopped out less often.
            They were not.
          </p>

          <Table
            minWidth={480}
            head={
              <thead>
                <tr className="border-b border-line">
                  <TH align="left">Formation p-value</TH>
                  <TH>Trades</TH>
                  <TH>Stopped out</TH>
                  <TH>Reverted</TH>
                  <TH>Avg gross P&amp;L</TH>
                </tr>
              </thead>
            }
            caption="With 60 to 93 trades per row, the differences between rows are within noise. The p-value carried no information about the next six months."
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
        <Section id="equity" index={6} title="Over time">
          <EquityChart gross={eq.gross} net={eq.net} drawdown={eq.drawdown_net} />
          <p>
            Before costs the strategy made money in {posYears} of{" "}
            {fullYears.length} full calendar years. Most of the loss sits in two
            episodes.
          </p>
          <AnnualChart rows={annual} />
          <p>
            <V>2020.</V> The COVID crash moved bank stocks by very different
            amounts. Axis Bank against Federal Bank was stopped out six times
            that year, and IndusInd Bank against IDFC First Bank lost on seven
            trades.
          </p>
          <p>
            <V>January to June 2025.</V> The 2024 formation year selected five
            pairs, and four of them had Kotak Mahindra Bank as a leg. On 21
            January 2025, three of them entered on the same day, each short
            Kotak against a public-sector bank, and all three were stopped out on
            24 March for about ₹12,000 each. That was one view on Kotak taken
            three times, and the window lost ₹43,737 before costs, nearly the
            strategy&apos;s whole gross profit over nine and a half years.
          </p>
          <Note>
            Nothing in the selection rule stops one bank from appearing in
            several of the five pairs. In 7 of the {m.n_windows} windows, a single
            bank was a leg of three or more selected pairs.
          </Note>
        </Section>

        {/* ---------------- 7. costs ---------------- */}
        <Section id="costs" index={7} title="Costs">
          <p>
            The signal never uses costs, so the same trades can be re-priced at
            any cost level. Cost is linear in the rate, so every point on the
            curve is exact, and the point at {m.bps_per_leg} bps matches the
            backtest&apos;s own net figure.
          </p>
          <CostChart rows={cost} assumed={m.bps_per_leg} breakEven={be} />
          <p>
            The break-even follows from two numbers. The average trade earned{" "}
            {grossBps.toFixed(0)} bps of notional before costs and paid{" "}
            {costBps.toFixed(0)} bps, since a round trip charges both legs twice.
            Break-even is {be ? `${be.toFixed(1)} bps` : "below the grid"} per
            leg, about half the cost assumed. Even at zero cost the strategy
            would return {signed(s.gross["ann_return_%"])} a year, so cheaper
            execution alone would not make it worth running.
          </p>
        </Section>

        {/* ---------------- 8. neutrality ---------------- */}
        <Section id="neutral" index={8} title="Market neutrality">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              value={rate.beta_to_market.toFixed(3)}
              label="Beta to the Nifty"
              detail="Slope of daily strategy returns on daily Nifty returns."
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
              detail="Share of daily variance the Nifty explains."
            />
            <StatCard
              value={signed(s.benchmark_nifty["ann_return_%"], 1)}
              label="Nifty, a year"
              detail="Over the same days."
            />
          </div>
          <p className="mt-6">
            A 1% move in the Nifty moved the strategy by about{" "}
            {Math.abs(rate.beta_to_market * 100).toFixed(1)} bps on average. The
            long-short structure removed market exposure as designed, so every
            rupee of P&amp;L came from relative moves between banks.
          </p>
        </Section>

        {/* ---------------- 9. bug ---------------- */}
        <Section id="bug" index={9} title="The re-entry bug">
          <p>
            The first complete run reported 1,008 trades, -9.82% a year after
            costs and a break-even of 1.9 bps per leg. Breaking those trades down
            by exit reason showed 892 stops with a median holding period of one
            day.
          </p>
          <p>
            The entry rule did not check the stop. A flat book entered whenever
            |z| reached {m.entry_z}, even when |z| was already past {m.stop_z}, so
            a broken pair was entered, stopped out the next day and entered again
            for as long as the spread stayed wide. Each loop paid four legs of
            cost. The fix is the last row of the rules table, and two tests cover
            it.
          </p>
          <Table
            minWidth={440}
            head={
              <thead>
                <tr className="border-b border-line">
                  <TH align="left">Measure</TH>
                  <TH>First run</TH>
                  <TH>After the fix</TH>
                </tr>
              </thead>
            }
            caption="First-run figures are from the run before the fix and are stated here rather than recomputed."
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
            Because the damage showed up almost entirely as cost, the first run
            looked like a real edge that costs destroyed. The exit-reason
            breakdown is what showed it was a bug.
          </p>
        </Section>

        {/* ---------------- 10. limits ---------------- */}
        <Section id="limits" index={10} title="Limitations">
          <Bullets
            items={[
              <><strong className="font-semibold text-ink">One sector, one market.</strong> <span className="text-ink-muted">All {m.traded.length} stocks are Indian banks.</span></>,
              <><strong className="font-semibold text-ink">No interest on collateral.</strong> <span className="text-ink-muted">A real long-short book earns interest on the margin it posts. Crediting it would make the Sharpe ratio less negative but would not change the trade-level result.</span></>,
              <><strong className="font-semibold text-ink">Short selling is assumed free.</strong> <span className="text-ink-muted">Holding a short in India beyond a day needs stock lending or single-stock futures. Futures exist for all {m.traded.length} banks, but their basis and roll costs are not modelled.</span></>,
              <><strong className="font-semibold text-ink">Flat costs.</strong> <span className="text-ink-muted">{m.bps_per_leg} bps per leg does not rise on volatile days, which are the days the stops fire.</span></>,
              <><strong className="font-semibold text-ink">Daily closes.</strong> <span className="text-ink-muted">Every fill is at a closing price nobody can trade in size.</span></>,
              <><strong className="font-semibold text-ink">Thresholds chosen in advance, not tested.</strong> <span className="text-ink-muted">Testing alternatives properly needs a third holdout period this sample does not have.</span></>,
              <><strong className="font-semibold text-ink">Survivorship.</strong> <span className="text-ink-muted">Banks merged away during the sample, such as those in the 2020 public-sector mergers, were never candidates.</span></>,
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
            Source, tests and full report on GitHub
          </a>
        </nav>
      </main>
    </>
  );
}
