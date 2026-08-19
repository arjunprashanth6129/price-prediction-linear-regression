import TopBar from "../components/TopBar";
import { Reveal, CountUp } from "../components/Motion";
import { Section, Sub, V, C, StatCard, Note, Table, TH, Bullets } from "../components/Page";
import {
  Allocations,
  CrisisReplay,
  EquityCurves,
  Frontier,
  SharpeShift,
  TailProfile,
  type CrisisRow,
  type CurvePoint,
  type FrontierDot,
  type StrategyDot,
  type TailRow,
} from "../components/CvarCharts";
import { PROJECTS } from "@/lib/project";
import {
  ASSET_SHORT,
  BENCHMARKS,
  STRATEGIES,
  STRATEGY_COLOUR,
  STRATEGY_LABEL,
  STRATEGY_SPEC,
  assetColours,
  assetsByClass,
  getBacktest,
  getCrisis,
  getCvarHeadline,
  getPortfolios,
  getRisk,
  getScenarios,
  type SeriesKey,
  type Strategy,
} from "@/lib/cvar";

const META = PROJECTS[1];

export const metadata = { title: META.name, description: META.blurb };

const SECTIONS = [
  { id: "findings", label: "The result" },
  { id: "why-cvar", label: "Why CVaR" },
  { id: "tails", label: "How fat the tails are" },
  { id: "universe", label: "Universe and currency" },
  { id: "scoreboard", label: "Scoreboard" },
  { id: "frontier", label: "Efficient frontier" },
  { id: "walkforward", label: "Walk-forward test" },
  { id: "allocations", label: "Allocations" },
  { id: "crisis", label: "Crisis replay" },
  { id: "limits", label: "Limitations" },
];

