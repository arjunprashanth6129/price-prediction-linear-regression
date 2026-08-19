import Link from "next/link";
import TopBar from "./components/TopBar";
import { Reveal, CountUp } from "./components/Motion";
import { IconArrowRight, IconGitHub } from "./components/Icons";
import { SITE, PROJECTS } from "@/lib/project";
import { getMlSummary } from "@/lib/ml";
import { getBacktest, getCvarHeadline, getPortfolios } from "@/lib/cvar";

export const metadata = {
  title: SITE.name,
  description: SITE.description,
};

export default function Home() {
  const ml = getMlSummary();
  const bt = getBacktest();
  const port = getPortfolios();
  const cv = getCvarHeadline();

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
      { k: "Simulated scenarios", v: "20,000" },
    ],
  };

  return (
    <>
      <TopBar eyebrow="Quantitative finance" title={SITE.name} />

      <main className="mx-auto w-full max-w-4xl px-5 py-14 sm:px-8 sm:py-20">
        <Reveal>
          <header className="max-w-2xl">
            <p className="eyebrow">{SITE.author} Prashanth</p>
            <h1 className="mt-3 text-[38px] font-semibold leading-[1.08] tracking-tight text-ink sm:text-[52px]">
              Quant Research Desk
            </h1>
            <p className="mt-6 text-[17.5px] leading-[1.7] text-ink-muted">
              Two studies in quantitative finance. The first asks whether the
              momentum signals retail traders watch can forecast tomorrow&apos;s
              return across the Indian market. The second builds a portfolio
              around the worst days rather than the average one, and tests it on
              data it has never seen.
            </p>
            <p className="mt-4 text-[15.5px] leading-[1.7] text-ink-dim">
              Each has its own repository, its own fixed dataset, and a pipeline
              that reproduces every figure shown here. The benchmark and the
              metric were chosen before the score in both cases, which is the
              only reason the results are worth reading.
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
                    {p.blurb}
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
                      {p.method}
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
              How the two fit together
            </h2>
            <div className="mt-4 space-y-4 text-[15px] leading-[1.75] text-ink-muted">
              <p>
                They approach the same problem from opposite ends. The first
                tries to forecast a return and fails, which is the expected
                outcome and the reason the second one does not try. The CVaR
                optimiser makes no directional forecast at all: it takes the
                distribution of what has already happened and asks only how to
                arrange twelve assets so the worst days hurt less.
              </p>
              <p>
                That turns out to be a more answerable question, though not a
                free one. Min CVaR delivered the shallowest drawdown of any
                strategy on data it had never seen,{" "}
                <span className="tnum font-semibold text-ink">
                  <CountUp
                    value={cv.shallowestDrawdown.value}
                    decimals={2}
                    suffix="%"
                  />
                </span>{" "}
                against{" "}
                <span className="tnum font-semibold text-ink">
                  <CountUp
                    value={bt.metrics_net.equal_weight["max_drawdown_%"]}
                    decimals={2}
                    suffix="%"
                  />
                </span>{" "}
                for an equally weighted book, and it made money through the 2008
                crash. It also finished second-to-last on return, because
                minimising tail risk means holding safe, low-returning assets.
              </p>
              <p>
                Both studies end in the same place. The honest answer is smaller
                than the one you hoped for, and worth more.
              </p>
            </div>
          </section>
        </Reveal>
      </main>

      <footer className="border-t border-line px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 text-[12.5px] text-ink-dim sm:flex-row sm:items-center sm:justify-between">
          <p>
            Fixed datasets, reproducible pipelines. Student projects, not
            investment advice.
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
