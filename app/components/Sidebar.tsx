"use client";

/**
 * Fixed left navigation.
 *
 * Replaces the old top nav, which had to hold two long project names plus a row
 * of in-page anchors and was crowded at every width below a desktop. A sidebar
 * gives the anchors a vertical column, which is where a list of ten section
 * names actually belongs, and leaves the top strip for the page title and the
 * repository link.
 *
 * The active-section marker is a single element animated between positions
 * rather than one border per item, so the highlight slides instead of jumping.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PROJECTS, SITE } from "@/lib/project";
import { cn } from "@/lib/utils";
import { IconLogo, IconClose, IconMenu } from "./Icons";

export interface Section {
  id: string;
  label: string;
}

export default function Sidebar({ sections = [] }: { sections?: Section[] }) {
  const pathname = usePathname();
  const [active, setActive] = useState<string>("");
  const [open, setOpen] = useState(false);
  const markerRef = useRef<HTMLSpanElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Every route link closes the mobile drawer through `close` below rather than
  // through an effect on the pathname: navigating IS the event, so handling it
  // in the handler avoids a second render pass just to hide the drawer.
  const close = () => setOpen(false);

  // Which section is under the top of the viewport.
  useEffect(() => {
    if (!sections.length) return;
    const nodes = sections
      .map((s) => document.getElementById(s.id))
      .filter((n): n is HTMLElement => n !== null);
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length) setActive(visible[0].target.id);
      },
      { rootMargin: "-88px 0px -68% 0px", threshold: 0 },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [sections]);

  // Slide the marker to the active item.
  useEffect(() => {
    const marker = markerRef.current;
    const list = listRef.current;
    if (!marker || !list) return;

    const target = active
      ? list.querySelector<HTMLElement>(`[data-sec="${active}"]`)
      : null;
    if (!target) {
      marker.style.opacity = "0";
      return;
    }
    const top = target.offsetTop;
    const height = target.offsetHeight;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      marker.style.opacity = "1";
      marker.style.transform = `translateY(${top}px)`;
      marker.style.height = `${height}px`;
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { animate } = await import("animejs");
        if (cancelled) return;
        animate(marker, {
          translateY: top,
          height,
          opacity: 1,
          duration: 320,
          ease: "out(3)",
        });
      } catch {
        marker.style.opacity = "1";
        marker.style.transform = `translateY(${top}px)`;
        marker.style.height = `${height}px`;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  const isRoute = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const nav = (
    <div className="flex h-full flex-col">
      <Link
        href="/"
        onClick={close}
        className="group flex shrink-0 items-center gap-2.5 px-5 py-5 font-semibold tracking-tight text-ink"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-surface p-1.5 text-accent transition-colors duration-200 group-hover:border-accent-line group-hover:bg-accent-soft">
          <IconLogo />
        </span>
        <span className="text-[15px] leading-tight">{SITE.name}</span>
      </Link>

      <nav className="px-3" aria-label="Projects">
        <p className="eyebrow px-2 pb-2 pt-1">Projects</p>
        <ul className="space-y-0.5">
          {[{ href: "/", navName: "Overview" }, ...PROJECTS].map((p) => (
            <li key={p.href}>
              <Link
                href={p.href}
                onClick={close}
                aria-current={isRoute(p.href) ? "page" : undefined}
                className={cn(
                  "block rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors duration-200",
                  isRoute(p.href)
                    ? "bg-accent-soft text-accent-strong"
                    : "text-ink-muted hover:bg-surface-2 hover:text-ink",
                )}
              >
                {p.navName}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {sections.length > 0 && (
        <nav
          className="thin-scroll mt-6 min-h-0 flex-1 overflow-y-auto px-3 pb-6"
          aria-label="Sections on this page"
        >
          <p className="eyebrow px-2 pb-2">On this page</p>
          <div className="relative">
            {/* The sliding active marker, positioned by the effect above. */}
            <span
              ref={markerRef}
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 w-[2px] rounded-full bg-accent opacity-0"
            />
            <ul ref={listRef} className="space-y-0.5 border-l border-line pl-0">
              {sections.map((s, i) => (
                <li key={s.id} data-sec={s.id}>
                  <a
                    href={`#${s.id}`}
                    className={cn(
                      "flex items-baseline gap-2 rounded-r-lg py-1.5 pl-3 pr-2 text-[13px] transition-colors duration-200",
                      active === s.id
                        ? "font-medium text-accent-strong"
                        : "text-ink-dim hover:text-ink",
                    )}
                  >
                    <span className="tnum text-[10.5px] opacity-60">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      )}

      <div className="mt-auto border-t border-line px-5 py-4 text-[11.5px] leading-relaxed text-ink-dim">
        Three projects, each with its own repository, fixed dataset and
        reproducible pipeline.
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile trigger, in the top strip. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-line bg-paper text-ink-muted transition-colors duration-200 hover:border-line-strong hover:text-ink lg:hidden"
      >
        <IconMenu />
      </button>

      {/* Desktop rail. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-w)] border-r border-line bg-surface lg:block">
        {nav}
      </aside>

      {/* Mobile drawer. */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={close}
            className="absolute inset-0 cursor-default bg-ink/25 backdrop-blur-[2px]"
          />
          <div className="absolute inset-y-0 left-0 w-[min(19rem,86vw)] border-r border-line bg-surface shadow-xl">
            <button
              type="button"
              onClick={close}
              aria-label="Close navigation"
              className="absolute right-3 top-4 grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-ink-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
            >
              <IconClose />
            </button>
            {nav}
          </div>
        </div>
      )}
    </>
  );
}
