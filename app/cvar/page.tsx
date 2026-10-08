import TopBar from "../components/TopBar";
import { Reveal, CountUp } from "../components/Motion";
import { Section, V, StatCard, PaperCTA, SummaryNote } from "../components/Page";
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
  STRATEGIES,
  STRATEGY_LABEL,
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
  { id: "measure", label: "Tail risk and CVaR" },
  { id: "sharpe", label: "In and out of sample" },
  { id: "walkforward", label: "Walk-forward test" },
  { id: "frontier", label: "Efficient frontier" },
  { id: "allocations", label: "Composition" },
  { id: "crisis", label: "Crisis replay" },
  { id: "conclusion", label: "Conclusion" },
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
    student_t: `Student-t (df ${num(sc.student_t_fit.df, 1)})`,
    student_t_df3: `Student-t (df ${num(sc.student_t_fit.stress_df, 0)})`,
  };
  const scenarioRows = Object.keys(scenarioNames).map((s) => ({
    label: scenarioNames[s],
    weights: sc.min_cvar_reoptimised.weights[s],
  }));
  const turnover = sc.min_cvar_reoptimised["turnover_vs_historical_%"];

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
  const vsNormal = tailRows.map((t) => t.vsNormal);

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
  const gfc = crisis.episodes.GFC_lehman_2008;
  const covid = crisis.episodes.covid_2020;

  const cvarDecay = Math.round(
    (bt.metrics_net.min_cvar["CVaR95_%"] /
      port.portfolios.min_cvar.stats["CVaR95_%"] -
      1) * 100,
  );
  const growth = (k: Strategy) => num(1 + bt.metrics_net[k]["total_return_%"] / 100);

  return (
    <>
      <TopBar
        eyebrow="Study 02"
        title="CVaR portfolio optimiser"
        sections={SECTIONS}
        repo={META.repo}
        paper={META.paper}
      />

      <main id="top" className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8">
        {/* ---------------- hero ---------------- */}
        <Reveal>
          <header>
            <p className="eyebrow">Research summary</p>
            <h1 className="mt-2 text-[34px] font-semibold leading-[1.1] tracking-tight text-ink sm:text-[44px]">
              Minimum CVaR had the smallest losses but not the best risk-adjusted
              return
            </h1>
            <p className="mt-5 text-[17.5px] leading-[1.7] text-ink-muted">
              Five ways of building a portfolio from twelve assets, with every
              price measured in rupees, tested on data they were not fitted to, on
              simulated scenarios and in past crises. Equal weighting had the
              highest Sharpe ratio; minimising CVaR gave the smallest drawdown and
              a gain in 2008.
            </p>
            <SummaryNote paper={META.paper} />
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

        {/* ---------------- 01 measure ---------------- */}
        <Section
          id="measure"
          index={1}
          title="Tail risk and CVaR"
          summary="Every asset loses more on its worst days than a normal distribution predicts, which is why the study minimises CVaR rather than variance."
        >
          <TailProfile data={tailRows} />
          <p>
            Value-at-Risk at 95% is the loss exceeded on one day in twenty. CVaR,
            or expected shortfall, is the average loss on those days, so it
            responds to how heavy the tail is. The two can rank assets differently:
            Indian gold has a lower VaR than the Nifty ETF but the highest
            CVaR/VaR ratio of the twelve, {num(risk.per_asset["GOLDBEES.NS"]["CVaR/VaR"])}.
            Every asset&apos;s tail is heavier than a normal distribution allows,
            by a factor of {num(Math.min(...vsNormal))} to{" "}
            {num(Math.max(...vsNormal))}, so a measure built on variance
            understates the risk of all twelve.
          </p>
          <p>
            Minimising CVaR looks hard, because which days form the tail depends
            on the weights. Rockafellar and Uryasev (2000) showed that it can be
            rewritten as a linear program, which is solved here to its global
            optimum and checked numerically on every run.
          </p>
        </Section>

        {/* ---------------- 02 sharpe ---------------- */}
        <Section
          id="sharpe"
          index={2}
          title="In sample and out of sample"
          summary="Four rules did better on unseen data than in sample. Maximum Sharpe, the only rule that relies on forecast returns, did worse."
        >
          <SharpeShift data={shiftData} />
          <p>
            Maximum Sharpe falls from{" "}
            {num(port.portfolios.max_sharpe.stats.sharpe, 3)} to{" "}
            {num(bt.metrics_net.max_sharpe.sharpe, 3)}. Expected returns are
            measured far less precisely than risks, and an optimiser puts the most
            weight on the assets whose returns were most overestimated, the effect
            Michaud (1989) called error maximisation. Equal weighting, which
            estimates nothing, ranks first, but a Jobson-Korkie test gives p-values
            between 0.09 and 0.27 against each optimised rule, so the data cannot
            separate them.
          </p>
        </Section>

        {/* ---------------- 03 walk-forward ---------------- */}
        <Section
          id="walkforward"
          index={3}
          title="Walk-forward test"
          summary={
            <>
              Re-estimated every quarter on past data only and charged costs,
              minimum CVaR had the shallowest drawdown,{" "}
              {pct(bt.metrics_net.min_cvar["max_drawdown_%"])}, at the price of a
              lower return.
            </>
          }
        >
          <EquityCurves
            data={equity}
            keys={curveKeys as string[]}
            labels={STRATEGY_LABEL}
            span={`${bt.meta.oos_start} to ${bt.meta.oos_end}`}
          />
          <p>
            Over {bt.meta.n_rebalances} quarterly rebalances, net of{" "}
            {bt.meta.cost_bps_per_traded_notional} basis points per unit traded,
            one unit in minimum CVaR grows to{" "}
            <V>{growth("min_cvar")}</V> against {growth("equal_weight")} for equal
            weighting, because limiting tail risk concentrates the portfolio in
            low-risk, low-return assets. In exchange its drawdown is{" "}
            {pct(bt.metrics_net.min_cvar["max_drawdown_%"])} against{" "}
            {pct(bt.metrics_net.equal_weight["max_drawdown_%"])} for equal
            weighting, and its realised CVaR is only {cvarDecay}% above the
            in-sample estimate.
          </p>
        </Section>

        {/* ---------------- 04 frontier ---------------- */}
        <Section
          id="frontier"
          index={4}
          title="The CVaR efficient frontier"
          summary="The lowest CVaR available at each expected return. Extra return is cheap at first and expensive near the top."
        >
          <Frontier
            curve={curve}
            strategies={strategyDots}
            assets={assets}
            assetShort={ASSET_SHORT}
            colours={colours}
          />
          <p>
            Equal weighting and risk parity sit to the right of the curve, so they
            carry more tail risk than their expected return requires. Raising the
            expected return from 9% to 18% costs about 0.45 points of CVaR; near
            the top, where the extra return can only come from Bitcoin, each point
            costs several times as much.
          </p>
        </Section>

        {/* ---------------- 05 allocations ---------------- */}
        <Section
          id="allocations"
          index={5}
          title="Composition and scenarios"
          summary={
            <>
              The two minimum-risk rules hold mostly US bonds, and the
              minimum-CVaR weights barely move across{" "}
              {sc.meta.n_scenarios.toLocaleString("en-IN")} simulated scenarios.
            </>
          }
        >
          <Allocations
            title="Weights estimated on the full sample"
            rows={allocRows}
            assets={assets}
            assetShort={ASSET_SHORT}
            colours={colours}
            height={300}
            caption={
              <>
                Minimum variance and minimum CVaR each hold four assets, about two
                thirds in US aggregate bonds. Maximum Sharpe is the only rule with
                a material Bitcoin weight.
              </>
            }
          />
          <p>
            A CVaR estimated from history rests on the few hundred days in its
            tail. To check that the solution does not depend on those particular
            days, the minimum-CVaR portfolio was re-estimated on a block bootstrap
            of history and on Student-t scenarios, including a stress set with
            far heavier tails than the data.
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
                Turnover against the historical solution is{" "}
                {pct(turnover.block_boot, 2)} for the block bootstrap,{" "}
                {pct(turnover.student_t, 2)} for the fitted Student-t and{" "}
                {pct(turnover.student_t_df3, 2)} for the stress set.
              </>
            }
          />
          <p>
            The weights hardly change, so the solution is set by the structure of
            the assets, with bonds carrying the smallest tail, rather than by a
            handful of bad days.
          </p>
        </Section>

        {/* ---------------- 06 crisis ---------------- */}
        <Section
          id="crisis"
          index={6}
          title="Crisis replay and the currency effect"
          summary={
            <>
              In the 2008 replay minimum CVaR gained {signed(head.gfc)} while
              equal weighting lost {pct(Math.abs(head.gfcEqualWeight))}, mainly
              because the falling rupee raised the value of its dollar bonds.
            </>
          }
        >
          <CrisisReplay data={crisisRows} />
          <p>
            The test period holds no credit crisis, so the full-sample weights were
            applied unchanged to the returns of earlier crises, back to 2007. The
            buttons switch between the two 2008 measures, the COVID-19 crash and
            the walk-forward drawdown.
          </p>
          <p>
            Over the 2008 window the dollar rose{" "}
            {num(lehman?.["rupee_move_%"] ?? 0, 1)}% against the rupee, lifting
            the rupee value of every unhedged dollar asset while Indian shares
            fell. Measured in rupees, the average correlation between the assets
            was <V>{num(gfc.contagion_corr, 3)}</V>, below its normal level of{" "}
            {num(crisis.contagion_baseline.avg_corr_ex_btc, 3)}; measured in
            dollars it was {num(lehman?.avg_corr_USD ?? 0, 3)}. In the COVID-19
            crash the dollar rose only {num(covid.currency["rupee_move_%"], 1)}%,
            and correlation rose in both currencies. For a rupee investor the
            exchange rate is part of the portfolio: it was a hedge in 2008, and
            nothing guarantees it will be one next time.
          </p>
        </Section>

        {/* ---------------- 07 conclusion ---------------- */}
        <Section
          id="conclusion"
          index={7}
          title="Conclusion"
          summary="Minimising CVaR delivered the protection it was built for, and not the highest risk-adjusted return."
        >
          <p>
            Out of sample the minimum-CVaR portfolio had the smallest drawdown, a
            tail-risk estimate that held up, weights that barely moved under
            heavy-tailed scenarios and a gain in 2008. Equal weighting had the
            best Sharpe ratio, though not significantly so. The two results answer
            different questions: for the highest risk-adjusted return the evidence
            here favours not optimising, and for smaller losses on the worst days
            the optimiser did its job.
          </p>
          <PaperCTA paper={META.paper} repo={META.repo}>
            The paper has the linear program, the Jobson-Korkie tests, the
            scenario generators, all seven crisis windows measured in rupees and
            in dollars, and the limitations of the study.
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
