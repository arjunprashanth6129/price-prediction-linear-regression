import Link from "next/link";
import TopBar from "./components/TopBar";
import { Reveal } from "./components/Motion";
import { IconArrowRight, IconGitHub } from "./components/Icons";
import { SITE, PROJECTS } from "@/lib/project";
import { getAllMlSignals, getMlSummary } from "@/lib/ml";
import { getBacktest, getCvarHeadline, getPortfolios, getScenarios } from "@/lib/cvar";
import { getPairsMeta, getPairsSummary } from "@/lib/pairs";

export const metadata = {
  title: SITE.name,
  description: SITE.description,
};

export default function Home() {
  const ml = getMlSummary();
  const mlAll = Object.values(getAllMlSignals());
  const bt = getBacktest();
  const port = getPortfolios();
  const cv = getCvarHeadline();
  const sc = getScenarios();
  const pm = getPairsMeta();
  const ps = getPairsSummary();

  const pct = (v: number, d = 2) => `${v.toFixed(d)}%`;
  const year = (d: string) => d.slice(0, 4);

  // Stocks whose directional accuracy is significantly above 50%: two-sided
  // binomial test by the normal approximation with a continuity correction,
  // the same test the study page reports.
  const sigAbove = mlAll.filter((r) => {
    const k = Math.round(r.dirAccuracy * r.testDays);
    const z = (Math.abs(k - r.testDays / 2) - 0.5) / Math.sqrt(r.testDays / 4);
    return k > r.testDays / 2 && z > 1.959964;
  }).length;

  const scale: Record<string, { k: string; v: string }[]> = {
    "/linear-regression": [
      { k: "NSE stocks modelled", v: `${ml.total}` },
      { k: "Daily closes per stock", v: "~1,750" },
      { k: "Held out for testing", v: `${Math.round(ml.avgTestDays)} days` },
      { k: "Features per model", v: "4" },
    ],
    "/cvar": [
      { k: "Assets, all in rupees", v: `${port.meta.assets.length}` },
      { k: "Trading days", v: port.meta.n_days.toLocaleString("en-IN") },
      { k: "Quarterly rebalances", v: `${bt.meta.n_rebalances}` },
      { k: "Simulated scenarios", v: sc.meta.n_scenarios.toLocaleString("en-IN") },
    ],
    "/pairs-trading": [
      { k: "Bank stocks", v: `${pm.traded.length}` },
      { k: "Candidate pairs tested", v: `${pm.candidate_pairs}` },
      { k: "Formation windows", v: `${pm.n_windows}` },
      { k: "Round trips traded", v: ps.trades.n_trades.toLocaleString("en-IN") },
    ],
  };

  const summary: Record<string, React.ReactNode> = {
    "/linear-regression": (
      <>
        Do moving averages predict tomorrow&apos;s return? I estimated one
        linear regression per stock for {ml.total}{" "}NSE companies on five and a
        half years of daily prices, then tested each on the sixteen months that
        followed. The forecasts called the direction of the next day&apos;s move{" "}
        {pct(ml.avgDirAccuracy * 100, 1)} of the time, and{" "}
        {sigAbove === 0
          ? "no stock's accuracy was"
          : `${sigAbove} stocks' accuracy was`}{" "}
        significantly better than a coin toss.
      </>
    ),
    "/cvar": (
      <>
        Can a portfolio be built to lose less on its worst days, and what does
        that cost? I compared five allocation rules on twelve assets, from
        Indian equities to US bonds and Bitcoin, all measured in rupees,
        re-estimating each one every quarter from {year(bt.meta.oos_start)} to{" "}
        {year(bt.meta.oos_end)}. The minimum-CVaR portfolio had the smallest
        drawdown, {pct(cv.shallowestDrawdown.value)} against{" "}
        {pct(bt.metrics_net.equal_weight["max_drawdown_%"])} for an equal-weight
        portfolio, and gained {pct(cv.gfc)} in a replay of the 2008 crisis. The
        equal-weight portfolio still had the best risk-adjusted return.
      </>
    ),
    "/pairs-trading": (
      <>
        Do bank stocks that moved together last year keep doing so? Every six
        months I selected the pairs among eleven Indian banks that passed a
        cointegration test and traded them over the next six months, from{" "}
        {year(pm.oos_start)} to {year(pm.oos_end)}. Before costs the strategy earned{" "}
        {pct(ps.gross["ann_return_%"])} a year, which cannot be distinguished
        from zero, because pairs that broke apart outnumbered those that
        converged by almost two to one.
      </>
    ),
  };

  const method: Record<string, string> = {
    "/linear-regression":
      "OLS on four standardised price features; chronological 80/20 split; benchmarks of an always-up rule, 50% and the test-period mean.",
    "/cvar": `CVaR minimised as a linear program (Rockafellar and Uryasev, 2000); walk-forward backtest with ${bt.meta.n_rebalances} quarterly rebalances, net of costs; ${sc.meta.n_scenarios.toLocaleString("en-IN")} simulated scenarios; replay of historical crises.`,
    "/pairs-trading": `Engle-Granger selection on ${pm.formation_months}-month formation periods; z-score entry at ${pm.entry_z}, exit at ${pm.exit_z}, stop at ${pm.stop_z}; ${pm.bps_per_leg} bps per leg at entry and exit.`,
  };

  return (
    <>
      <TopBar eyebrow="Quantitative finance" title={SITE.name} />

      <main className="mx-auto w-full max-w-4xl px-5 py-14 sm:px-8 sm:py-20">
        <Reveal>
          <header className="max-w-2xl">
            <p className="eyebrow">{SITE.author} Prashanth · Quantitative finance research</p>
            <h1 className="mt-3 text-[38px] font-semibold leading-[1.08] tracking-tight text-ink sm:text-[52px]">
              {SITE.name}
            </h1>
            <p className="mt-4 text-[18px] leading-[1.6] text-ink">
              {SITE.tagline}.
            </p>
            <p className="mt-6 text-[16px] leading-[1.75] text-ink-muted">
              A backtest is a simulation of how a strategy would have performed in
              the past, and its result depends on whether the strategy was
              designed on the same data it is scored on. Performance measured on
              the design data, in sample, is easy to inflate. Bailey, Borwein,
              López de Prado and Zhu (2014) show that trying a modest number of
              variations of a strategy is enough to produce an impressive backtest
              by chance, and Harvey, Liu and Zhu (2016) argue that, for related
              reasons, most claimed findings in empirical finance are likely to be
              false. Only performance on data the strategy has not seen says
              anything useful about the future.
            </p>
            <p className="mt-4 text-[16px] leading-[1.75] text-ink-muted">
              Each project on this site takes a common idea in quantitative
              finance and tests it that way. The model is estimated on one period
              and judged on a later one, the benchmark is chosen before the first
              estimate, and the data and code are published so that every number
              can be reproduced. The name reflects the common result: where a
              method depended on estimating future returns, its apparent
              advantage did not survive out of sample.
            </p>
          </header>
        </Reveal>

        <div className="mt-14 space-y-6">
          {PROJECTS.map((p, i) => (
            <Reveal key={p.href} delay={i * 90}>
              <article className="group overflow-hidden rounded-2xl border border-line bg-paper transition-all duration-200 hover:border-accent-line hover:shadow-[0_1px_24px_-8px_rgba(37,99,235,0.28)]">
                <Link href={p.href} className="block px-6 py-7 sm:px-8 sm:py-8">
                  <div className="flex items-start justify-between gap-5">
                    <div className="min-w-0">
                      <span className="tnum text-[12px] font-semibold text-accent">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h2 className="mt-2 text-[23px] font-semibold tracking-tight text-ink transition-colors duration-200 group-hover:text-accent-strong sm:text-[27px]">
                        {p.name}
                      </h2>
                    </div>
                    <span
                      aria-hidden
                      className="mt-7 shrink-0 text-ink-dim transition-all duration-200 group-hover:translate-x-1 group-hover:text-accent"
                    >
                      <IconArrowRight className="h-5 w-5" />
                    </span>
                  </div>

                  <p className="mt-4 max-w-2xl text-[15.5px] leading-[1.7] text-ink-muted">
                    {summary[p.href]}
                  </p>

                  <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-6 sm:grid-cols-4">
                    {scale[p.href].map((s) => (
                      <div key={s.k}>
                        <dt className="text-[11.5px] leading-snug text-ink-dim">
                          {s.k}
                        </dt>
                        <dd className="tnum mt-1 text-[19px] font-semibold text-ink">
                          {s.v}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-6 border-t border-line pt-5">
                    <p className="eyebrow">Method</p>
                    <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-ink-muted">
                      {method[p.href]}
                    </p>
                  </div>
                </Link>

                <div className="flex items-center gap-5 border-t border-line bg-surface px-4 py-1.5 text-[12.5px] sm:px-6">
                  <Link
                    href={p.href}
                    className="inline-flex min-h-11 cursor-pointer items-center rounded-lg px-2 font-medium text-accent transition-colors duration-200 hover:bg-accent-soft hover:text-accent-strong"
                  >
                    Read the study
                  </Link>
                  <a
                    href={p.repo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-ink-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
                  >
                    <IconGitHub className="h-3.5 w-3.5" />
                    Repository
                  </a>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={80}>
          <section className="mt-14 rounded-2xl border border-line bg-surface px-6 py-7 sm:px-8">
            <h2 className="text-[17px] font-semibold tracking-tight text-ink">
              What the three results have in common
            </h2>
            <div className="mt-4 space-y-4 text-[15px] leading-[1.75] text-ink-muted">
              <p>
                The projects use past prices in three ways: to forecast returns,
                to limit losses, and to trade the convergence of related prices.
                Their results divide along one line, between methods that need an
                estimate of future returns and methods that need only an estimate
                of risk.
              </p>
              <p>
                Every method in the first group fell short of a simple alternative
                out of sample. The regression forecasts were no more accurate than
                chance. Of the five portfolios, the maximum-Sharpe rule, the only
                one built on forecast returns, was also the only one whose Sharpe
                ratio fell once it was tested outside its estimation period. The
                pairs strategy, which bets that a selected spread will revert,
                earned nothing before costs that could be told apart from noise.
              </p>
              <p>
                The one method that estimated only risk did what it was designed
                to do. The minimum-CVaR portfolio limited its worst drawdown out of
                sample and through 2008, at the cost of a lower return. DeMiguel,
                Garlappi and Uppal (2009) reach a similar conclusion across many
                datasets: expected returns are estimated so imprecisely that the
                error usually outweighs the benefit of optimising on them.
              </p>
            </div>
          </section>
        </Reveal>
      </main>

      <footer className="border-t border-line px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 text-[12.5px] text-ink-dim sm:flex-row sm:items-center sm:justify-between">
          <p>
            Each study has a full report covering its data, method, limitations
            and references. Student research, not investment advice.
          </p>
          <a
            href={SITE.github}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 transition-colors duration-200 hover:text-ink"
          >
            <IconGitHub className="h-3.5 w-3.5" />
            github.com/arjunprashanth6129
          </a>
        </div>
      </footer>
    </>
  );
}
