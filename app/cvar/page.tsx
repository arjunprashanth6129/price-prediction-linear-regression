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
  { id: "findings", label: "Main result" },
  { id: "why-cvar", label: "Risk measures" },
  { id: "tails", label: "Tail risk by asset" },
  { id: "universe", label: "Universe and currency" },
  { id: "scoreboard", label: "Results" },
  { id: "frontier", label: "Efficient frontier" },
  { id: "walkforward", label: "Walk-forward test" },
  { id: "allocations", label: "Composition" },
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
    // Non-breaking space, so a narrow axis wraps after "Student-t" and never
    // inside the brackets.
    student_t: `Student-t (df\u00a0${num(sc.student_t_fit.df, 1)})`,
    student_t_df3: `Student-t (df\u00a0${num(sc.student_t_fit.stress_df, 0)})`,
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
              Minimum-CVaR portfolio construction for a rupee-based investor
            </h1>
            <p className="mt-5 text-[17.5px] leading-[1.7] text-ink-muted">
              Five allocation rules on twelve assets measured in rupees,
              evaluated in sample, out of sample, on simulated scenarios and in
              historical crises.
            </p>

            <div className="mt-7 rounded-xl border-l-2 border-accent bg-surface px-6 py-5">
              <p className="eyebrow">Abstract</p>
              <p className="mt-3 text-[14.5px] leading-[1.8] text-ink-muted">
                This study compares equal weighting, minimum variance, maximum
                Sharpe ratio, risk parity and minimum Conditional Value-at-Risk
                (CVaR) on twelve assets across Indian equity, global equity,
                gold, bonds and Bitcoin, with dollar prices converted to rupees at
                the daily spot rate, over{" "}
                {port.meta.n_days.toLocaleString("en-IN")} trading days from{" "}
                {port.meta.start} to {port.meta.end}. Minimum CVaR is solved as a
                linear program using the Rockafellar-Uryasev formulation. Each rule
                is evaluated in a walk-forward backtest of {bt.meta.n_rebalances}{" "}
                quarterly rebalances net of costs, on{" "}
                {sc.meta.n_scenarios.toLocaleString("en-IN")} simulated scenarios,
                and in a replay of the 2008 crisis. Equal weighting has the highest
                out-of-sample Sharpe ratio, <V>{num(head.bestSharpe.value, 3)}</V>,
                although its differences from the optimised rules are not
                statistically significant. Minimum CVaR has the smallest maximum
                drawdown, <V>{pct(head.shallowestDrawdown.value)}</V>, and gains{" "}
                <V>{signed(head.gfc)}</V> in the 2008 replay while equal weighting
                loses {pct(Math.abs(head.gfcEqualWeight))}, mainly because the
                rupee depreciation raised the value of its dollar bond holdings.
              </p>
            </div>
          </header>
        </Reveal>

        <Reveal delay={60}>
          <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              value={<CountUp value={head.bestSharpe.value} decimals={3} />}
              label="Highest out-of-sample Sharpe"
              detail={`${STRATEGY_LABEL[head.bestSharpe.key]}. Differences from the optimised rules are not significant at 5%.`}
              tone="accent"
            />
            <StatCard
              value={<CountUp value={head.shallowestDrawdown.value} decimals={2} suffix="%" />}
              label="Smallest maximum drawdown"
              detail={`Minimum CVaR, against ${pct(bt.metrics_net.equal_weight["max_drawdown_%"])} for equal weighting, out of sample.`}
            />
            <StatCard
              value={<CountUp value={head.gfc} decimals={2} prefix="+" suffix="%" />}
              label="Minimum CVaR in the 2008 replay"
              detail={`Equal weighting lost ${pct(Math.abs(head.gfcEqualWeight))}. Most of the difference is the rupee depreciation.`}
            />
            <StatCard
              value={<CountUp value={head.worstShift.value} decimals={3} />}
              label="Maximum Sharpe, change in Sharpe"
              detail="The only rule whose Sharpe ratio fell out of sample, and the only one that estimates expected returns."
            />
          </div>
        </Reveal>

        {/* ---------------- 01 findings ---------------- */}
        <Section id="findings" index={1} title="Main result">
          <p>
            The minimum-CVaR rule was designed to reduce the expected loss on the
            worst 5% of days, and out of sample it did. It did not produce the
            highest risk-adjusted return. Evaluated on data not used for
            estimation, the equally weighted portfolio, which requires no
            covariance matrix, no return forecasts and no optimisation, had the
            highest Sharpe ratio.
          </p>
          <p>
            This is consistent with the effect Michaud (1989) called{" "}
            <V>error maximisation</V>. An optimiser assigns the largest weights
            to the assets whose expected returns or risks are most favourably
            misestimated in the sample, because it cannot distinguish
            misestimation from genuine attractiveness. DeMiguel, Garlappi and
            Uppal (2009) found that equal weighting is difficult to beat out of
            sample for this reason.
          </p>

          <SharpeShift data={shiftData} />

          <p>
            Each pair of bars compares a rule&apos;s in-sample and out-of-sample
            Sharpe ratio. Four rules improved out of sample. Maximum Sharpe fell
            from {num(port.portfolios.max_sharpe.stats.sharpe, 3)} to{" "}
            {num(bt.metrics_net.max_sharpe.sharpe, 3)}; it is the only rule that
            uses estimated expected returns, which are measured far less
            precisely than variances. Minimum CVaR improved by{" "}
            {head.shifts.min_cvar >= 0 ? "+" : ""}
            {num(head.shifts.min_cvar, 3)}, the largest increase of the five.
          </p>
          <p>
            The Sharpe differences are not statistically significant. A
            Jobson-Korkie test with Memmel&apos;s correction, on daily excess
            returns over the 8.9-year out-of-sample period, gives p-values
            between 0.08 and 0.26 for equal weighting against each optimised
            rule. The data are consistent with equal weighting performing at
            least as well as the optimised rules, but do not establish that it
            performs better.
          </p>
          <Note>
            <strong className="font-semibold text-ink">
              What the minimum-CVaR rule achieved.
            </strong>{" "}
            The smallest maximum drawdown,{" "}
            {pct(bt.metrics_net.min_cvar["max_drawdown_%"])} against{" "}
            {pct(bt.metrics_net.equal_weight["max_drawdown_%"])} for equal
            weighting, and a realised CVaR of{" "}
            {pct(bt.metrics_net.min_cvar["CVaR95_%"], 3)} against an in-sample
            estimate of {pct(port.portfolios.min_cvar.stats["CVaR95_%"], 3)}, an
            increase of {cvarDecay}%. Its return was the second lowest: one unit
            invested grew to{" "}
            {num(1 + bt.metrics_net.min_cvar["total_return_%"] / 100)} over the
            out-of-sample period, against{" "}
            {num(1 + bt.metrics_net.equal_weight["total_return_%"] / 100)} for
            equal weighting.
          </Note>
          <p>
            The two results describe different objectives. For the highest Sharpe
            ratio, the evidence here favours not optimising, because estimation
            error offsets the gain. For smaller losses on the worst days, the
            optimiser delivered out of sample and again in 2008, a period outside
            its estimation data.
          </p>
        </Section>

        {/* ---------------- 02 why cvar ---------------- */}
        <Section id="why-cvar" index={2} title="Variance, VaR and CVaR">
          <p>
            Mean-variance optimisation measures risk by variance, which has two
            limitations. It penalises gains and losses symmetrically, because
            deviations are squared, so a 5% rise contributes as much as a 5% fall.
            And it is a complete description of risk only for normally
            distributed returns. These returns are not normal: excess kurtosis is{" "}
            {num(risk.normality.SPY.excess_kurt, 1)} for the S&amp;P 500 ETF and{" "}
            {num(risk.normality["NIFTYBEES.NS"].excess_kurt, 1)} for the Nifty
            ETF. A normal distribution with the S&amp;P 500 ETF&apos;s mean and
            variance implies a worst day near -5% in this sample; the realised
            worst day was {pct(risk.normality.SPY["worst_day_%"])}.
          </p>
          <p>
            Value-at-Risk (VaR) at 95% is the loss exceeded on 5% of days. It
            measures only losses, but it ignores how large losses are beyond the
            threshold, and it is not subadditive: the VaR of a combined portfolio
            can exceed the sum of the VaRs of its parts, so it can penalise
            diversification.
          </p>
          <p>
            CVaR, also called expected shortfall, is the expected loss on the days
            beyond the VaR threshold. It reflects the shape of the tail and is a
            coherent risk measure in the sense of Artzner et al. (1999), so it is
            subadditive. The two measures can rank assets differently. Indian gold
            has a lower VaR than the Nifty ETF,{" "}
            {pct(risk.per_asset["GOLDBEES.NS"]["VaR95_%"], 3)} against{" "}
            {pct(risk.per_asset["NIFTYBEES.NS"]["VaR95_%"], 3)}, but its CVaR/VaR
            ratio is {num(risk.per_asset["GOLDBEES.NS"]["CVaR/VaR"])}, the highest
            of the twelve assets, so its losses beyond the threshold are large
            relative to the threshold.
          </p>

          <Sub>Minimum CVaR as a linear program</Sub>
          <p>
            Which days form the 5% tail depends on the weights, so CVaR cannot be
            minimised by sorting losses for a fixed portfolio; the resulting
            objective is not smooth. Rockafellar and Uryasev (2000) show that CVaR
            is the minimum over a threshold variable z of
          </p>
          <div className="overflow-x-auto rounded-lg border border-line bg-surface-2 px-4 py-3 font-mono text-[12.5px] text-ink-muted">
            F(w, z) = z + 1/((1-a)N) * sum_j max(loss_j - z, 0)
          </div>
          <p>
            and that the minimising z is the VaR. Because each{" "}
            <C>loss_j = -r_j&apos;w</C> is linear in the weights and the positive
            part of a linear function is convex, F is jointly convex in w and z.
            Replacing each positive part with an auxiliary variable u_j and the
            constraints <C>u_j &gt;= loss_j - z</C> and <C>u_j &gt;= 0</C> gives
            a linear program, which is solved to its global optimum. Both
            properties are verified numerically on every run.
          </p>
        </Section>

        {/* ---------------- 03 tails ---------------- */}
        <Section id="tails" index={3} title="Tail risk by asset">
          <p>
            The figure below plots VaR 95% (hollow marker) and CVaR 95% (filled
            marker) for each asset on a logarithmic axis. The gap between them is
            the CVaR/VaR ratio, a measure of how heavy the tail is beyond the
            threshold.
          </p>

          <TailProfile data={tailRows} />

          <p>
            {fattest.label} has the largest ratio at {num(fattest.ratio)} and{" "}
            {thinnest.label} the smallest at {num(thinnest.ratio)}; neither
            ordering follows volatility. The right panel divides each
            asset&apos;s realised CVaR by the CVaR of a normal distribution with
            the same mean and variance. The ratio exceeds 1 for every asset,
            ranging from {num(Math.min(...tailRows.map((t) => t.vsNormal)))} to{" "}
            {num(Math.max(...tailRows.map((t) => t.vsNormal)))}.
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
                Sorted by CVaR, smallest first. The last column is realised CVaR
                divided by the CVaR of a normal distribution with the same mean
                and variance. Daily tail measures and drawdown can differ
                substantially: US long-term Treasuries have a moderate daily tail
                but a {pct(risk.per_asset.TLT["max_drawdown_%"])} maximum
                drawdown, because drawdown depends on the sequence of returns and
                CVaR does not.
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
        <Section id="universe" index={4} title="Universe and currency conversion">
          <p>
            The twelve assets span five classes chosen so that their large losses
            tend not to coincide. Seven are quoted in dollars and five in rupees.
            For a rupee-based investor, the return on a dollar asset combines the
            asset&apos;s dollar return and the change in the USD/INR rate, and
            both are part of the investor&apos;s risk.
          </p>
          <p>
            Dollar prices are therefore multiplied by the daily spot rate before
            returns are computed. Converting prices, rather than adding the asset
            return and the currency return, compounds the two components exactly
            rather than to first order.
          </p>
          <p>
            The conversion is checked by including gold twice: GOLDBEES, an Indian
            ETF priced in rupees, and GLD, a US ETF priced in dollars. If the
            conversion is correct, the two should finish close together, and they
            do, apart from an expense-ratio difference and a fall in domestic gold
            prices when India cut its import duty in July 2024. An error in the
            conversion would appear as a persistent divergence between the two.
          </p>
          <Note>
            <strong className="font-semibold text-ink">
              The conversion determines the 2008 result.
            </strong>{" "}
            During the 2008 crisis window the rupee depreciated by{" "}
            {num(lehman?.["rupee_move_%"] ?? 0, 1)}%, raising the rupee value of
            every unhedged dollar asset while Indian equity prices fell. Average
            pairwise correlation was {num(lehman?.avg_corr_INR ?? 0, 3)} in rupee
            terms and {num(lehman?.avg_corr_USD ?? 0, 3)} in dollar terms, and the
            correlation between Indian and global assets was{" "}
            {num(lehman?.india_vs_global_corr_INR ?? 0, 3)} in rupees against{" "}
            {num(lehman?.india_vs_global_corr_USD ?? 0, 3)} in dollars. An
            analysis in dollars would have reached a different conclusion about
            the portfolio&apos;s crisis behaviour.
          </Note>
        </Section>

        {/* ---------------- 05 scoreboard ---------------- */}
        <Section id="scoreboard" index={5} title="In-sample and out-of-sample results">
          <p>
            The five rules range from estimating expected returns and covariances
            (maximum Sharpe) to estimating nothing (equal weighting). Each was
            estimated on the full sample and then re-run in a walk-forward test
            that uses only past data.
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
                In-sample figures are estimated and evaluated on the same{" "}
                {port.meta.n_days.toLocaleString("en-IN")} days and are an upper
                bound. Out-of-sample figures come from {bt.meta.n_rebalances}{" "}
                quarterly rebalances on a trailing {bt.meta.train_window}-day
                window, net of {bt.meta.cost_bps_per_traded_notional} bps per unit
                of traded notional. Sharpe is the geometric annual return less 6%,
                divided by annualised volatility. Maximum Sharpe turns over{" "}
                {pct(bt.metrics_net.max_sharpe["avg_turnover_%"], 1)} of the
                portfolio per quarter and pays about 0.53 percentage points a year
                in costs, against about 0.10 for the other rules.
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
            The never-rebalanced equal-weight portfolio returns{" "}
            {pct(bt.metrics_net.BH_equal_weight["ann_return_%"])} a year, the
            highest of any row, but by the end of the sample it is concentrated in
            Bitcoin, with {pct(bt.metrics_net.BH_equal_weight["ann_vol_%"])}{" "}
            volatility, a {pct(bt.metrics_net.BH_equal_weight["max_drawdown_%"])}{" "}
            drawdown and a Sharpe ratio of{" "}
            {num(bt.metrics_net.BH_equal_weight.sharpe, 3)}. Without rebalancing,
            an equal-weight portfolio becomes a concentrated position in the asset
            with the highest past return, so it is not a neutral benchmark.
          </p>

          <Table
            minWidth={560}
            head={
              <thead className="bg-surface-2">
                <tr className="border-b border-line">
                  <TH align="left">Strategy</TH>
                  <TH align="left">Objective</TH>
                  <TH align="left">Inputs required</TH>
                </tr>
              </thead>
            }
            caption={
              <>
                Maximum Sharpe is not concave as stated and is solved through the
                Charnes-Cooper transformation. Risk parity is solved in the
                log-barrier form of Spinu (2013), whose solution has equal risk
                contributions; the barrier makes a zero weight infeasible, so every
                asset is held. The risk-free rate is{" "}
                {pct(port.meta.risk_free_annual * 100, 0)}, a rupee rate.
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
        <Section id="frontier" index={6} title="The CVaR efficient frontier">
          <p>
            Each point on the curve is the minimum CVaR attainable subject to a
            lower bound on expected return. No long-only portfolio of the twelve
            assets lies above or to the left of it; portfolios below or to the
            right, such as equal weighting and risk parity, carry more tail risk
            than their expected return requires. Each point can be selected to
            show its holdings.
          </p>

          <Frontier
            curve={curve}
            strategies={strategyDots}
            assets={assets}
            assetShort={ASSET_SHORT}
            colours={colours}
          />

          <p>
            The marginal cost of expected return in CVaR rises along the curve.
            Raising expected return from 9% to 18% increases CVaR by about 0.4
            percentage points; the final segment costs several times as much per
            point of return. The highest-return point holds a single asset and
            has a maximum drawdown of {pct(Math.max(...curve.map((c) => c.dd)))}.
          </p>
          <p>
            Minimum variance and minimum CVaR lie almost on top of each other. With
            this covariance structure, the portfolio that minimises variance and
            the one that minimises the expected worst-5% loss are nearly the same.
            The difference between the two objectives appears in the crisis
            replay rather than in the fitted weights.
          </p>
        </Section>

        {/* ---------------- 07 walk-forward ---------------- */}
        <Section id="walkforward" index={7} title="Walk-forward backtest">
          <p>
            In-sample statistics use the same data for estimation and evaluation:
            the optimiser already observes, for example, Bitcoin&apos;s rise and
            the behaviour of US bonds during COVID-19. The walk-forward test
            removes that advantage. At each quarter-end every rule is re-estimated
            on the trailing {bt.meta.train_window} days only and held until the
            next rebalance, paying {bt.meta.cost_bps_per_traded_notional} bps per
            unit of traded notional ({bt.meta.cost_bps_per_traded_notional * 2}{" "}
            bps for a complete replacement of the portfolio).
          </p>
          <p>
            There are {bt.meta.n_rebalances} rebalances from {bt.meta.oos_start} to{" "}
            {bt.meta.oos_end}, each using only data available at the time. The
            lower panel shows each series&apos; drawdown from its own running
            peak, which separates the rules more clearly than the growth curves.
          </p>

          <EquityCurves
            data={equity}
            keys={curveKeys as string[]}
            labels={STRATEGY_LABEL}
            span={`${bt.meta.oos_start} to ${bt.meta.oos_end}`}
          />
        </Section>

        {/* ---------------- 08 allocations ---------------- */}
        <Section id="allocations" index={8} title="Portfolio composition and scenario sensitivity">
          <Allocations
            title="Weights estimated on the full sample"
            rows={allocRows}
            assets={assets}
            assetShort={ASSET_SHORT}
            colours={colours}
            height={300}
            caption={
              <>
                Minimum variance and minimum CVaR each hold four assets, with
                roughly two thirds in US aggregate bonds. Maximum Sharpe is the
                only rule with a material Bitcoin allocation; Bitcoin&apos;s low
                correlation with Indian equity lets a small position add expected
                return with little effect on variance. Risk parity holds less,
                because Bitcoin&apos;s volatility is about five times the average
                of the other assets and equal risk contribution requires a
                correspondingly smaller weight.
              </>
            }
          />

          <p>
            A CVaR estimated from history depends on the few hundred days that form
            its tail. To test sensitivity to that sample, the minimum-CVaR
            portfolio is re-estimated on{" "}
            {sc.meta.n_scenarios.toLocaleString("en-IN")} scenarios from two
            generators. A block bootstrap resamples contiguous{" "}
            {sc.meta.block_len}-day blocks of history, which preserves the
            clustering of volatility that single-day resampling destroys. A
            multivariate Student-t distribution is fitted by the EM algorithm with
            a profile likelihood over the degrees of freedom; the estimate is{" "}
            <V>{num(tFit.df, 2)}</V> degrees of freedom, with a log-likelihood{" "}
            {Math.round(tFit.loglik_t - tFit.loglik_normal).toLocaleString("en-IN")}{" "}
            above that of a multivariate normal.
          </p>
          <p>
            Sampling directly from the fitted t produced tails thinner than the
            historical data. Maximum-likelihood estimation of a t distribution
            attributes extreme observations to the heavy tail rather than to the
            scale matrix, and the fitted scale implied only{" "}
            {pct(tFit.fitted_vol_vs_sample_vol * 100, 1)} of the sample
            volatility. The sampler is therefore rescaled to the sample
            covariance so that only the tail shape differs, and a set with{" "}
            {num(tFit.stress_df, 0)} degrees of freedom is added as a stress case.
          </p>

          <Allocations
            title="Minimum CVaR re-estimated on each scenario set"
            rows={scenarioRows}
            assets={assets}
            assetShort={ASSET_SHORT}
            colours={colours}
            height={270}
            caption={
              <>
                Turnover relative to the historical solution is{" "}
                {pct(sc.min_cvar_reoptimised["turnover_vs_historical_%"].block_boot, 2)}{" "}
                for the block bootstrap,{" "}
                {pct(sc.min_cvar_reoptimised["turnover_vs_historical_%"].student_t, 2)}{" "}
                for the fitted Student-t and{" "}
                {pct(sc.min_cvar_reoptimised["turnover_vs_historical_%"].student_t_df3, 2)}{" "}
                for the stress set with 3 degrees of freedom.
              </>
            }
          />
          <p>
            The solution changes little across scenario sets, which indicates that
            it is determined mainly by the structure of the assets rather than by
            the particular days in the sample. Mean-variance solutions, by
            contrast, are known to be highly sensitive to small changes in
            expected returns.
          </p>

          <Note>
            <strong className="font-semibold text-ink">
              Limitations of both generators.
            </strong>{" "}
            The bootstrap cannot produce a loss larger than the largest historical
            loss; the worst single-asset daily return is{" "}
            {pct(sc.scenario_set_properties.historical["worst_single_obs_%"])} in
            both the historical and bootstrap sets. The Student-t understates the
            rise in correlation during crises. An elliptical distribution
            generates extreme observations by scaling all assets by a common
            factor, which increases their magnitude without aligning their signs,
            so diversification continues to work in its tails. Longin and Solnik
            (2001) find that correlations between equity markets rise in bear
            markets. The next section therefore uses historical crises directly.
          </Note>
        </Section>

        {/* ---------------- 09 crisis ---------------- */}
        <Section id="crisis" index={9} title="Crisis replay and the currency effect">
          <p>
            The out-of-sample period contains COVID-19 and a tightening cycle but
            no credit crisis, and the Student-t generator cannot reproduce crisis
            correlation. The full-sample weights were therefore applied, unchanged,
            to the realised returns of historical episodes back to 2007.
          </p>

          <CrisisReplay data={crisisRows} />

          <p>
            The 2008 window runs from {gfc.start}, shortly before the failure of
            Lehman Brothers, to the market low on {gfc.end}. Three series did not
            exist for the whole window. The Nifty ETF is replaced by the Nifty 50
            index and GOLDBEES by GLD converted to rupees. Bitcoin did not exist,
            and no proxy is defensible, so two bounds are shown: Bitcoin removed,
            and Bitcoin returning three times the S&amp;P 500. Minimum CVaR and
            minimum variance hold no Bitcoin and are unaffected; the assumption
            changes the maximum-Sharpe result by about 12 percentage points. The
            control above the chart switches between the bounds.
          </p>

          <Note>
            <strong className="font-semibold text-ink">
              Correlation in 2008, in rupees and in dollars.
            </strong>{" "}
            Average pairwise correlation in rupee terms during the 2008 window was{" "}
            {num(gfc.contagion_corr, 3)}, below its normal level of about 0.22 for
            the same assets rather than above it. A separate decomposition of the
            same window gives {num(lehman?.avg_corr_INR ?? 0, 3)} in rupees and{" "}
            {num(lehman?.avg_corr_USD ?? 0, 3)} in dollars. The rupee depreciated by{" "}
            {num(lehman?.["rupee_move_%"] ?? 0, 1)}% over the same period, raising
            the rupee value of unhedged foreign holdings as Indian equity fell.
            COVID-19 provides a comparison: the rupee moved too little to offset
            asset returns, and correlation rose to {num(covid.contagion_corr, 3)},
            with similar values in both currencies.
          </Note>
          <p>
            These episodes suggest a qualified rule for a rupee-based portfolio
            with unhedged foreign assets:{" "}
            <V>
              correlations are dampened in global crises accompanied by a large
              rupee depreciation, and are not dampened otherwise.
            </V>{" "}
            The exchange rate acts as a position in the portfolio, and in 2008 it
            acted as a hedge.
          </p>
        </Section>

        {/* ---------------- 10 limits ---------------- */}
        <Section id="limits" index={10} title="Limitations and further work">
          <Bullets
            items={[
              <><V>No credit crisis in the estimation window.</V> Neither shock in the window is comparable to 2008. A longer sample adds tail observations but not a different kind of event.</>,
              <><V>Regime mixing.</V> Near-zero rates, a pandemic and a tightening cycle are combined in one covariance matrix and tail sample. Bitcoin&apos;s return distribution in 2015 and in 2025 differs substantially.</>,
              <><V>Small tail sample.</V> CVaR at 95% averages about {Math.round(port.meta.n_days * 0.05)} observations, which makes it much noisier than a volatility estimate. CVaR at 99% would average about {Math.round(port.meta.n_days * 0.01)}.</>,
              <><V>Survivorship.</V> All twelve assets exist today and were selected with that knowledge.</>,
              <><V>Bitcoin in 2008.</V> The three-times-S&amp;P assumption is arbitrary, and the two bounds differ by about 12 percentage points for maximum Sharpe.</>,
              <><V>Exchange-rate dependence.</V> Minimum CVaR&apos;s 2008 result depends on the rupee depreciation. A crisis without one would produce a worse outcome and has not been tested.</>,
              <><V>Asynchronous closes.</V> The NSE closes at 15:30 IST and the NYSE at 01:30 IST the next day, so same-date closes are about ten hours apart and cross-market correlations are biased towards zero.</>,
              <><V>Parameters chosen, not validated.</V> The {bt.meta.train_window}-day window and quarterly rebalancing are conventional choices made with knowledge of the data. Selecting them by backtest performance would require a further holdout period.</>,
              <><V>Costs.</V> {bt.meta.cost_bps_per_traded_notional} bps per unit traded excludes the market impact of large orders and Indian capital gains tax, and assumes execution at closing prices.</>,
            ]}
          />
          <Sub>Further work</Sub>
          <p>
            Copula models with explicit tail dependence, which can raise
            correlation in the tails independently of the marginal distributions.
            Regime-switching models, so that covariance and tail estimates
            condition on the market state. A currency-neutral crisis scenario, to
            measure the minimum-CVaR portfolio&apos;s crisis performance without a
            rupee depreciation. And CVaR at several confidence levels, to test
            how far the results depend on the 95% level.
          </p>
          <p className="text-[13px] text-ink-dim">
            Built with Python, yfinance, pandas, NumPy, SciPy and CVXPY with the
            CLARABEL solver. Prices from Yahoo Finance, adjusted for splits and
            dividends. This is a student project and not investment advice.
          </p>
        </Section>

        <nav className="-mx-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-4 text-[13px]">
          <a href="#top" className="inline-flex min-h-11 cursor-pointer items-center rounded-lg px-2 text-ink-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink">
            Back to the top
          </a>
          <a
            href={`${META.repo}/blob/master/docs/REPORT.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 cursor-pointer items-center rounded-lg px-2 text-ink-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
          >
            Full report
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
