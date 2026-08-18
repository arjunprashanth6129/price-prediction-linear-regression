"use client";

/**
 * Route nav: the items sit flush as one bar, and the active route detaches into
 * its own pill.
 *
 * The active item is derived from `usePathname()` rather than tracked in state,
 * so the highlight is correct on load, on back/forward and on deep links.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  name: string;
}

export default function TopNav({
  items,
  className,
}: {
  items: NavItem[];
  className?: string;
}) {
  const pathname = usePathname();

  // "/" must match exactly, or it would light up on every route.
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className={cn("flex items-center", className)} aria-label="Projects">
      <div className="flex items-center overflow-hidden rounded-lg border border-line bg-ink-850 p-0.5">
        {items.map((item, i) => {
          const active = isActive(item.href);
          const prevActive = i > 0 && isActive(items[i - 1].href);
          const nextActive =
            i < items.length - 1 && isActive(items[i + 1].href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "whitespace-nowrap px-3 py-1.5 text-[13px] font-medium",
                "transition-[background-color,color,border-radius,margin] duration-300",
                active
                  ? "mx-0.5 rounded-md bg-ink-700 text-fg shadow-sm"
                  : cn(
                      "text-fg-muted hover:bg-ink-800 hover:text-fg",
                      // Square up edges that touch a neighbour; round the ones
                      // at an end or beside the active pill.
                      (prevActive || i === 0) && "rounded-l-md",
                      (nextActive || i === items.length - 1) && "rounded-r-md",
                    ),
              )}
            >
              {item.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
