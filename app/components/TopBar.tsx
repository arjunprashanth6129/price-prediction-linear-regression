import Sidebar, { type Section } from "./Sidebar";
import { IconGitHub, IconExternal, IconPaper } from "./Icons";
import { SITE } from "@/lib/project";

/**
 * The strip above the content: page context on the left, repository link on the
 * right. It stays out of the navigation's way, because the navigation is the
 * sidebar.
 */
export default function TopBar({
  eyebrow,
  title,
  sections,
  repo,
  repoLabel = "Repository",
  paper,
}: {
  eyebrow?: string;
  title?: string;
  sections?: Section[];
  repo?: string;
  repoLabel?: string;
  /** Path to the study's paper, shown as a button before the repository link. */
  paper?: string;
}) {
  /*
    The strip is solid rather than translucent over a backdrop blur.
    `backdrop-filter` makes an element the containing block for its
    `position: fixed` descendants, which anchored the sidebar rail to this strip
    instead of to the viewport and left it overlapping the content column.
  */
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper">
      <div className="flex items-center gap-3 px-5 py-3 sm:px-8">
        <Sidebar sections={sections} />

        <div className="min-w-0">
          {eyebrow && (
            <p className="truncate text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-dim">
              {eyebrow}
            </p>
          )}
          {title && (
            <p className="truncate text-[14px] font-semibold tracking-tight text-ink">
              {title}
            </p>
          )}
        </div>

        {paper && (
          <a
            href={paper}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-accent-line bg-accent-soft px-3 py-2 text-[12.5px] font-medium text-accent-strong transition-colors duration-200 hover:border-accent"
          >
            <IconPaper className="h-4 w-4" />
            <span>
              Paper<span className="hidden sm:inline"> (PDF)</span>
            </span>
          </a>
        )}
        <a
          href={repo ?? SITE.github}
          target="_blank"
          rel="noopener noreferrer"
          className={`${paper ? "" : "ml-auto "}flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2 text-[12.5px] font-medium text-ink-muted transition-colors duration-200 hover:border-line-strong hover:bg-surface hover:text-ink`}
        >
          <IconGitHub className="h-4 w-4" />
          <span className="hidden sm:inline">{repoLabel}</span>
          <IconExternal className="hidden h-3 w-3 opacity-60 sm:inline" />
        </a>
      </div>
    </header>
  );
}
