import TopBar from "../components/TopBar";
import { Reveal, CountUp } from "../components/Motion";
import { Section, V, StatCard, PaperCTA, SummaryNote, Bullets } from "../components/Page";
import { SharpeShift } from "../components/CvarCharts";
import {
  BreachChart,
  ClusteringDumbbell,
  CrashBars,
  GrowthDrawdown,
  RollingES,
} from "../components/TailRiskCharts";
import { POS, NEG } from "../components/Charts";
import { PROJECTS } from "@/lib/project";
import { STRATEGIES, STRATEGY_LABEL, getBacktest, getPortfolios, type Strategy } from "@/lib/cvar";
import { getTailRisk, pct, pv } from "@/lib/tailrisk";

const META = PROJECTS[1];

export const metadata = { title: META.name, description: META.blurb };

const SECTIONS = [
  { id: "first", label: "The first attempt" },
  { id: "redesign", label: "The redesign" },
  { id: "forecasts", label: "Forecasting the tail" },
  { id: "budget", label: "Holding the budget" },
  { id: "crashes", label: "In a crash" },
  { id: "evidence", label: "How strong is it?" },
  { id: "century", label: "A century of new data" },
  { id: "verdict", label: "Verdict" },
];

const STEPS = [
  { n: "1", title: "Forecast", text: "Tomorrow's worst-day loss, from five models: plain history to volatility-scaled history and GARCH-EVT." },
  { n: "2", title: "Test", text: "Did losses beat the forecast on 2.5% of days, scattered, and by the size it said? Formal tests, not eyeballing." },
  { n: "3", title: "Budget", text: "Each week, hold the best mix of eight rupee asset classes whose forecast tail loss is at most 1.5%." },
  { n: "4", title: "Trade", text: "Fill a day later, pay Indian and remittance costs, park the rest in a liquid fund." },
];

const INK = "#0f172a";
const SLATE = "#94a3b8";

