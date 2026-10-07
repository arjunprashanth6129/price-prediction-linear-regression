/*
  Icon set. Everything shares a 24x24 viewBox and inherits `currentColor`, so no
  icon needs a colour prop. All are decorative next to their text labels, so they
  carry aria-hidden and the label does the talking for screen readers.

  Drawn in the Lucide idiom (1.75 stroke, round caps and joins) for a consistent
  optical weight, rather than mixed from several sets.
*/

type IconProps = { className?: string };

function Stroke({
  className = "h-5 w-5",
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** GitHub mark. Solid fill (the official mark shape), not a stroke icon. */
export const IconGitHub = ({ className = "h-4 w-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.5 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.4-5.25 5.69.41.35.78 1.05.78 2.12v3.14c0 .31.2.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
  </svg>
);

/**
 * Wordmark glyph: a scatter of observations with a flat line through them.
 *
 * The flat line is the finding. A logo showing a rising trend would advertise
 * the opposite of what these studies concluded.
 */
export const IconLogo = ({ className = "h-full w-full" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M3 12h18" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    <circle cx="6.5" cy="7" r="1.5" fill="currentColor" />
    <circle cx="11" cy="16.5" r="1.5" fill="currentColor" />
    <circle cx="15.5" cy="6" r="1.5" fill="currentColor" />
    <circle cx="19" cy="17" r="1.5" fill="currentColor" />
  </svg>
);

export const IconArrowRight = ({ className = "h-4 w-4" }: IconProps) => (
  <Stroke className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Stroke>
);

export const IconArrowUp = ({ className = "h-4 w-4" }: IconProps) => (
  <Stroke className={className}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Stroke>
);

export const IconMenu = ({ className = "h-5 w-5" }: IconProps) => (
  <Stroke className={className}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Stroke>
);

export const IconClose = ({ className = "h-4 w-4" }: IconProps) => (
  <Stroke className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Stroke>
);

export const IconExternal = ({ className = "h-3.5 w-3.5" }: IconProps) => (
  <Stroke className={className}>
    <path d="M14 5h5v5M19 5l-8 8M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Stroke>
);

/** A page with a folded corner and text lines, for links to a paper. */
export const IconPaper = ({ className }: IconProps) => (
  <Stroke className={className}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6M9 17h4" />
  </Stroke>
);
