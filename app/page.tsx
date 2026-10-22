import Link from "next/link";
import TopBar from "./components/TopBar";
import { Reveal } from "./components/Motion";
import { IconArrowRight, IconGitHub, IconPaper } from "./components/Icons";
import { SITE, PROJECTS } from "@/lib/project";
import { getMlSummary } from "@/lib/ml";
import { getStrategy, pct as frac } from "@/lib/strategy";
import { getTailRisk, pct as tpct } from "@/lib/tailrisk";

export const metadata = {
  title: SITE.name,
  description: SITE.description,
};

interface Card {
  question: string;
  big: string;
  bigLabel: string;
  stats: { v: string; k: string }[];
}

export default function Home() {
  const ml = getMlSummary();
  const st = getStrategy();
  const h = st.headline.pit.full;
  const surv = st.headline.survivor.full;
  const tr = getTailRisk();
  const gfc = tr.crises.find((c) => c.key === "2008")!;

  const pct = (v: number, d = 1) => `${v.toFixed(d)}%`;
  const bias = ((surv.cagr - h.cagr) + (surv.ewCagr - h.ewCagr)) / 2;

  const cards: Record<string, Card> = {
    "/linear-regression": {
      question: "Can price signals beat the Indian market?",
      big: frac(h.cagr),
      bigLabel: `a year from 2009 to 2026, after costs, against ${frac(h.nifty500Cagr)} for the Nifty 500`,
      stats: [
        { v: frac(st.headline.pit.holdout.activeReturn, 1, true), k: "a year over the benchmark in the holdout" },
        { v: `~${(bias * 100).toFixed(0)} pts`, k: "survivorship bias found and removed" },
        { v: pct(ml.avgDirAccuracy * 100), k: "accuracy of the first, daily forecast" },
      ],
    },
    "/cvar": {
      question: "Can a portfolio be held to a tail-loss budget?",
      big: tpct(tr.headline.holdout.BUDGET_OPT.realisedES, 2),
      bigLabel: "realised tail loss in the holdout, against a budget of 1.5%, using a forecast tested out of sample",
      stats: [
        { v: `${tpct(gfc.BUDGET_OPT, 0)} vs ${tpct(gfc.STATIC_60_40, 0)}`, k: "the budget portfolio against 60/40 in the 2008 crash" },
        { v: "Half", k: "the clustering of forecast misses, nine markets back to 1928" },
        { v: `${tr.replication.us.metrics.all.BUDGET_OPT.sharpe.toFixed(2)} vs ${tr.replication.us.metrics.all.STATIC_60_40.sharpe.toFixed(2)}`, k: "Sharpe ratio against 60/40 over 64 years: no edge" },
      ],
    },
  };

  const lessons = [
    {
      head: "Forecasting single prices failed.",
      body: "The daily regression of each stock's next-day return was a coin toss.",
    },
    {
      head: "Ranking stocks worked.",
      body: "Momentum survived costs, a holdout and a survivorship-free rebuild.",
    },
    {
      head: "Controlling risk worked.",
      body: "A tested tail-loss forecast held a portfolio to its budget in two markets, without beating 60/40.",
    },
  ];

  return (
    <>
      <TopBar eyebrow="Quantitative finance" title={SITE.name} />

      <main className="mx-auto w-full max-w-4xl px-5 py-14 sm:px-8 sm:py-20">
        <Reveal>
          <header className="max-w-2xl">
            <p className="eyebrow">{SITE.author} Prashanth · Quantitative finance research</p>
            <h1 className="mt-3 text-[40px] font-semibold leading-[1.05] tracking-tight text-ink sm:text-[56px]">
              {SITE.name}
            </h1>
            <p className="mt-4 text-[19px] leading-[1.55] text-ink">
              Two ideas from quantitative finance, each tested on data it had never
              seen.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2 text-[12.5px] font-medium text-ink-muted">
              {["Out of sample only", "Costs included", "Every number reproducible"].map((t) => (
                <li key={t} className="rounded-full border border-line bg-surface px-3 py-1">
                  {t}
                </li>
              ))}
            </ul>
          </header>
        </Reveal>

        <div className="mt-12 space-y-6">
          {PROJECTS.map((p, i) => {
            const c = cards[p.href];
            return (
              <Reveal key={p.href} delay={i * 90}>
                <article className="group overflow-hidden rounded-2xl border border-line bg-paper transition-all duration-200 hover:border-accent-line hover:shadow-[0_1px_24px_-8px_rgba(37,99,235,0.28)]">
                  <Link href={p.href} className="block px-6 py-7 sm:px-8 sm:py-8">
                    <div className="flex items-start justify-between gap-5">
                      <div className="min-w-0">
                        <span className="tnum text-[12px] font-semibold text-accent">
                          {String(i + 1).padStart(2, "0")} · {p.name}
                        </span>
                        <h2 className="mt-2 text-[24px] font-semibold leading-snug tracking-tight text-ink transition-colors duration-200 group-hover:text-accent-strong sm:text-[28px]">
                          {c.question}
                        </h2>
                      </div>
                      <span
                        aria-hidden
                        className="mt-8 shrink-0 text-ink-dim transition-all duration-200 group-hover:translate-x-1 group-hover:text-accent"
                      >
                        <IconArrowRight className="h-5 w-5" />
                      </span>
                    </div>

                    <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-[40px] font-semibold leading-none tracking-tight text-accent tabular-nums sm:text-[46px]">
                        {c.big}
                      </span>
                      <span className="max-w-md text-[14px] leading-snug text-ink-muted">
                        {c.bigLabel}
                      </span>
                    </div>

                    <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-3">
                      {c.stats.map((s) => (
                        <div key={s.k}>
                          <dd className="tnum text-[19px] font-semibold text-ink">{s.v}</dd>
                          <dt className="mt-0.5 text-[12px] leading-snug text-ink-dim">{s.k}</dt>
                        </div>
                      ))}
                    </dl>
                  </Link>

                  <div className="flex items-center gap-5 border-t border-line bg-surface px-4 py-1.5 text-[12.5px] sm:px-6">
                    <Link
                      href={p.href}
                      className="inline-flex min-h-11 cursor-pointer items-center rounded-lg px-2 font-medium text-accent transition-colors duration-200 hover:bg-accent-soft hover:text-accent-strong"
                    >
                      See the results
                    </Link>
                    <a
                      href={p.paper}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-ink-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
                    >
                      <IconPaper className="h-3.5 w-3.5" />
                      Paper (PDF)
                    </a>
                    <a
                      href={p.repo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-ink-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
                    >
                      <IconGitHub className="h-3.5 w-3.5" />
                      Code
                    </a>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={80}>
          <section className="mt-14">
            <h2 className="text-[20px] font-semibold tracking-tight text-ink">
              What the two found
            </h2>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {lessons.map((l) => (
                <div key={l.head} className="rounded-xl border border-line bg-surface px-5 py-5">
                  <p className="text-[15px] font-semibold leading-snug text-ink">{l.head}</p>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">{l.body}</p>
                </div>
              ))}
            </div>
          </section>
        </Reveal>
      </main>

      <footer className="border-t border-line px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 text-[12.5px] text-ink-dim sm:flex-row sm:items-center sm:justify-between">
          <p>
            Each study has a paper with its full method, results and limitations.
            Student research, not investment advice.
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