export default function CvarStudy() {
  const tr = getTailRisk();
  const port = getPortfolios();
  const bt = getBacktest();
  const strategies = STRATEGIES as readonly Strategy[];
  const shiftData = strategies
    .map((k) => ({ key: k, label: STRATEGY_LABEL[k], ins: port.portfolios[k].stats.sharpe, oos: bt.metrics_net[k].sharpe }))
    .sort((a, b) => a.oos - b.oos);

  const H = tr.headline;
  const hold = H.holdout;
  const full = H.full;
  const fh = tr.forecasts.holdout;
  const gfc = tr.crises.find((c) => c.key === "2008")!;
  const covid = tr.crises.find((c) => c.key === "2020")!;
  const us = tr.replication.us;
  const rep = tr.replication.series;
  const after = (k: "hsAfter" | "garchAfter") => rep.map((r) => r[k]);
  const last = (xs: number[]) => xs[xs.length - 1];

  const crisisLabel: Record<string, string> = {
    "2008": "2008-09",
    "2011": "2011",
    "2013": "2013 taper",
    "2020": "2020 COVID",
    "2022": "2022 rates",
    "2024-25": "2024-25",
  };

  return (
    <>
      <TopBar eyebrow="Study 02" title={META.name} sections={SECTIONS} repo={META.repo} paper={META.paper} />

      <main id="top" className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8">
        {/* ---------------- hero ---------------- */}
        <Reveal>
          <header>
            <p className="eyebrow">Research summary</p>
            <h1 className="mt-2 text-[34px] font-semibold leading-[1.1] tracking-tight text-ink sm:text-[46px]">
              Can a portfolio be held to a tail-loss budget?
            </h1>
            <p className="mt-5 text-[18px] leading-[1.6] text-ink-muted">
              Yes. Forecast tomorrow&apos;s worst-day loss well and a portfolio can live within a limit on it, in
              India since 2008 and in the US since 1964. It just doesn&apos;t earn more than a 60/40 for it.
            </p>
            <SummaryNote paper={META.paper} />
          </header>
        </Reveal>

        <Reveal delay={60}>
          <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              value={<CountUp value={hold.BUDGET_OPT.realisedES * 100} decimals={2} suffix="%" />}
              label="Tail loss against a 1.5% budget"
              detail={`Holdout, run once. Not significantly over (${pv(tr.h2.holdout.pEsAbove, 2)}).`}
              tone="accent"
            />
            <StatCard
              value={`${pct(gfc.BUDGET_OPT, 0)} vs ${pct(gfc.STATIC_60_40, 0)}`}
              label="2008 crash, budget vs 60/40"
              detail="September 2008 to March 2009, out of sample."
            />
            <StatCard
              value="Half"
              label="The clustering of misses"
              detail="Filtered forecasts against historical simulation, nine markets back to 1928."
            />
            <StatCard
              value={`${us.metrics.all.BUDGET_OPT.sharpe.toFixed(2)} vs ${us.metrics.all.STATIC_60_40.sharpe.toFixed(2)}`}
              label="Sharpe vs 60/40, 1964-2026"
              detail="No edge on return per unit of risk."
            />
          </div>
        </Reveal>

        {/* ---------------- 01 first attempt ---------------- */}
        <Section
          id="first"
          index={1}
          title="The first attempt: five optimisers"
          summary="Five ways to build a portfolio from twelve assets. Equal weight won, and nothing was significant."
        >
          <SharpeShift data={shiftData} />
          <p>
            Its best result, minimum CVaR gaining in 2008, used weights fitted on 2015 to 2026. Its &ldquo;safe&rdquo;
            asset was a US bond fund, really a bet on the rupee. And it never checked whether a CVaR estimate was{" "}
            <V>right</V>.
          </p>
        </Section>

        {/* ---------------- 02 redesign ---------------- */}
        <Section
          id="redesign"
          index={2}
          title="The redesign: test the forecast, then use it"
          summary="CVaR is a forecast of tomorrow's tail loss. So test it as one, then run a portfolio to a fixed limit on it."
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
          <p>
            Nifty 50, Midcap and Smallcap, a gilt fund, gold, the S&amp;P 500, developed markets and US Treasuries,
            all in rupees, 2006 to 2026. Every rule was committed to git before a single portfolio return existed;
            the 2017-2026 holdout was run once.
          </p>
        </Section>

        {/* ---------------- 03 forecasts ---------------- */}
        <Section
          id="forecasts"
          index={3}
          title="Forecasting the tail"
          summary="Plain historical simulation reacts late, so its misses come in runs. Scaling history by today's volatility fixes most of that."
        >
          <BreachChart windows={tr.breach} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              value={`${fh.FHS_GARCH.ccPass} vs ${fh.HS.ccPass}`}
              label="Portfolios passing, of 10"
              detail="Filtered GARCH against historical simulation, holdout coverage test."
              tone="accent"
            />
            <StatCard
              value={pv(fh.FHS_GARCH.fz0HolmP)}
              label="Better score than history"
              detail="FZ0 loss, corrected for testing four models."
            />
            <StatCard
              value="All fail"
              label="The strict joint test"
              detail={`Filtered GARCH too (${pv(fh.FHS_GARCH.dqP)}). Better, not perfect.`}
            />
          </div>
        </Section>

        {/* ---------------- 04 budget ---------------- */}
        <Section
          id="budget"
          index={4}
          title="Holding the budget"
          summary={
            <>
              The budget portfolio&apos;s tail loss was <V>{pct(H.development.BUDGET_OPT.realisedES, 2)}</V> in
              development and <V>{pct(hold.BUDGET_OPT.realisedES, 2)}</V> in the holdout, against a 1.5% budget.
            </>
          }
        >
          <GrowthDrawdown
            title="Growth of ₹1 from July 2008, net of costs (log scale)"
            dates={tr.growth.dates}
            logTicks={[1, 2, 4, 8]}
            shade={{ from: "2017-01-06", to: tr.growth.dates[tr.growth.dates.length - 1], label: "Holdout" }}
            series={[
              { key: "p1", label: "Budget portfolio", color: POS, width: 2.6, values: tr.growth.BUDGET_OPT },
              { key: "p2", label: "Same, historical scenarios", color: NEG, width: 1.5, values: tr.growth.BUDGET_HS },
              { key: "s", label: "60/40", color: INK, width: 1.5, values: tr.growth.STATIC_60_40 },
              { key: "e", label: "Equal weight", color: SLATE, width: 1.5, dash: "6 4", values: tr.growth.STATIC_EW },
            ]}
            caption={
              <>
                <strong className="font-semibold text-ink">₹1 became ₹{last(tr.growth.BUDGET_OPT).toFixed(2)}</strong>,
                against ₹{last(tr.growth.STATIC_60_40).toFixed(2)} for 60/40 and ₹
                {last(tr.growth.STATIC_EW).toFixed(2)} for equal weight, which ran above the budget. Switch to
                drawdown to see where the budget earned its keep.
              </>
            }
          />
          <RollingES
            dates={tr.rollingES.dates}
            budget={tr.budget}
            series={[
              { key: "s", label: "60/40", color: INK, width: 1.3, values: tr.rollingES.STATIC_60_40 },
              { key: "p2", label: "Historical scenarios", color: NEG, width: 1.3, values: tr.rollingES.BUDGET_HS },
              { key: "p1", label: "Budget portfolio", color: POS, width: 2.4, values: tr.rollingES.BUDGET_OPT },
            ]}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              value={pct(tr.ownForecast.holdout.BUDGET_OPT.hitRate, 2)}
              label="Days its own forecast was beaten"
              detail="Target 2.5%. Scattered, not bunched."
              tone="accent"
            />
            <StatCard
              value={`${full.BUDGET_OPT.sharpe.toFixed(2)} vs ${full.STATIC_60_40.sharpe.toFixed(2)}`}
              label="Sharpe vs 60/40, 2008-2026"
              detail={`Higher, but not significantly (${pv(tr.h2.full.lwP, 2)}).`}
            />
            <StatCard
              value={full.STATIC_EW.sharpe.toFixed(2)}
              label="Equal weight's Sharpe"
              detail={`Better, while running over budget (${pct(full.STATIC_EW.realisedES, 2)}).`}
            />
          </div>
        </Section>

        {/* ---------------- 05 crashes ---------------- */}
        <Section
          id="crashes"
          index={5}
          title="In a crash"
          summary="It lost less than 60/40 in five of six crises. The exception was 2022, when bonds and stocks fell together."
        >
          <CrashBars
            title="Return over each crisis window, net of costs"
            a="Budget portfolio"
            b="60/40"
            rows={tr.crises.map((c) => ({ key: c.key, label: crisisLabel[c.key] ?? c.key, a: c.BUDGET_OPT, b: c.STATIC_60_40 }))}
            caption="Windows fixed before the run. 2008, 2011 and 2013 fall in the development period, the rest in the holdout."
          />
          <p>
            It meets the budget by switching into gilt, gold and Treasuries, not by sitting in cash. In 2020 the
            crash came from calm markets in four weeks, faster than weekly decisions, and it still lost{" "}
            {pct(covid.BUDGET_OPT, 0)}.
          </p>
        </Section>

        {/* ---------------- 06 evidence ---------------- */}
        <Section
          id="evidence"
          index={6}
          title="How strong is the evidence?"
          summary="An audit, written down before it ran, tightened every test. It removed one claim and explained another."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              value={tr.power.full.mde.toFixed(2)}
              label="Sharpe gap 18 years could detect"
              detail={`The gap seen was ${tr.power.full.observed.toFixed(2)}.`}
              tone="accent"
            />
            <StatCard
              value={`~${Math.round(tr.power.full.yearsNeeded / 10) * 10} years`}
              label="Data needed to detect it"
              detail="No realistic sample settles the race with 60/40."
            />
            <StatCard
              value="Withdrawn"
              label="“Calibrated in 9 of 10”"
              detail="The ten portfolios share assets. Pooled properly, every model fails."
            />
          </div>
        </Section>

        {/* ---------------- 07 century ---------------- */}
        <Section
          id="century"
          index={7}
          title="A century of data it had never seen"
          summary="Same method, no new choices, on markets and decades the model never touched. The forecasting result held. The portfolio's edge didn't."
        >
          <ClusteringDumbbell
            rows={rep.map((r) => ({ key: r.key, label: r.label, sessions: r.sessions, hs: r.hsAfter, garch: r.garchAfter }))}
          />
          <GrowthDrawdown
            title="A dollar investor from 1964: growth of $1, net of costs (log scale)"
            dates={us.growth.dates}
            logTicks={[1, 10, 100]}
            yearStep={8}
            shade={{ from: "1973-01", to: "1974-12", label: "1973-74" }}
            series={[
              { key: "p1", label: "Budget portfolio", color: POS, width: 2.2, values: us.growth.BUDGET_OPT },
              { key: "p2", label: "Historical scenarios", color: NEG, width: 1.3, values: us.growth.BUDGET_HS },
              { key: "s", label: "US 60/40", color: INK, width: 1.3, values: us.growth.STATIC_60_40 },
            ]}
            caption={
              <>
                US stocks, small caps and a 10-year Treasury, with T-bills as cash. The budget held (tail loss{" "}
                {pct(us.h2.all.realisedES, 2)}), but 60/40 matched it on Sharpe and fell less in 1973-74, a slow
                slide the budget never felt.
              </>
            }
          />
          <CrashBars
            title="Return in US crashes, budget portfolio against 60/40"
            a="Budget portfolio"
            b="US 60/40"
            rows={us.crashes.map((c) => ({ key: c.key, label: c.key, a: c.P1, b: c.S6040 }))}
            caption="Descriptive windows, not pre-registered. It helps when volatility jumps; it doesn't when prices grind down."
          />
          <p>
            {`Across nine markets, the share of breaches that follow a breach falls from ${pct(
              Math.min(...after("hsAfter")),
              0,
            )}–${pct(Math.max(...after("hsAfter")), 0)} to ${pct(Math.min(...after("garchAfter")), 0)}–${pct(
              Math.max(...after("garchAfter")),
              0,
            )}. Over 64 years the budget portfolio's Sharpe ratio was `}
            <V>{us.metrics.all.BUDGET_OPT.sharpe.toFixed(2)}</V>
            {` against ${us.metrics.all.STATIC_60_40.sharpe.toFixed(2)}, in a sample that could have spotted a gap of ${us.h2.all.mde.toFixed(2)}.`}
          </p>
        </Section>

        {/* ---------------- 08 verdict ---------------- */}
        <Section
          id="verdict"
          index={8}
          title="Verdict"
          summary="Tail risk can be forecast well enough to be managed. Managing it doesn't buy extra return."
        >
          <Bullets
            items={[
              <>
                <V>Holds:</V> volatility-scaled forecasts beat plain history everywhere, and a budget built on them
                keeps realised tail loss near the limit, in rupees and in dollars.
              </>,
              <>
                <V>Doesn&apos;t:</V> no significant edge over 60/40, equal weight did better in India, and a slow
                bear market slips past the budget.
              </>,
              <>
                <V>Not modelled:</V> capital gains tax, and the limits on moving money abroad that make weekly
                rebalancing of foreign assets impractical.
              </>,
            ]}
          />
          <PaperCTA paper={META.paper} repo={META.repo}>
            The paper has the five models and their tests, the budget optimiser, every robustness run, the audit and
            the replication, with the limitations.
          </PaperCTA>
        </Section>

        <nav className="-mx-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-4 text-[13px]">
          <a
            href="#top"
            className="inline-flex min-h-11 cursor-pointer items-center rounded-lg px-2 text-ink-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
          >
            Back to the top
          </a>
        </nav>
      </main>
    </>
  );
}
