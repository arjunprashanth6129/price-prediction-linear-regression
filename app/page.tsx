import Link from "next/link";
import SiteHeader from "./components/SiteHeader";
import SiteFooter from "./components/SiteFooter";
import { SITE, PROJECTS } from "@/lib/project";
import { IconArrowRight, IconGitHub } from "./components/Icons";

export const metadata = {
  title: SITE.name,
  description: SITE.description,
};

export default function Home() {
  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-16 sm:py-20">
        <header className="max-w-2xl">
          <p className="eyebrow">Arjun Prashanth</p>
          <h1 className="mt-3 text-[40px] font-semibold tracking-tight text-fg sm:text-[52px]">
            Quant Projects
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed text-fg-muted">
            {SITE.tagline}. Each one has its own repository, its own dataset and a
            pipeline that reproduces every figure it shows.
          </p>
        </header>

        <div className="mt-14 border-t border-line">
          {PROJECTS.map((p, i) => (
            <article key={p.href} className="group border-b border-line">
              <Link
                href={p.href}
                className="flex items-start gap-5 py-8 transition-colors duration-200 sm:gap-7 sm:py-9"
              >
                <span className="tnum mt-1 shrink-0 text-[13px] font-medium text-fg-dim transition-colors duration-200 group-hover:text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>

                <div className="min-w-0 flex-1">
                  <h2 className="text-[22px] font-semibold tracking-tight text-fg transition-colors duration-200 group-hover:text-accent sm:text-[26px]">
                    {p.name}
                  </h2>
                  <p className="mt-2.5 max-w-xl text-[15px] leading-relaxed text-fg-muted">
                    {p.blurb}
                  </p>
                  <p className="mt-4 text-[13px] leading-relaxed text-fg-dim">
                    {p.method}
                  </p>
                </div>

                <span
                  aria-hidden
                  className="mt-2 shrink-0 text-fg-dim transition-transform duration-200 group-hover:translate-x-1 group-hover:text-accent"
                >
                  <IconArrowRight className="h-5 w-5" />
                </span>
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
          {PROJECTS.map((p) => (
            <a
              key={p.repo}
              href={p.repo}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-fg-muted transition-colors duration-200 hover:text-fg"
            >
              <IconGitHub className="h-3.5 w-3.5" />
              {p.navName}
            </a>
          ))}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