export default function CvarStudy() {
  const port = getPortfolios();
  const bt = getBacktest();
  const risk = getRisk();
  const sc = getScenarios();
  const crisis = getCrisis();
  const head = getCvarHeadline();

  const assets = assetsByClass(port.meta.assets);
  const colours = assetColours(assets);
  const strategies = STRATEGIES as readonly Strategy[];

  const num = (v: number, d = 2) => v.toFixed(d);
  const pct = (v: number, d = 2) => `${v.toFixed(d)}%`;
  const signed = (v: number, d = 2) => `${v >= 0 ? "+" : ""}${v.toFixed(d)}%`;

  // ---- frontier ----
  const curve: FrontierDot[] = port.frontier.map((p, i) => ({
    cvar: p["cvar95_%"],
    ret: p["ann_return_%"],
    vol: p["ann_vol_%"],
    dd: p["max_drawdown_%"],
    holdings: p.n_holdings,
    weights: p.weights,
    index: i,
  }));
  const strategyDots: StrategyDot[] = strategies.map((k) => {
    const s = port.portfolios[k];
    return {
      key: k,
      label: STRATEGY_LABEL[k],
      cvar: s.stats["CVaR95_%"],
      ret: s.stats["exp_return_%"],
      vol: s.stats["ann_vol_%"],
      dd: s.stats["max_drawdown_%"],
      holdings: s.stats.n_holdings,
      weights: s.weights,
    };
  });

  // ---- equity curves ----
  const curveKeys: SeriesKey[] = [...strategies, "BH_nifty"];
  const dates = Object.keys(bt.equity_curves_net.equal_weight);
  const equity: CurvePoint[] = dates.map((d) => {
    const row: CurvePoint = { date: d };
    for (const k of curveKeys) row[k] = bt.equity_curves_net[k][d];
    return row;
  });

  // ---- sharpe shift ----
  const shiftData = strategies
    .map((k) => ({
      key: k,
      label: STRATEGY_LABEL[k],
      ins: port.portfolios[k].stats.sharpe,
      oos: bt.metrics_net[k].sharpe,
    }))
    .sort((a, b) => a.oos - b.oos);

  // ---- allocations ----
  const allocRows = strategies.map((k) => ({
    label: STRATEGY_LABEL[k],
    weights: port.portfolios[k].weights,
  }));
  const scenarioNames: Record<string, string> = {
    historical: "Historical",
    block_boot: "Block bootstrap",
    student_t: `Student-t (df ${num(sc.student_t_fit.df, 1)})`,
    student_t_df3: `Student-t (df ${num(sc.student_t_fit.stress_df, 0)})`,
  };
  const scenarioRows = Object.keys(scenarioNames).map((s) => ({
    label: scenarioNames[s],
    weights: sc.min_cvar_reoptimised.weights[s],
  }));

  // ---- per-asset risk, mildest tail first ----
  const byTail = Object.keys(risk.per_asset).sort(
    (a, b) => risk.per_asset[a]["CVaR95_%"] - risk.per_asset[b]["CVaR95_%"],
  );
  const tailRows: TailRow[] = byTail.map((a) => ({
    asset: a,
    label: ASSET_SHORT[a] ?? a,
    varr: risk.per_asset[a]["VaR95_%"],
    cvar: risk.per_asset[a]["CVaR95_%"],
    ratio: risk.per_asset[a]["CVaR/VaR"],
    vsNormal: risk.normality[a].understated_by_x,
    colour: colours[a],
  }));
  const fattest = tailRows.reduce((a, b) => (b.ratio > a.ratio ? b : a));
  const thinnest = tailRows.reduce((a, b) => (b.ratio < a.ratio ? b : a));

  // ---- crisis ----
  const crisisRows: CrisisRow[] = strategies.map((k) => ({
    key: k,
    label: STRATEGY_LABEL[k],
    gfc: crisis.headline[k]["GFC_drop_%"],
    gfcBeta3: crisis.headline[k]["GFC_beta3_%"],
    covid: crisis.headline[k]["COVID_%"],
    oosDD: -Math.abs(crisis.headline[k]["OOS_maxDD_%"]),
  }));

  const lehman = crisis.currency_effect_lehman;
  const covid = crisis.episodes.covid_2020;
  const gfc = crisis.episodes.GFC_lehman_2008;
  const tFit = sc.student_t_fit;
  const worstRow = strategies.reduce((a, b) =>
    bt.metrics_net[b]["max_drawdown_%"] > bt.metrics_net[a]["max_drawdown_%"] ? b : a,
  );
  const cvarDecay = Math.round(
    (bt.metrics_net.min_cvar["CVaR95_%"] /
      port.portfolios.min_cvar.stats["CVaR95_%"] -
      1) * 100,
  );

  return (
    <>
      <TopBar
        eyebrow="Study 02"
        title="CVaR portfolio optimiser"
        sections={SECTIONS}
        repo={META.repo}
      />

      <main id="top" className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8">
        {/* ---------------- hero ---------------- */}
        <Reveal>
          <header>
            <p className="eyebrow">Research</p>
            <h1 className="mt-2 text-[34px] font-semibold leading-[1.1] tracking-tight text-ink sm:text-[44px]">
              Building a portfolio around the worst days, not the average one
            </h1>
            <p className="mt-5 text-[17.5px] leading-[1.7] text-ink-muted">
              A Conditional Value-at-Risk optimiser across twelve assets in
              rupees, and the equally weighted portfolio that beat it.
            </p>

            <div className="mt-7 rounded-xl border-l-2 border-accent bg-surface px-6 py-5">
              <p className="eyebrow">Abstract</p>
              <p className="mt-3 text-[14.5px] leading-[1.8] text-ink-muted">
                Twelve assets across Indian equity, global equity, gold, bonds
                and crypto, with every dollar-quoted price converted to rupees at
                that day&apos;s spot rate, over{" "}
                {port.meta.n_days.toLocaleString("en-IN")} trading days from{" "}
                {port.meta.start} to {port.meta.end}. Five allocation strategies
                were each solved as a convex program, stress-tested against{" "}
                {sc.meta.n_scenarios.toLocaleString("en-IN")} simulated scenarios
                with deliberately fattened tails, run through a walk-forward
                backtest of {bt.meta.n_rebalances} quarterly rebalances that never
                sees the future, and replayed through the 2008 credit crisis. Min
                CVaR is solved as a linear program using the Rockafellar-Uryasev
                reformulation, which recovers the Value-at-Risk for free.{" "}
                <V>The simplest strategy won.</V> An equally weighted portfolio,
                which makes no forecast at all, achieved the best out-of-sample
                Sharpe at <V>{num(head.bestSharpe.value, 3)}</V>. Min CVaR still
                did the single job it was built for: the shallowest drawdown of
                any strategy at <V>{pct(head.shallowestDrawdown.value)}</V> and a
                gain of <V>{signed(head.gfc)}</V> through Lehman while equal
                weight lost {pct(Math.abs(head.gfcEqualWeight))}.
              </p>
            </div>
          </header>
        </Reveal>

        <Reveal delay={60}>
          <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              value={<CountUp value={head.bestSharpe.value} decimals={3} />}
              label="Best out-of-sample Sharpe"
              detail={`${STRATEGY_LABEL[head.bestSharpe.key]}, which makes no forecast and beat every optimiser on data they had not seen.`}
              tone="accent"
            />
            <StatCard
              value={<CountUp value={head.shallowestDrawdown.value} decimals={2} suffix="%" />}
              label="Shallowest drawdown"
              detail={`Min CVaR, against ${pct(bt.metrics_net.equal_weight["max_drawdown_%"])} for equal weight. The protection it was built for, delivered out of sample.`}
            />
            <StatCard
              value={<CountUp value={head.gfc} decimals={2} prefix="+" suffix="%" />}
              label="Min CVaR through Lehman"
              detail={`It gained during the 2008 crash while equal weight lost ${pct(Math.abs(head.gfcEqualWeight))}. Most of that is the rupee.`}
            />
            <StatCard
              value={<CountUp value={head.worstShift.value} decimals={3} />}
              label="Max Sharpe decay"
              detail="The only strategy that got worse out of sample, and the only one that relies on forecasting returns."
            />
          </div>
        </Reveal>

        {/* ---------------- 01 findings ---------------- */}
        <Section id="findings" index={1} title="The result I did not want">
          <p>
            I built an optimiser that minimises the average loss on the worst 5%
            of days, and then spent most of the project trying to prove it wrong.
            The honest summary is that the strategy I put the most work into did
            not win. An equally weighted portfolio, which requires no covariance
            matrix, no expected returns and no optimisation at all, had the best
            risk-adjusted return once everything was scored on data it had not
            seen.
          </p>
          <p>
            The mechanism is <V>error maximisation</V>. Every optimiser needs
            estimates, estimates contain error, and optimisers do not treat error
            carefully. They search for whatever looks best, and what looks best is
            frequently just whatever carries the most favourable estimation error.
            An asset whose mean return happens to be overstated by a quarter of a
            point in the sample is not a promising holding, it is a measurement
            artifact, and the optimiser cannot tell the difference. DeMiguel,
            Garlappi and Uppal found the same across many datasets, which is why
            1/N is a serious benchmark rather than a straw man.
          </p>

          <SharpeShift data={shiftData} />

          <p>
            Read the direction of each pair rather than its position. Four
            strategies improved when the answer sheet was taken away, which is the
            unexpected direction and worth sitting with: it means their in-sample
            scores were not inflated by fitting. Max Sharpe fell from{" "}
            {num(port.portfolios.max_sharpe.stats.sharpe, 3)} to{" "}
            {num(bt.metrics_net.max_sharpe.sharpe, 3)}, and it is the only one of
            the five that consumes expected returns, the hardest quantity in
            finance to estimate. Min CVaR improved by the largest margin of the
            five, {head.shifts.min_cvar >= 0 ? "+" : ""}
            {num(head.shifts.min_cvar, 3)} on Sharpe, which is the strongest
            evidence in the project that it was not overfitted.
          </p>
          <Note>
            <strong className="font-semibold text-ink">
              What min CVaR actually bought.
            </strong>{" "}
            The shallowest drawdown of any strategy,{" "}
            {pct(bt.metrics_net.min_cvar["max_drawdown_%"])} against{" "}
            {pct(bt.metrics_net.equal_weight["max_drawdown_%"])} for equal weight,
            and a risk forecast that survived contact with unseen data: CVaR went
            from {pct(port.portfolios.min_cvar.stats["CVaR95_%"], 3)} to{" "}
            {pct(bt.metrics_net.min_cvar["CVaR95_%"], 3)}, a degradation of{" "}
            {cvarDecay}%. It finished second-to-last on return, because minimising
            tail risk means holding safe, low-returning assets. Someone who ran it
            for the full out-of-sample period ended with{" "}
            {num(1 + bt.metrics_net.min_cvar["total_return_%"] / 100)}x their money
            against {num(1 + bt.metrics_net.equal_weight["total_return_%"] / 100)}x
            for equal weight. That is the trade, and it was never hidden.
          </Note>
          <p>
            None of that makes the optimiser pointless. It makes it a specialist.
            If the objective is the highest Sharpe, the evidence here says do not
            optimise, because the estimation error costs more than the
            optimisation gains. If the objective is to lose less on the worst
            days, the optimiser delivered exactly that, out of sample, in the one
            episode that was never in its training data.
          </p>
        </Section>

        {/* ---------------- 02 why cvar ---------------- */}
        <Section id="why-cvar" index={2} title="Why CVaR rather than variance">
          <p>
            Standard portfolio theory minimises variance. Variance has two
            problems I could not talk myself out of.
          </p>
          <p>
            It treats gains and losses identically, because the deviations get
            squared: a day the portfolio rises 5% and a day it falls 5% contribute
            exactly the same amount to the objective. Nobody has ever complained
            about a portfolio going up, so half of what variance penalises is not
            risk at all. More seriously, variance is only a complete description
            of risk if returns follow a bell curve, and mine do not. Every asset
            here has excess kurtosis far above zero, the S&amp;P 500 at{" "}
            {num(risk.normality.SPY.excess_kurt, 1)} and the Nifty at{" "}
            {num(risk.normality["NIFTYBEES.NS"].excess_kurt, 1)}. Under a normal
            distribution the S&amp;P&apos;s worst day in this sample should have
            been around -5%. It was {pct(risk.normality.SPY["worst_day_%"])}.
          </p>
          <p>
            Value-at-Risk fixes the direction, since it only looks at losses, but
            it has a worse flaw: it is blind to everything past its own threshold.
            VaR 95% says &ldquo;on the worst 5% of days you lose at least
            X&rdquo;, and says nothing whatsoever about how far past X you go. A
            strategy that makes small gains most of the time and occasionally
            loses catastrophically has excellent VaR, right up until the
            catastrophe. VaR is also not subadditive: merging two books can report
            more VaR than the two separately, so it can penalise diversification,
            which is an odd property for a risk measure to have.
          </p>
          <p>
            CVaR is the average loss across all the days beyond that threshold, so
            it responds to the shape of the tail rather than only its edge, and it
            is coherent in the technical sense, meaning combining positions never
            increases measured risk. The two measures disagree here about which
            asset is riskier, which is the cleanest argument for using the second
            one. Indian gold has a <em>lower</em> VaR than the Nifty,{" "}
            {pct(risk.per_asset["GOLDBEES.NS"]["VaR95_%"], 3)} against{" "}
            {pct(risk.per_asset["NIFTYBEES.NS"]["VaR95_%"], 3)}, so by the
            threshold it looks safer. Its CVaR/VaR ratio is{" "}
            {num(risk.per_asset["GOLDBEES.NS"]["CVaR/VaR"])}, the highest in the
            book: it drifts quietly and then lurches. By what actually happens
            past the threshold it is not safer at all.
          </p>

          <Sub>How a moving target becomes a linear program</Sub>
          <p>
            CVaR looks non-convex when you first write it down, because which days
            count as the tail depends on the weights you choose. Change a weight
            and a different set of days becomes the worst 5%, so you are
            optimising a quantity whose own definition keeps moving underneath
            you. Optimising by sorting and averaging the worst 5% directly gives a
            discontinuous objective that a solver cannot work with.
          </p>
          <p>
            Rockafellar and Uryasev&apos;s result is that you can introduce the
            threshold as a free variable and minimise
          </p>
          <div className="overflow-x-auto rounded-lg border border-line bg-surface-2 px-4 py-3 font-mono text-[12.5px] text-ink-muted">
            F(w, z) = z + 1/((1-a)N) * sum_j max(loss_j - z, 0)
          </div>
          <p>
            Two things fall out. Minimising F over z gives exactly the CVaR, so
            the threshold never has to be known in advance, and z at the optimum
            lands exactly on the VaR for free. Convexity is rescued because{" "}
            <C>max(loss - z, 0)</C> is convex and <C>loss_j = -r_j&apos;w</C> is
            linear in the weights, so F is jointly convex in w and z. The kink
            then dissolves entirely: replace each max with a helper variable and
            two linear inequalities, <C>u_j &gt;= loss_j - z</C> and{" "}
            <C>u_j &gt;= 0</C>. What is left is a linear program, with a global
            optimum guaranteed and the same answer on every run. Both claims are
            checked numerically on each run rather than cited.
          </p>
        </Section>

        {/* ---------------- 03 tails ---------------- */}
        <Section id="tails" index={3} title="How fat the tails actually are">
          <p>
            Before optimising anything it is worth measuring how badly the normal
            assumption fails on each asset individually, because that is the gap
            the whole method exists to close. The figure below plots both measures
            for every asset on one logarithmic axis: the hollow mark is VaR 95%,
            the threshold, and the filled mark is CVaR 95%, the average loss once
            you are past it. The gap between them is the fat-tail ratio.
          </p>

          <TailProfile data={tailRows} />

          <p>
            {fattest.label} carries the widest gap in the book at{" "}
            {num(fattest.ratio)}x and {thinnest.label} the narrowest at{" "}
            {num(thinnest.ratio)}x, and the two facts are not interchangeable with
            their volatilities. An asset can have a mild threshold and a brutal
            tail, and the right-hand panel shows that every single asset here
            realises a tail worse than a normal distribution predicts, by between{" "}
            {num(Math.min(...tailRows.map((t) => t.vsNormal)))}x and{" "}
            {num(Math.max(...tailRows.map((t) => t.vsNormal)))}x. Not one asset in
            the universe is Gaussian in the region that matters.
          </p>

          <Table
            minWidth={680}
            head={
              <thead className="bg-surface-2">
                <tr className="border-b border-line">
                  <TH align="left">Asset</TH>
                  <TH>Ann return</TH>
                  <TH>Ann vol</TH>
                  <TH>VaR 95</TH>
                  <TH>CVaR 95</TH>
                  <TH>Max DD</TH>
                  <TH>CVaR/VaR</TH>
                  <TH>vs normal</TH>
                </tr>
              </thead>
            }
            caption={
              <>
                Sorted by CVaR, mildest tail first. CVaR/VaR is the fat-tail
                ratio: how much worse the average bad day is than the threshold
                defining it. The last column is how many times worse the realised
                tail is than a normal distribution predicts, and it is above 1.00
                for every asset in the book. US long treasuries are the
                instructive case: a well-behaved daily tail attached to a{" "}
                {pct(risk.per_asset.TLT["max_drawdown_%"])} drawdown, because
                drawdown depends on the order in which returns arrive and CVaR
                does not.
              </>
            }
          >
            <tbody className="tnum">
              {byTail.map((a) => (
                <tr key={a} className="border-b border-line/70 text-right last:border-b-0">
                  <th scope="row" className="py-2.5 text-left text-[13px] font-medium text-ink-muted">
                    <span
                      aria-hidden
                      className="mr-2 inline-block h-2 w-2 rounded-sm align-middle"
                      style={{ background: colours[a] }}
                    />
                    {ASSET_SHORT[a] ?? a}
                  </th>
                  <td className="px-2 py-2.5 text-ink">{pct(risk.per_asset[a]["ann_return_%"])}</td>
                  <td className="px-2 py-2.5 text-ink-muted">{pct(risk.per_asset[a]["ann_vol_%"])}</td>
                  <td className="px-2 py-2.5 text-ink-muted">{pct(risk.per_asset[a]["VaR95_%"], 3)}</td>
                  <td className="px-2 py-2.5 font-semibold text-ink">{pct(risk.per_asset[a]["CVaR95_%"], 3)}</td>
                  <td className="px-2 py-2.5 text-ink-muted">{pct(risk.per_asset[a]["max_drawdown_%"])}</td>
                  <td className="px-2 py-2.5 text-accent">{num(risk.per_asset[a]["CVaR/VaR"])}</td>
                  <td className="px-2 py-2.5 text-ink-muted">{num(risk.normality[a].understated_by_x)}x</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>

        {/* ---------------- 04 universe ---------------- */}
        <Section id="universe" index={4} title="The universe, and the currency problem">
          <p>
            Twelve assets across five classes, picked so that their bad days do
            not all land on the same dates. Seven are quoted in dollars, five in
            rupees. If I am an Indian investor holding the S&amp;P 500, I make
            money two ways: the index rises, and the dollar strengthens against
            the rupee. Both land in my account, and both are part of the risk I
            carry. Download the dollar price and I am measuring half my return.
          </p>
          <p>
            So every dollar-quoted price is converted to rupees at that day&apos;s
            spot rate <em>before</em> returns are computed, on prices rather than
            by adding two return series together, which makes the compounding
            exact rather than a first-order approximation. Over a few thousand
            days that difference is not cosmetic.
          </p>
          <p>
            To check the conversion rather than trust it, gold is in the universe
            twice: GOLDBEES, an Indian ETF already quoted in rupees, and GLD, an
            American one quoted in dollars. Same metal, two wrappers, so if the
            conversion is correct they have to end up in materially the same
            place. They do, to within an expense-ratio drag and a July 2024
            import-duty cut that moved the Indian wrapper and not the American
            one. A currency bug would have shown up here as a persistent divergence
            between two claims on the same underlying asset.
          </p>
          <Note>
            <strong className="font-semibold text-ink">
              The currency work turned out to be load-bearing, not bookkeeping.
            </strong>{" "}
            I assumed it was plumbing until I replayed 2008. During Lehman the
            rupee fell {num(lehman?.["rupee_move_%"] ?? 0, 1)}%, which lifted every
            unhedged dollar holding measured in rupees at exactly the moment Indian
            equity was collapsing. Average pairwise correlation across the book was{" "}
            {num(lehman?.avg_corr_INR ?? 0, 3)} in rupee terms against{" "}
            {num(lehman?.avg_corr_USD ?? 0, 3)} in dollars, and India against
            global was {num(lehman?.india_vs_global_corr_INR ?? 0, 3)} in rupees
            against {num(lehman?.india_vs_global_corr_USD ?? 0, 3)} in dollars. Had
            I quietly mixed currencies, or simply worked in dollars, the 2008
            result would have been wrong in both magnitude and sign.
          </Note>
        </Section>

        {/* ---------------- 05 scoreboard ---------------- */}
        <Section id="scoreboard" index={5} title="Five strategies, fitted and then tested honestly">
          <p>
            The five strategies span the range from &ldquo;forecast everything&rdquo;
            to &ldquo;forecast nothing&rdquo;, which is the axis the whole
            scoreboard turns out to sort along. Each was solved on the full window
            first, then run again through a walk-forward test that only ever sees
            the past.
          </p>
          <Table
            minWidth={760}
            head={
              <thead className="bg-surface-2">
                <tr className="border-b border-line/70 text-right">
                  <th />
                  <th colSpan={4} className="px-2 pb-1 pt-2 text-center text-[10px] font-medium uppercase tracking-wider text-ink-dim">
                    In sample, full window
                  </th>
                  <th colSpan={5} className="border-l border-line px-2 pb-1 pt-2 text-center text-[10px] font-medium uppercase tracking-wider text-accent">
                    Out of sample, walk-forward
                  </th>
                </tr>
                <tr className="border-b border-line text-right">
                  <TH align="left">Strategy</TH>
                  <TH>Return</TH>
                  <TH>Vol</TH>
                  <TH>CVaR 95</TH>
                  <TH>Sharpe</TH>
                  <TH>Return</TH>
                  <TH>Vol</TH>
                  <TH>CVaR 95</TH>
                  <TH>Sharpe</TH>
                  <TH>Max DD</TH>
                </tr>
              </thead>
            }
            caption={
              <>
                In-sample figures are fitted and scored on the same{" "}
                {port.meta.n_days.toLocaleString("en-IN")} days, so they are an
                upper bound rather than a forecast. Out-of-sample figures come
                from {bt.meta.n_rebalances} quarterly rebalances on a rolling{" "}
                {bt.meta.train_window}-day window, net of{" "}
                {bt.meta.cost_bps_per_traded_notional} bps per unit of traded
                notional. Turnover is one-way per rebalance. Max Sharpe pays
                roughly 0.53 points a year in costs against about 0.10 for the
                others, because it turns over{" "}
                {pct(bt.metrics_net.max_sharpe["avg_turnover_%"], 1)} of the book
                every quarter.
              </>
            }
          >
            <tbody className="tnum">
              {strategies.map((k) => {
                const i = port.portfolios[k].stats;
                const o = bt.metrics_net[k];
                const best = k === head.bestSharpe.key;
                return (
                  <tr key={k} className="border-b border-line/70 text-right">
                    <th scope="row" className="py-2.5 text-left text-[13px] font-medium text-ink-muted">
                      <span
                        aria-hidden
                        className="mr-2 inline-block h-2 w-2 rounded-sm align-middle"
                        style={{ background: STRATEGY_COLOUR[k] }}
                      />
                      {STRATEGY_LABEL[k]}
                    </th>
                    <td className="px-2 py-2.5 text-ink-muted">{pct(i["exp_return_%"])}</td>
                    <td className="px-2 py-2.5 text-ink-muted">{pct(i["ann_vol_%"])}</td>
                    <td className="px-2 py-2.5 text-ink-muted">{pct(i["CVaR95_%"], 3)}</td>
                    <td className="px-2 py-2.5 text-ink-muted">{num(i.sharpe, 3)}</td>
                    <td className="border-l border-line px-2 py-2.5 text-ink">{pct(o["ann_return_%"])}</td>
                    <td className="px-2 py-2.5 text-ink">{pct(o["ann_vol_%"])}</td>
                    <td className="px-2 py-2.5 text-ink">{pct(o["CVaR95_%"], 3)}</td>
                    <td className={`px-2 py-2.5 font-semibold ${best ? "text-accent" : "text-ink"}`}>
                      {num(o.sharpe, 3)}
                    </td>
                    <td className={`px-2 py-2.5 ${k === head.shallowestDrawdown.key ? "font-semibold text-accent" : k === worstRow ? "text-[color:var(--color-data-amber)]" : "text-ink"}`}>
                      {pct(o["max_drawdown_%"])}
                    </td>
                  </tr>
                );
              })}
              {BENCHMARKS.map((k) => {
                const o = bt.metrics_net[k];
                return (
                  <tr key={k} className="border-b border-line/70 text-right last:border-b-0">
                    <th scope="row" className="py-2.5 text-left text-[12.5px] font-normal text-ink-dim">
                      {STRATEGY_LABEL[k]}
                    </th>
                    <td colSpan={4} className="px-2 py-2.5 text-left text-[12px] text-ink-dim">
                      no optimisation
                    </td>
                    <td className="border-l border-line px-2 py-2.5 text-ink-dim">{pct(o["ann_return_%"])}</td>
                    <td className="px-2 py-2.5 text-ink-dim">{pct(o["ann_vol_%"])}</td>
                    <td className="px-2 py-2.5 text-ink-dim">{pct(o["CVaR95_%"], 3)}</td>
                    <td className="px-2 py-2.5 text-ink-dim">{num(o.sharpe, 3)}</td>
                    <td className="px-2 py-2.5 text-ink-dim">{pct(o["max_drawdown_%"])}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>

          <p>
            One benchmark is worth flagging, because it looks like a refutation of
            the whole exercise until you read the second column. Equal weight
            bought once and never rebalanced returns{" "}
            {pct(bt.metrics_net.BH_equal_weight["ann_return_%"])} a year, which
            appears to beat everything, until you notice it ends the period heavily
            concentrated in Bitcoin, carries{" "}
            {pct(bt.metrics_net.BH_equal_weight["ann_vol_%"])} volatility and a{" "}
            {pct(bt.metrics_net.BH_equal_weight["max_drawdown_%"])} drawdown, for a
            Sharpe of {num(bt.metrics_net.BH_equal_weight.sharpe, 3)}. Never
            rebalancing is a momentum bet that happened to pay, not a passive
            baseline.
          </p>

          <Table
            minWidth={560}
            head={
              <thead className="bg-surface-2">
                <tr className="border-b border-line">
                  <TH align="left">Strategy</TH>
                  <TH align="left">Optimises</TH>
                  <TH align="left">Inputs it needs</TH>
                </tr>
              </thead>
            }
            caption={
              <>
                The pattern across the scoreboard is that the less a strategy
                tried to forecast, the better it held up. Max Sharpe is not
                concave as written, so it is solved through the Charnes-Cooper
                transformation; risk parity stated directly is non-convex, so it
                uses the Spinu and Maillard log-barrier form, which also makes a
                zero weight infinitely expensive and so structurally cannot drop
                an asset. The risk-free rate is{" "}
                {pct(port.meta.risk_free_annual * 100, 0)} because the book is in
                rupees.
              </>
            }
          >
            <tbody>
              {strategies.map((k) => (
                <tr key={k} className="border-b border-line/70 last:border-b-0">
                  <th scope="row" className="py-2.5 text-left text-[13px] font-medium text-ink-muted">
                    {STRATEGY_LABEL[k]}
                  </th>
                  <td className="px-2 py-2.5 font-mono text-[12.5px] text-ink">
                    {STRATEGY_SPEC[k].optimises}
                  </td>
                  <td className="px-2 py-2.5 text-[13px] text-ink-muted">
                    {STRATEGY_SPEC[k].inputs}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>

        {/* ---------------- 06 frontier ---------------- */}
        <Section id="frontier" index={6} title="The efficient frontier">
          <p>
            Each point on the curve solves the same question with a different
            constraint: given a floor on expected return, what is the lowest
            achievable CVaR? Nothing exists below the curve, because the optimiser
            has already proved no such portfolio can be constructed from these
            twelve assets, and anything above it is a mistake you are making
            voluntarily. Click any point to see what it holds.
          </p>

          <Frontier
            curve={curve}
            strategies={strategyDots}
            assets={assets}
            assetShort={ASSET_SHORT}
            colours={colours}
          />

          <p>
            The slope is the interesting part, because it is not constant. Going
            from 9% to 18% expected return costs about 0.4 points of CVaR, which
            is close to free, and anyone stopping at the low end of that stretch
            is leaving return on the table for very little reduction in tail risk.
            The last stretch costs several times that per point of return, and the
            far right end collapses onto a single asset, which is where
            diversification stops existing at all and where the drawdown reaches{" "}
            {pct(Math.max(...curve.map((c) => c.dd)))}.
          </p>
          <p>
            The named strategies are plotted as diamonds against that curve. Min
            variance and min CVaR land essentially on top of each other, which is
            itself a finding: with this covariance structure the portfolio that
            minimises symmetric variance and the portfolio that minimises the
            average worst-5% loss are almost the same book. The tail-aware
            objective earns its keep in the crisis replay rather than in the
            fitted weights.
          </p>
        </Section>

        {/* ---------------- 07 walk-forward ---------------- */}
        <Section id="walkforward" index={7} title="The walk-forward test">
          <p>
            Every number before the scoreboard was fitted and scored on the same
            data. The optimiser already knew Bitcoin would rise and that US
            aggregate bonds would cushion COVID, so choosing a portfolio with that
            knowledge is not skill, it is reading the answer sheet. To remove it I
            simulated actually running each strategy: at every quarter-end,
            re-optimise on the trailing {bt.meta.train_window} days only, then hold
            those weights until the next rebalance, paying{" "}
            {bt.meta.cost_bps_per_traded_notional} bps per unit of traded notional,
            which is {bt.meta.cost_bps_per_traded_notional * 2} bps for a full
            round trip.
          </p>
          <p>
            That is {bt.meta.n_rebalances} independent re-optimisations, each one
            blind to everything that came after it, spanning {bt.meta.oos_start} to{" "}
            {bt.meta.oos_end}. The lower panel is the drawdown from each
            series&apos; own running peak, which is where the strategies actually
            separate: the equity curves look similar and the drawdowns do not.
          </p>

          <EquityCurves
            data={equity}
            keys={curveKeys as string[]}
            labels={STRATEGY_LABEL}
            span={`${bt.meta.oos_start} to ${bt.meta.oos_end}`}
          />
        </Section>

        {/* ---------------- 08 allocations ---------------- */}
        <Section id="allocations" index={8} title="What each strategy holds, and how little the scenarios change it">
          <Allocations
            title="Fitted on the full window"
            rows={allocRows}
            assets={assets}
            assetShort={ASSET_SHORT}
            colours={colours}
            height={300}
            caption={
              <>
                The weights say a lot about each objective. Min variance and min
                CVaR both concentrate into four positions, roughly two thirds US
                aggregate bonds. Only Max Sharpe takes a real Bitcoin position,
                and it can afford to: Bitcoin&apos;s correlation with Indian
                equity is low enough that in small size it buys return without
                adding much portfolio risk. Risk parity holds a fraction of that
                instead, because Bitcoin is about five times more volatile than
                the average asset here and equalising risk contribution means
                holding roughly five times less of it. The weights look unequal
                precisely so that the risk comes out equal.
              </>
            }
          />

          <p>
            Historical returns are one path that happened to occur. Optimising
            CVaR on them alone fits the tail to a few hundred specific days, so I
            generated {sc.meta.n_scenarios.toLocaleString("en-IN")} scenarios two
            different ways. A block bootstrap resamples contiguous{" "}
            {sc.meta.block_len}-day blocks, which preserves the volatility
            clustering that single-day resampling destroys, since calm days follow
            calm days and crashes arrive in runs. A multivariate Student-t is
            fitted by expectation-maximisation with a profile likelihood over the
            degrees of freedom, and lands on <V>df {num(tFit.df, 2)}</V>, beating a
            Gaussian by{" "}
            {Math.round(tFit.loglik_t - tFit.loglik_normal).toLocaleString("en-IN")}{" "}
            log-likelihood points, which is not a close contest.
          </p>
          <p>
            One correction was needed along the way. Sampling the raw fit produced
            tails <em>milder</em> than history, which is the opposite of what a
            stress test is for. Maximum-likelihood t-fitting explains outliers
            through the fat tail rather than through variance, so the fitted
            scatter reproduced only {pct(tFit.fitted_vol_vs_sample_vol * 100, 1)} of
            realised volatility. The sampler is therefore variance-matched to the
            sample covariance so that only tail shape varies, with a df=
            {num(tFit.stress_df, 0)} set added for genuine stress.
          </p>

          <Allocations
            title="Min CVaR re-optimised on each scenario set"
            rows={scenarioRows}
            assets={assets}
            assetShort={ASSET_SHORT}
            colours={colours}
            height={270}
            caption={
              <>
                Turnover against the historical optimum is{" "}
                {pct(sc.min_cvar_reoptimised["turnover_vs_historical_%"].block_boot, 2)}{" "}
                for the block bootstrap,{" "}
                {pct(sc.min_cvar_reoptimised["turnover_vs_historical_%"].student_t, 2)}{" "}
                for the fitted Student-t and{" "}
                {pct(sc.min_cvar_reoptimised["turnover_vs_historical_%"].student_t_df3, 2)}{" "}
                under deliberately fatter df=3 tails. Four different views of the
                world, four almost identical portfolios.
              </>
            }
          />
          <p>
            The answer barely moves, which suggests it comes from the structure of
            the assets rather than from the particular days that happened to
            occur. That matters more than it sounds: most portfolio optimisers are
            notoriously hypersensitive to their inputs, and a nudge to an expected
            return can swing a weight by twenty points. This one is not.
          </p>

          <Note>
            <strong className="font-semibold text-ink">
              What neither method can do.
            </strong>{" "}
            The bootstrap cannot invent events absent from history, so its worst
            possible day is literally the worst day that happened,{" "}
            {pct(sc.scenario_set_properties.historical["worst_single_obs_%"])},
            identical across the historical and bootstrap sets. And the Student-t
            badly understates crisis correlation. An elliptical distribution
            generates tail events by scaling every asset with one shared factor,
            which makes moves bigger but not more aligned in direction, so they
            partly cancel inside a portfolio. It produces a world where
            diversification keeps working during a crash. That is exactly
            backwards, and it is why the crisis replay exists.
          </Note>
        </Section>

        {/* ---------------- 09 crisis ---------------- */}
        <Section id="crisis" index={9} title="The 2008 replay, and what it corrected">
          <p>
            The walk-forward window contains COVID and a rate-hiking cycle but no
            credit crisis, and the Student-t provably cannot produce contagion. So
            I replayed real episodes back to 2007 through the fitted portfolios,
            holding the weights fixed and feeding them the returns that actually
            occurred.
          </p>

          <CrisisReplay data={crisisRows} />

          <p>
            {gfc.label} runs {gfc.start} to {gfc.end}. Three series predate the
            episodes and are proxied: the Nifty ETF by the Nifty 50 index, and
            GOLDBEES by GLD converted to rupees. Bitcoin did not exist and no
            proxy for it is defensible, so two bounds are reported rather than one
            invented number. Min CVaR and min variance hold no Bitcoin at all, so
            switching between the two bounds does not move them by a basis point,
            while it moves Max Sharpe by around twelve percentage points. Where an
            assumption is load-bearing, it should be visible, and the toggle makes
            it visible.
          </p>

          <Note>
            <strong className="font-semibold text-ink">The correction.</strong> I
            expected 2008 to show correlations spiking toward 1, the way the
            textbook says. Measured in rupees they went the other way,{" "}
            {num(gfc.contagion_corr, 3)} against a full-sample baseline slightly
            above it, so below normal rather than above. The decomposition
            explains it: contagion did spike in 2008, in dollars, at{" "}
            {num(lehman?.avg_corr_USD ?? 0, 3)}. But the rupee collapsed at the
            same time and lifted every unhedged foreign holding measured in rupees
            exactly as Indian equity fell. COVID is the control, since the rupee
            moved too little to hedge anything, and correlation duly rose to{" "}
            {num(covid.contagion_corr, 3)}, with rupee and dollar terms nearly
            identical.
          </Note>
          <p>
            So the rule I would actually use is not &ldquo;correlations go to 1 in
            a crisis&rdquo;. It is that{" "}
            <V>
              for a rupee book holding unhedged foreign assets, contagion is muted
              in global crises that crash the rupee, and undiluted in crises that
              do not.
            </V>{" "}
            The currency is not a reporting convention, it is a position, and one
            that happened to be short risk in 2008. I would not have found that
            without doing the conversion properly, and I would have drawn the
            wrong conclusion about how much protection the portfolio really had.
          </p>
        </Section>

        {/* ---------------- 10 limits ---------------- */}
        <Section id="limits" index={10} title="Limitations, and what comes next">
          <Bullets
            items={[
              <><V>No credit crisis inside the fit window.</V> Neither of the two shocks it does contain is a 2008-style event, where the correlations underpinning every one of these strategies stop working at once. More history buys tail sample size, not a new category of risk.</>,
              <><V>Regime blending.</V> The window mixes a zero-rate era, a pandemic crash and a hiking cycle into one covariance matrix and one tail sample, which assumes a single stable regime that never existed. Bitcoin&apos;s 2015 behaviour and its 2025 behaviour are barely the same asset.</>,
              <><V>The tail sample is small.</V> CVaR 95% averages the worst 5% of days, so every tail claim rests on about {Math.round(port.meta.n_days * 0.05)} observations. That is far noisier than the volatility estimate, and CVaR 99% would rest on roughly {Math.round(port.meta.n_days * 0.01)} days, which I would not trust.</>,
              <><V>Survivorship.</V> All twelve assets still exist. Picking them today is a selection made with hindsight.</>,
              <><V>The Bitcoin proxy for 2008 is invented.</V> The 3x S&amp;P assumption is mine. The two bounds differ by about twelve percentage points for Max Sharpe, so it materially changes that row.</>,
              <><V>Min CVaR&apos;s 2008 win leans on the rupee.</V> A crisis that left the currency alone would look materially worse, and I have not tested one.</>,
              <><V>Cross-market correlations are a lower bound.</V> The NSE closes 15:30 IST and the NYSE closes 01:30 IST the following morning, so a US close stamped Monday happened ten hours after the Indian close stamped Monday. Same-day cross-market correlations are biased downward, which means the optimiser sees slightly more diversification than really exists.</>,
              <><V>Lookback length and rebalance frequency were chosen, not validated.</V> {bt.meta.train_window} days and quarterly are conventional and defensible, but I picked them knowing how this data behaves. Searching them for the best result would reintroduce look-ahead bias one level up, and the honest fix is a third holdout period this project does not have.</>,
              <><V>Costs are idealised.</V> {bt.meta.cost_bps_per_traded_notional} bps ignores market impact on large orders, Indian capital gains tax, and the fact that nobody actually gets filled at the closing prices this trades at.</>,
            ]}
          />
          <Sub>What I would add next</Sub>
          <p>
            Copula models with explicit tail dependence, to fix the one gap both
            scenario methods share, since a copula can specify that assets move
            together in the tail independently of how they move in the body.
            Regime-switching, so the covariance matrix is not an average of
            incompatible worlds. A rupee-neutral crisis scenario, since min
            CVaR&apos;s best result currently depends on a currency move going its
            way. And CVaR at several confidence levels rather than only 95%, to
            see how much of the answer is an artefact of that one cut point.
          </p>
          <p className="text-[13px] text-ink-dim">
            Built with Python, yfinance, pandas, NumPy, SciPy and CVXPY on the
            CLARABEL solver. Prices from Yahoo Finance, adjusted for splits and
            dividends. This is a student project and not investment advice.
          </p>
        </Section>

        <nav className="-mx-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-4 text-[13px]">
          <a href="#top" className="inline-flex min-h-11 cursor-pointer items-center rounded-lg px-2 text-ink-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink">
            Back to the top
          </a>
          <a
            href={META.repo}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 cursor-pointer items-center rounded-lg px-2 text-ink-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
          >
            Pipeline and full-resolution figures on GitHub
          </a>
        </nav>
      </main>
    </>
  );
}
