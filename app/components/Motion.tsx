"use client";

/**
 * Motion primitives, built on anime.js.
 *
 * Two rules shape everything here. Reduced motion is honoured by skipping the
 * animation entirely and showing the final state, and content is never left
 * invisible if the animation does not run: `Reveal` sets opacity to 1 in its own
 * effect before anime.js touches it, so a failed import or a blocked observer
 * degrades to plain content rather than a blank page.
 */

import { useEffect, useRef, useState } from "react";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Marks the document ready so the reveal CSS can hide elements pre-animation. */
export function MotionReady() {
  useEffect(() => {
    if (!prefersReducedMotion()) {
      document.documentElement.classList.add("js-ready");
    }
  }, []);
  return null;
}

/**
 * Fades and lifts children into place the first time they scroll into view.
 *
 * One observer per element, disconnected after it fires, so a long page does not
 * accumulate listeners.
 */
export function Reveal({
  children,
  delay = 0,
  y = 14,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const show = () => {
      el.style.opacity = "1";
      el.style.transform = "none";
    };

    if (prefersReducedMotion()) {
      show();
      return;
    }

    /*
      The observer is created synchronously, before anime.js is loaded.

      Building it inside the import's `then` instead meant that on a fast scroll
      the element could pass the viewport before the observer existed, and since
      IntersectionObserver only reports changes from the moment it starts
      observing, that element stayed at opacity 0 for the rest of the session.
      Loading the animation inside the callback keeps the trigger reliable and
      leaves the animation as the enhancement it is meant to be.
    */
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.disconnect();
          import("animejs")
            .then(({ animate }) =>
              animate(el, {
                opacity: [0, 1],
                translateY: [y, 0],
                duration: 520,
                delay,
                ease: "out(3)",
              }),
            )
            .catch(show);
        }
      },
      // threshold 0 rather than a fraction: an element taller than the viewport
      // can never reach a percentage of itself, and several sections here are.
      { rootMargin: "0px 0px -8% 0px", threshold: 0 },
    );
    observer.observe(el);

    return () => observer.disconnect();
  }, [delay, y]);

  return (
    <div ref={ref} data-reveal className={className}>
      {children}
    </div>
  );
}

/**
 * Counts a number up when it first scrolls into view.
 *
 * The element is sized by its final value from the first paint, so the count-up
 * cannot reflow the layout around it as the digits change.
 */
export function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const final = `${prefix}${value.toFixed(decimals)}${suffix}`;
  const [text, setText] = useState(final);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    // Observer first, animation second - see the note in Reveal.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.disconnect();
          import("animejs")
            .then(({ animate }) => {
              const state = { n: 0 };
              animate(state, {
                n: value,
                duration: 900,
                ease: "out(3)",
                onUpdate: () =>
                  setText(`${prefix}${state.n.toFixed(decimals)}${suffix}`),
                onComplete: () => setText(final),
              });
            })
            .catch(() => setText(final));
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);

    return () => observer.disconnect();
  }, [value, decimals, prefix, suffix, final]);

  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}
