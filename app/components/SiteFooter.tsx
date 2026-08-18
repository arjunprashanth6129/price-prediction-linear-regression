import Link from "next/link";
import { SITE, PROJECTS } from "@/lib/project";
import { IconGitHub } from "./Icons";

export default function SiteFooter({
  note,
  repo,
}: {
  /** Optional line describing the current page's dataset. */
  note?: string;
  /** The repository that owns the current page's analysis. */
  repo?: string;
}) {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-fg-dim">
          {note ??
            "Two studies, each with its own repository, fixed dataset and reproducible pipeline."}
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {PROJECTS.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="text-fg-muted transition-colors duration-200 hover:text-fg"
            >
              {p.navName}
            </Link>
          ))}
          <a
            href={repo ?? SITE.github}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-fg-muted transition-colors duration-200 hover:text-fg"
          >
            <IconGitHub className="h-3.5 w-3.5" />
            {repo ? "Source" : "GitHub"}
          </a>
        </div>
      </div>
    </footer>
  );
}
