import TopBar from "../components/TopBar";
import { Reveal } from "../components/Motion";
import { Section, V, C, StatCard, Note, Table, TH } from "../components/Page";
import {
  CostChart,
  EquityChart,
  PairMechanism,
} from "../components/PairsCharts";
import { PROJECTS } from "@/lib/project";
import {
  breakEvenBps, 
  getCostSensitivity,
  getExamplePair,
  getPairsEquity,
  getPairsMeta, 
  getPairsSummary,
  getTopPairs,
  getTradesByReason,
} from "@/lib/pairs";

const META = PROJECTS[2];

export const metadata = { title: META.name, description: META.blurb };

const SECTIONS = [
  { id: "result", label: "The result" },
  { id: "gate", label: "Cointegration" },
  { id: "mechanism", label: "The mechanism" },
  { id: "lookahead", label: "No lookahead" },
  { id: "equity", label: "Out-of-sample" },
  { id: "costs", label: "Costs" },
  { id: "neutral", label: "Market neutrality" },
  { id: "limits", label: "Limitations" },
];

export default function PairsTrading() {
  const m = getPairsMeta();
  const s = getPairsSummary();
  const eq = getPairsEquity();
  const cost = getCostSensitivity();
  const example = getExamplePair();
  const top = getTopPairs();
  const reasons = getTradesByReason();
  const be = breakEvenBps();

  const pct = (v: number, d = 2) => `${v.toFixed(d)}%`;
  const signed = (v: number, d = 2) => `${v >= 0 ? "+" : ""}${v.toFixed(d)}%`;
  const mult = (v: number) => `${(1 + v / 100).toFixed(2)}x`;

  const reasonOrder = ["reverted", "stop", "timeout", "window_end"];
  const reasonLabel: Record<string, string> = {
    reverted: "Reverted to the mean",
    stop: "Stopped out, kept diverging",
    timeout: "Timed out, never reverted",
    window_end: "Window closed while open",
  };
  const totalTrades = s.trades.n_trades;

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
            <h1 className="mt-2 text-[34px] font-semibold leading-[1.1] tracking-tight text-ink sm:text-[44px]">
              A market-neutral engine attached to an edge too small to pay for
              itself
            </h1>
            <p className="mt-5 text-[17.5px] leading-[1.7] text-ink-muted">
              Statistical arbitrage on {m.traded.length} Indian banks:
              cointegration picks the pairs, a formation window fixes every
              parameter, and a walk-forward backtest charges all four legs of
              every round trip.
            </p>

            <div className="mt-7 rounded-xl border-l-2 border-accent bg-surface px-6 py-5">
              <p className="eyebrow">What this is</p>
              <p className="mt-3 text-[14.5px] leading-[1.8] text-ink-muted">
                The companion to the two research studies on this site. Those ask
                whether an effect exists; this one asks whether a working system
                built on a real effect survives contact with the costs of running
                it. Pairs are selected by Engle-Granger cointegration on a{" "}
                {m.formation_months}-month formation window, traded on the
                following disjoint {m.trading_months} months using parameters
                fixed before that period began, and rolled forward{" "}
                {m.n_windows} times from {m.oos_start} to {m.oos_end}.{" "}
                <V>
                  Gross of costs it compounds to {mult(s.gross["total_return_%"])}.
                  Net of {m.bps_per_leg} bps per leg it compounds to{" "}
                  {mult(s.net["total_return_%"])}.
                </V>{" "}
                The market exposure it was designed to remove is genuinely gone -
                beta to the Nifty is {s.neutrality_net.beta_to_market.toFixed(3)} -
                but the edge is roughly a tenth of the size needed to cover its
                own trading.
              </p>
            </div>
          </header>
        </Reveal>

        {/* ---------------- headline ---------------- */}
        <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            value={mult(s.gross["total_return_%"])}
            label="Before costs"
            detail={`${signed(s.gross["ann_return_%"])} a year across ${s.net.days.toLocaleString("en-IN")} out-of-sample days.`}
          />
          <StatCard
            value={mult(s.net["total_return_%"])}
            label="After costs"
            detail={`${signed(s.net["ann_return_%"])} a year. The difference is ${totalTrades.toLocaleString("en-IN")} round trips.`}
          />
          <StatCard
            value={be ? `${be.toFixed(1)} bps` : "n/a"}
            label="Break-even cost per leg"
            detail={`Against the ${m.bps_per_leg} bps assumed here. The edge is real and about a tenth of what it needs to be.`}
          />
          <StatCard
            value={s.neutrality_net.beta_to_market.toFixed(3)}
            label="Beta to the Nifty"
            detail={`R² of ${s.neutrality_net.r_squared.toFixed(3)}. The long-short structure did exactly its job.`}
            tone="accent"
          />
        </div>

        {/* ---------------- 1. result ---------------- */}
        <Section id="result" index={1} title="The two questions, answered plainly">
          <p>
            <V>Did it make money out of sample after costs?</V> No. The strategy
            compounds to {mult(s.gross["total_return_%"])} before costs and{" "}
            {mult(s.net["total_return_%"])} after them, over{" "}
            {s.net.days.toLocaleString("en-IN")} days that were traded with
            parameters fixed before each of them began. Buying the same eleven
            banks and doing nothing returned{" "}
            {mult(s.benchmark_universe["total_return_%"])}.
          </p>
          <p>
            <V>Was it actually market-neutral?</V> Yes, and this is the part that
            worked. Beta to the Nifty is{" "}
            {s.neutrality_net.beta_to_market.toFixed(4)} with an R² of{" "}
            {s.neutrality_net.r_squared.toFixed(4)}, so the market&apos;s
            direction explains well under one percent of the strategy&apos;s
            day-to-day movement. That is the long-short construction doing what it
            is designed to do, and it is measured rather than asserted.
          </p>

          <Table
            minWidth={640}
            head={
              <thead>
                <tr className="border-b border-line">
                  <TH align="left">Measure</TH>
                  <TH>Before costs</TH>
                  <TH>After costs</TH>
                  <TH>Buy and hold</TH>
                </tr>
              </thead>
            }
            caption={
              <>
                Costs are {m.bps_per_leg} bps per leg: brokerage and taxes, half
                the bid-ask spread, and slippage. Two legs, charged on entry and
                again on exit, so {m.bps_per_leg * 4} bps of the traded notional
                per round trip. Sharpe is measured against a 6% rupee
                risk-free rate, the same one the other projects on this site use,
                which is why a small positive gross return still scores below zero.
              </>
            }
          >
            <tbody className="tnum">
              {[
                ["Total return", mult(s.gross["total_return_%"]), mult(s.net["total_return_%"]), mult(s.benchmark_universe["total_return_%"])],
                ["Annualised", signed(s.gross["ann_return_%"]), signed(s.net["ann_return_%"]), signed(s.benchmark_universe["ann_return_%"])],
                ["Volatility", pct(s.gross["ann_vol_%"]), pct(s.net["ann_vol_%"]), pct(s.benchmark_universe["ann_vol_%"])],
                ["Sharpe", s.gross.sharpe.toFixed(2), s.net.sharpe.toFixed(2), s.benchmark_universe.sharpe.toFixed(2)],
                ["Max drawdown", pct(s.gross["max_drawdown_%"]), pct(s.net["max_drawdown_%"]), pct(s.benchmark_universe["max_drawdown_%"])],
              ].map(([k, a, b, c]) => (
                <tr key={k} className="border-b border-line/70 text-right">
                  <th scope="row" className="py-2.5 text-left text-[13px] font-medium text-ink-muted">
                    {k}
                  </th>
                  <td className="px-2 py-2.5 text-ink">{a}</td>
                  <td className="px-2 py-2.5 font-semibold text-[#b45309]">{b}</td>
                  <td className="px-2 py-2.5 text-ink-dim">{c}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>

        {/* ---------------- 2. cointegration ---------------- */}
        <Section id="gate" index={2} title="Cointegration, not correlation">
          <p>
            The gate that decides which pairs are tradable is the single most
            important design choice in this system, and the tempting wrong answer
            is correlation.
          </p>
          <p>
            Correlation asks whether two series move together day to day. Two
            stocks can be highly correlated and still drift apart forever: if both
            rise but one rises faster, every daily move agrees in direction while
            the gap between them grows without limit. A spread built on that pair
            has no mean to come back to, so a z-score measures distance from a
            number that has stopped meaning anything.
          </p>
          <p>
            Cointegration asks the stricter question: is there a fixed combination
            of the two whose value is stationary, wandering around a constant mean
            with finite variance rather than drifting? If <C>y - βx</C> is
            stationary, then when it is far from its mean there is a statistical
            reason to expect it back. Correlation says the two walk in step;
            cointegration says they are tied together by a rope of fixed length.
          </p>
          <Note>
            The test suite encodes this distinction directly. One case builds two
            series from identical shocks plus a small extra drift on one: their
            daily changes correlate above 0.99 and Engle-Granger still refuses
            them, because the levels separate without bound. That pair would pass
            a correlation filter and lose money indefinitely.
          </Note>
          <p>
            Engle-Granger runs in two stages: regress one leg on the other, then
            test the residual for a unit root. The null hypothesis is no
            cointegration, so a small p-value is evidence the residual is
            stationary. All {m.candidate_pairs} candidate pairs are tested on each
            formation window and at most {m.max_pairs} survive, ranked by p-value,
            with a threshold of {m.pvalue_threshold}.
          </p>

          <Table
            minWidth={560}
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
            caption={
              <>
                The pairs chosen most often across {m.n_windows} formation
                windows. Half-life is how long a deviation takes to decay halfway
                back, from an AR(1) fit on the formation spread; a pair whose
                half-life exceeded the {m.trading_months}-month trading window
                could not revert inside it. The median across all selections is{" "}
                {s.selection.median_half_life_days?.toFixed(1)} days.
              </>
            }
          >
            <tbody className="tnum">
              {top.slice(0, 6).map((p) => (
                <tr key={p.pair} className="border-b border-line/70 text-right">
                  <th scope="row" className="py-2.5 text-left text-[13px] font-medium text-ink-muted">
                    {p.pair.replace(/\.NS/g, "")}
                  </th>
                  <td className="px-2 py-2.5 text-ink">{p.times_selected}</td>
                  <td className="px-2 py-2.5 text-ink-muted">{p.median_pvalue.toFixed(4)}</td>
                  <td className="px-2 py-2.5 text-ink-muted">{p.median_half_life.toFixed(1)}d</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>

        {/* ---------------- 3. mechanism ---------------- */}
        <Section id="mechanism" index={3} title="What the strategy actually does">
          <p>
            Both banks in a pair move with the sector. Buying one and shorting the
            hedge-ratio multiple of the other cancels most of that shared
            direction, because whatever the sector does enters both legs and nets
            out. What is left is the difference between the two, which is the only
            thing the strategy has an opinion about. That is why the position is
            long one and short the other rather than a bet on either name, and why
            the beta reported above should be near zero.
          </p>
          <p>
            When the standardised spread stretches past {m.entry_z}, the strategy
            shorts the over-performer and buys the under-performer. It closes when
            the spread comes back inside {m.exit_z}. If instead the spread keeps
            widening past {m.stop_z}, the trade is abandoned: that is the case
            where the relationship has broken rather than stretched, and it is the
            one that ruins pairs traders who assume reversion is guaranteed.
          </p>

          {example && (
            <PairMechanism
              example={example}
              entryZ={m.entry_z}
              exitZ={m.exit_z}
              stopZ={m.stop_z}
            />
          )}

          <Table
            minWidth={520}
            head={
              <thead>
                <tr className="border-b border-line">
                  <TH align="left">How the trade ended</TH>
                  <TH>Count</TH>
                  <TH>Share</TH>
                </tr>
              </thead>
            }
            caption={
              <>
                A position still open when a trading window ends is closed at the
                last bar rather than dropped. Dropping it would quietly discard
                exactly the trades that went worst, which is the losing half of a
                survivorship bias.
              </>
            }
          >
            <tbody className="tnum">
              {reasonOrder.filter((r) => reasons[r]).map((r) => (
                <tr key={r} className="border-b border-line/70 text-right">
                  <th scope="row" className="py-2.5 text-left text-[13px] font-medium text-ink-muted">
                    {reasonLabel[r]}
                  </th>
                  <td className="px-2 py-2.5 text-ink">{reasons[r]}</td>
                  <td className="px-2 py-2.5 text-ink-muted">
                    {((reasons[r] / totalTrades) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>

        {/* ---------------- 4. lookahead ---------------- */}
        <Section id="lookahead" index={4} title="How lookahead is prevented, and tested">
          <p>
            A backtest that sees the future is worthless, and the failure is
            silent: it produces better numbers, not an error. Three separate
            mechanisms keep it out here, and each is checked by a test that fails
            if the mechanism is removed.
          </p>
          <p>
            <V>Parameters are estimated in exactly one function</V>, and it only
            ever receives a formation slice. The hedge ratio, the spread mean and
            the spread standard deviation are all fixed before the trading window
            begins. The test corrupts every trading-window price with noise and
            asserts the fitted parameters do not move by so much as a rounding
            error.
          </p>
          <p>
            <V>The z-score cannot re-centre itself.</V> The function takes the
            mean and standard deviation as arguments rather than computing them
            from its input, so standardising a trading spread against its own
            statistics is not something a caller can do by accident. The test
            works off a signature: a z-score computed on its own window is centred
            at zero by construction, and one computed against fixed formation
            parameters is not.
          </p>
          <p>
            <V>Execution lags the signal by one bar.</V> The decision uses the
            close of a day and the fill is booked at the next close, because
            acting on a close requires having seen it. Same-bar fills are a small
            but real lookahead and they flatter this strategy specifically, since
            entries cluster on large moves.
          </p>
          <Note>
            These guards were verified by mutation rather than by reading them.
            Making the z-score recompute its own mean and standard deviation
            fails three tests; removing the one-bar execution lag fails one. All
            29 tests pass with the guards in place.
          </Note>
        </Section>

        {/* ---------------- 5. equity ---------------- */}
        <Section id="equity" index={5} title="What it returned out of sample">
          <EquityChart
            gross={eq.gross}
            net={eq.net}
            benchmark={eq.benchmark}
            drawdown={eq.drawdown_net}
          />
          <p>
            The blue line is the edge: cointegration selection genuinely produces
            a positive gross return, and it does so with almost no market
            exposure. The amber line is the same strategy after it pays to trade.
            The distance between them is {totalTrades.toLocaleString("en-IN")}{" "}
            round trips at an average holding period of{" "}
            {s.trades.avg_holding_days.toFixed(1)} days.
          </p>
          <p>
            The win rate is {pct(s.trades["win_rate_%"], 1)}, which is lower than
            it first appears to need to be. Mean reversion strategies of this kind
            take many small wins against fewer larger losses, so a win rate below
            half is survivable in principle. It is not survivable at this cost
            level.
          </p>
        </Section>

        {/* ---------------- 6. costs ---------------- */}
        <Section id="costs" index={6} title="Where it breaks">
          <p>
            A single verdict at one cost assumption is a weak statement, so the
            same trades are re-priced across a grid. The signal never saw costs,
            which is what makes this legitimate: the strategy is held fixed and
            only the charge varies.
          </p>
          <CostChart
            rows={cost}
            assumed={m.bps_per_leg}
            breakEven={be}
          />
          <p>
            Break-even is {be ? `${be.toFixed(1)} bps per leg` : "below the tested grid"}.
            That is the finding, and it is more useful than the headline loss: the
            edge is real, positive and market-neutral, and it is roughly one tenth
            the size required to cover realistic retail transaction costs. No
            amount of parameter tuning closes a gap of that order. Reaching it
            would require either institutional execution or a slower version of
            the strategy that trades far less often.
          </p>
        </Section>

        {/* ---------------- 7. neutrality ---------------- */}
        <Section id="neutral" index={7} title="Proving the market exposure is gone">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              value={s.neutrality_net.beta_to_market.toFixed(4)}
              label="Beta to the Nifty"
              detail="OLS slope of daily strategy returns on daily market returns."
              tone="accent"
            />
            <StatCard
              value={s.neutrality_net.corr_to_market.toFixed(4)}
              label="Correlation"
              detail="Over the full out-of-sample period."
            />
            <StatCard
              value={s.neutrality_net.r_squared.toFixed(4)}
              label="R² to the market"
              detail="Share of the strategy's variance the market explains."
            />
            <StatCard
              value={pct(s.benchmark_nifty["ann_return_%"], 1)}
              label="What the Nifty did"
              detail="Annualised, over the same days. The strategy ignored all of it."
            />
          </div>
          <p className="mt-6">
            This is the claim the long-short structure exists to deliver, so it is
            measured rather than assumed. A beta of{" "}
            {s.neutrality_net.beta_to_market.toFixed(4)} means that if the market
            moves one percent, the expected contribution to the strategy is
            {" "}{(s.neutrality_net.beta_to_market * 100).toFixed(2)} basis points.
            The strategy made and lost money on the relationship between two
            banks, which is what it was built to do.
          </p>
        </Section>

        {/* ---------------- 8. limits ---------------- */}
        <Section id="limits" index={8} title="Limitations">
          <ul className="space-y-3">
            {[
              ["One sector, one market.", `All ${m.traded.length} names are Indian banks. That is the right place to look for cointegration, and it also means the result says nothing about pairs trading in general.`],
              ["Cointegration is tested, not guaranteed to persist.", "A pair that passed on the formation window can break in the trading window, which is exactly what the stop-loss exists for. Passing a test on past data is evidence, not a promise."],
              ["Costs are a flat assumption.", `${m.bps_per_leg} bps per leg is a reasonable retail figure for liquid NSE names, but it does not vary with trade size, volatility or liquidity, and it ignores market impact and short-borrow costs entirely. Short availability in particular is assumed, which is generous.`],
              ["Daily closes only.", "The strategy trades once a day at a close it could not have transacted at in size. Intraday execution would change both the entry prices and the costs, in directions that do not obviously cancel."],
              ["No position limits or risk overlay.", "Each selected pair gets equal capital and there is no cap on sector concentration, no volatility targeting and no drawdown control. A production system would have all three."],
              ["The parameter grid was chosen, not searched.", `Entry at ${m.entry_z}, exit at ${m.exit_z}, stop at ${m.stop_z}, ${m.formation_months}-month formation. These are conventional values picked in advance. Searching them for the best result would reintroduce lookahead one level up, and the honest fix is a third holdout period this project does not have.`],
            ].map(([t, b]) => (
              <li key={t} className="flex gap-3 text-[14.5px] leading-relaxed">
                <span aria-hidden className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-accent" />
                <span>
                  <strong className="font-semibold text-ink">{t}</strong>{" "}
                  <span className="text-ink-muted">{b}</span>
                </span>
              </li>
            ))}
          </ul>
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
            Source, tests and pipeline on GitHub
          </a>
        </nav>
      </main>
    </>
  );
}
