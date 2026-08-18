import Link from "next/link";
import SiteHeader from "./components/SiteHeader";
import SiteFooter from "./components/SiteFooter";
import { SITE, PROJECTS } from "@/lib/project";
import { getMlSummary } from "@/lib/ml";
import { getBacktest, getCvarHeadline, STRATEGY_LABEL } from "@/lib/cvar";
import { IconArrowRight, IconGitHub } from "./components/Icons";

export const metadata = {
  title: `${SITE.name} - ${SITE.tagline}`,
  description: SITE.description,
};

/** One headline figure, read from each study's own output. */
function Stat({
  value,
  label,
  tone = "fg",
}: {
  value: string;
  label: string;
  tone?: "fg" | "neg" | "accent";
}) {
  const toneClass = { fg: "text-fg", neg: "text-neg", accent: "text-accent" }[tone];
  return (
    <div>
      <div className={`tnum text-[20px] font-semibold tracking-tight ${toneClass}`}>
        {value}
      </div>
      <div className="mt-1 text-[11.5px] leading-snug text-fg-dim">{label}</div>
    </div>
  );
}

export default function Home() {
  const ml = getMlSummary();
  const bt = getBacktest();
  const cv = getCvarHeadline();

  const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;

  // Each card's stats come from that project's data, so the landing page cannot
  // quote a number the study itself has stopped reporting.
  const stats: Record<string, { value: string; label: string; tone?: "fg" | "neg" | "accent" }[]> = {
    "/linear-regression": [
      {
        value: ml.avgR2.toFixed(2),
        label: "average R² on next-day returns",
        tone: "neg",
      },
      {
        value: pct(ml.avgDirAccuracy),
        label: "directional accuracy, under a coin flip",
        tone: "neg",
      },
      { value: `${ml.total}`, label: "NSE stocks modelled" },
      {
        value: `${ml.maRatioTopFeature} of ${ml.total}`,
        label: "stocks where the golden cross led",
        tone: "neg",
      },
    ],
    "/cvar": [
      {
        value: cv.bestSharpe.value.toFixed(3),
        label: `best out-of-sample Sharpe (${STRATEGY_LABEL[cv.bestSharpe.key].toLowerCase()})`,
        tone: "accent",
      },
      {
        value: `${cv.shallowestDrawdown.value.toFixed(2)}%`,
        label: "shallowest drawdown, min CVaR",
      },
      {
        value: `${cv.gfc >= 0 ? "+" : ""}${cv.gfc.toFixed(2)}%`,
        label: "min CVaR through Lehman",
        tone: "accent",
      },
      {
        value: cv.worstShift.value.toFixed(3),
        label: `Sharpe decay, ${STRATEGY_LABEL[cv.worstShift.key].toLowerCase()}`,
        tone: "neg",
      },
    ],
  };

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-14">
        <header className="max-w-3xl">
          <p className="eyebrow">Quantitative finance</p>
          <h1 className="mt-2 text-[34px] font-semibold tracking-tight text-fg sm:text-[44px]">
            Two studies, and neither one found what it went looking for
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed text-fg-muted">
            One asks whether the momentum signals retail traders watch predict
            tomorrow&apos;s return. The other builds a portfolio around the worst
            days rather than the average one. In both cases the interesting result
            is the one I did not want: the signals carried nothing, and the
            optimiser lost to splitting evenly.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-fg-dim">
            Both are reported the way they came out, with the benchmark chosen
            before the score. Each has its own repository, its own dataset and a
            pipeline that reproduces every figure quoted here.
          </p>
        </header>

        <div className="mt-12 space-y-5">
          {PROJECTS.map((p, i) => (
            <article
              key={p.href}
              className="group rounded-xl border border-line bg-ink-850/50 transition-colors duration-200 hover:border-line-strong"
            >
              <Link href={p.href} className="block px-6 py-6 sm:px-7 sm:py-7">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <span className="tnum text-[12px] font-medium text-accent">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h2 className="mt-1.5 text-[21px] font-semibold tracking-tight text-fg sm:text-[24px]">
                      {p.name}
                    </h2>
                  </div>
                  <span
                    aria-hidden
                    className="mt-6 shrink-0 text-fg-dim transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-accent"
                  >
                    <IconArrowRight className="h-5 w-5" />
                  </span>
                </div>

                <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
                  {p.blurb}
                </p>

                <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-5 border-t border-line/70 pt-5 sm:grid-cols-4">
                  {stats[p.href].map((s) => (
                    <div key={s.label}>
                      <Stat value={s.value} label={s.label} tone={s.tone} />
                    </div>
                  ))}
                </dl>

                <div className="mt-6 grid gap-4 border-t border-line/70 pt-5 sm:grid-cols-2">
                  <div>
                    <p className="eyebrow">Method</p>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-muted">
                      {p.method}
                    </p>
                  </div>
                  <div>
                    <p className="eyebrow">What came back</p>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-muted">
                      {p.finding}
                    </p>
                  </div>
                </div>
              </Link>

              <div className="flex items-center gap-5 border-t border-line/70 px-6 py-3.5 text-[12.5px] sm:px-7">
                <Link
                  href={p.href}
                  className="font-medium text-accent transition-colors duration-200 hover:text-[#7db0ff]"
                >
                  Read the study
                </Link>
                <a
                  href={p.repo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-fg-muted transition-colors duration-200 hover:text-fg"
                >
                  <IconGitHub className="h-3.5 w-3.5" />
                  Repository
                </a>
              </div>
            </article>
          ))}
        </div>

        <section className="mt-14 rounded-xl border border-line bg-ink-850/40 px-6 py-6 sm:px-7">
          <h2 className="text-[15px] font-semibold text-fg">
            Why these two sit together
          </h2>
          <div className="mt-3 space-y-3.5 text-[14.5px] leading-relaxed text-fg-muted">
            <p>
              They approach the same problem from opposite ends. The first tries
              to forecast a return and fails, which is the expected outcome and
              the reason the second one does not try. The CVaR optimiser makes no
              directional forecast at all: it takes the distribution of what has
              already happened and asks only how to arrange twelve assets so the
              worst days hurt less.
            </p>
            <p>
              That turns out to be a more answerable question, though not a free
              one. Min CVaR delivered the shallowest drawdown of any strategy on
              data it had never seen,{" "}
              {cv.shallowestDrawdown.value.toFixed(2)}% against{" "}
              {bt.metrics_net.equal_weight["max_drawdown_%"].toFixed(2)}% for
              equal weight, and it made money through the 2008 crash. It also
              finished second-to-last on return, because minimising tail risk
              means holding safe, low-returning assets. Both studies end up in the
              same place: the honest answer is smaller than the one you hoped for,
              and worth more.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
