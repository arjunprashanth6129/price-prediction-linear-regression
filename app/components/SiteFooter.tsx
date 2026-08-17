import { PROJECT } from "@/lib/project";
import { IconGitHub } from "./Icons";

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-fg-dim">
          98 NSE stocks · daily closes June 2019 to June 2026 · fixed dataset,
          reproducible pipeline.
        </p>
        <div className="flex items-center gap-5">
          <a
            href={`${PROJECT.github}/blob/main/results/RESULTS.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-fg-muted transition-colors duration-200 hover:text-fg"
          >
            Full results
          </a>
          <a
            href={PROJECT.github}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-fg-muted transition-colors duration-200 hover:text-fg"
          >
            <IconGitHub className="h-3.5 w-3.5" />
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
