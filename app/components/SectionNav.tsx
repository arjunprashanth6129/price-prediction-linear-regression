"use client";

/**
 * Anchor nav for a single long document, with the current section highlighted.
 *
 * This is one page rather than a site, so there is no pathname to read: the
 * active item is whichever section is currently under the header. An
 * IntersectionObserver with a top margin equal to the header height reports
 * sections as they cross that line, and the last one to cross going down is the
 * one being read.
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface Section {
  id: string;
  label: string;
}

export default function SectionNav({ sections }: { sections: Section[] }) {
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const nodes = sections
      .map((s) => document.getElementById(s.id))
      .filter((n): n is HTMLElement => n !== null);
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Several sections can be on screen at once. The one being read is the
        // topmost of those intersecting, so entries are sorted by position
        // rather than trusting callback order.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          );
        if (visible.length) setActive(visible[0].target.id);
      },
      // Everything above the header and below two thirds of the viewport is
      // ignored, which keeps the highlight from flickering between neighbours.
      { rootMargin: "-72px 0px -66% 0px", threshold: 0 },
    );

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav
      className="thin-scroll flex min-w-0 items-center overflow-x-auto"
      aria-label="Sections"
    >
      <div className="flex items-center overflow-hidden rounded-lg border border-line bg-ink-850 p-0.5">
        {sections.map((s, i) => {
          const on = active === s.id;
          const prevOn = i > 0 && active === sections[i - 1].id;
          const nextOn = i < sections.length - 1 && active === sections[i + 1].id;

          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              aria-current={on ? "true" : undefined}
              className={cn(
                "whitespace-nowrap px-3 py-1.5 text-[13px] font-medium",
                "transition-[background-color,color,border-radius,margin] duration-300",
                on
                  ? "mx-0.5 rounded-md bg-ink-700 text-fg shadow-sm"
                  : cn(
                      "text-fg-muted hover:bg-ink-800 hover:text-fg",
                      // Square up edges that touch a neighbour; round the ones
                      // at an end or beside the active pill.
                      (prevOn || i === 0) && "rounded-l-md",
                      (nextOn || i === sections.length - 1) && "rounded-r-md",
                    ),
              )}
            >
              {s.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
