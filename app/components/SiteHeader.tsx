import { PROJECT } from "@/lib/project";
import { IconGitHub, IconLogo } from "./Icons";
import SectionNav, { type Section } from "./SectionNav";

const SECTIONS: Section[] = [
  { id: "method", label: "Method" },
  { id: "findings", label: "Findings" },
  { id: "worked", label: "Worked example" },
  { id: "limits", label: "Limitations" },
];

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink-900/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3">
        <a
          href="#top"
          className="group flex shrink-0 items-center gap-2.5 font-semibold tracking-tight text-fg"
        >
          <span className="grid h-8 w-8 place-items-center rounded-md border border-line-strong bg-ink-800 p-1.5 text-accent transition-colors duration-200 group-hover:border-accent">
            <IconLogo />
          </span>
          <span className="text-[15px]">{PROJECT.shortName}</span>
        </a>

        <span className="hidden rounded-full border border-line-strong bg-ink-850 px-2.5 py-1 text-[11px] font-medium text-fg-muted lg:inline-block">
          Linear regression · 98 NSE stocks
        </span>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          <SectionNav sections={SECTIONS} />
          <a
            href={PROJECT.github}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View the source and full results on GitHub"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line text-fg-muted transition-colors duration-200 hover:border-line-strong hover:text-fg"
          >
            <IconGitHub />
          </a>
        </div>
      </div>
    </header>
  );
}
