/**
 * Shared page furniture: section headings, stat cards, tables and figure
 * frames, so both studies are laid out by the same rules rather than by two
 * sets of near-identical local components.
 */

import { Reveal } from "./Motion";

export function Section({
  id,
  index,
  title,
  children,
}: {
  id: string;
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-line py-11">
      <Reveal>
        <div className="flex items-baseline gap-3">
          <span className="tnum text-[13px] font-semibold text-accent">
            {String(index).padStart(2, "0")}
          </span>
          <h2 className="text-[22px] font-semibold tracking-tight text-ink sm:text-[26px]">
            {title}
          </h2>
        </div>
      </Reveal>
      <div className="mt-5 space-y-4 text-[15.5px] leading-[1.78] text-ink-muted">
        {children}
      </div>
    </section>
  );
}

/** A sub-heading inside a section. */
export function Sub({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="pt-3 text-[16px] font-semibold tracking-tight text-ink">
      {children}
    </h3>
  );
}

/** Emphasised inline value, for a number the surrounding sentence turns on. */
export function V({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>;
}

/** Inline code. */
export function C({ children }: { children: React.ReactNode }) {
  return (
    <code className="whitespace-nowrap rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[13px] text-accent-strong">
      {children}
    </code>
  );
}

export function StatCard({
  value,
  label,
  detail,
  tone = "ink",
}: {
  value: React.ReactNode;
  label: string;
  detail?: string;
  tone?: "ink" | "accent";
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-4 transition-colors duration-200 hover:border-line-strong">
      <div
        className={`tnum text-[24px] font-semibold tracking-tight ${
          tone === "accent" ? "text-accent" : "text-ink"
        }`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[12.5px] font-medium text-ink">{label}</div>
      {detail && (
        <div className="mt-1 text-[12px] leading-snug text-ink-dim">{detail}</div>
      )}
    </div>
  );
}

/** A callout for a paragraph that carries the section's conclusion. */
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-accent-line bg-accent-soft px-5 py-4 text-[14.5px] leading-relaxed text-ink-muted">
      {children}
    </p>
  );
}

export function Table({
  head,
  children,
  minWidth = 720,
  caption,
}: {
  head: React.ReactNode;
  children: React.ReactNode;
  minWidth?: number;
  caption?: React.ReactNode;
}) {
  return (
    <Reveal className="my-6">
      <div className="thin-scroll overflow-x-auto rounded-xl border border-line">
        {/* Inset the first and last column from the rounded border. Row
            headers carried no horizontal padding, so their text sat on the
            table's edge and out of line with the column headings. */}
        <table
          className="w-full border-collapse text-sm [&_tr>*:first-child]:pl-4 [&_tr>*:last-child]:pr-4"
          style={{ minWidth }}
        >
          {head}
          {children}
        </table>
      </div>
      {caption && (
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-dim">
          {caption}
        </p>
      )}
    </Reveal>
  );
}

export const TH = ({
  children,
  align = "right",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) => (
  <th
    className={`whitespace-nowrap px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-dim ${
      align === "left" ? "text-left" : "text-right"
    }`}
  >
    {children}
  </th>
);

/** Bulleted list with the accent dot, used for limitations and next steps. */
export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-[14.5px] leading-relaxed">
          <span
            aria-hidden
            className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
