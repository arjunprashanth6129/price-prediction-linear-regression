import Link from "next/link";
import { SITE, PROJECTS } from "@/lib/project";
import { IconGitHub, IconLogo } from "./Icons";
import TopNav, { type NavItem } from "./TopNav";
import SectionNav, { type Section } from "./SectionNav";

const NAV: NavItem[] = [
  { href: "/", name: "Home" },
  ...PROJECTS.map((p) => ({ href: p.href, name: p.navName })),
];

/**
 * The one header every page wears.
 *
 * `context` renders an optional status pill next to the wordmark, and
 * `sections` adds in-page anchors for the long study pages. The landing page
 * passes neither, so it gets the bare route nav.
 */
export default function SiteHeader({
  context,
  sections,
  repo,
}: {
  context?: string;
  sections?: Section[];
  repo?: string;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink-900/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5 font-semibold tracking-tight text-fg"
        >
          <span className="grid h-8 w-8 place-items-center rounded-md border border-line-strong bg-ink-800 p-1.5 text-accent transition-colors duration-200 group-hover:border-accent">
            <IconLogo />
          </span>
          <span className="text-[15px]">{SITE.name}</span>
        </Link>

        {context && (
          <span className="hidden rounded-full border border-line-strong bg-ink-850 px-2.5 py-1 text-[11px] font-medium text-fg-muted xl:inline-block">
            {context}
          </span>
        )}

        <div className="thin-scroll ml-auto flex min-w-0 items-center gap-2 overflow-x-auto">
          <TopNav items={NAV} />
          <a
            href={repo ?? SITE.github}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={
              repo ? "View this project's source on GitHub" : "View the source on GitHub"
            }
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line text-fg-muted transition-colors duration-200 hover:border-line-strong hover:text-fg"
          >
            <IconGitHub />
          </a>
        </div>
      </div>

      {/* Second row of in-page anchors, only on the long study pages. */}
      {sections && sections.length > 0 && (
        <div className="border-t border-line/70 bg-ink-900/60">
          <div className="thin-scroll mx-auto flex max-w-6xl items-center overflow-x-auto px-5 py-1.5">
            <SectionNav sections={sections} />
          </div>
        </div>
      )}
    </header>
  );
}
