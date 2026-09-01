import type { CSSProperties } from 'react';

/**
 * The mark: two nested C arcs on one centre, 120° opening, matched stroke
 * weight. The path data is the canonical geometry from the brand pack — copy
 * it, never redraw it by hand.
 *
 * The arcs take their colour from the theme rather than the brand's literal
 * hex, and the two agree exactly: `--color-text` is #292b31 on light and
 * #e9e9ed on dark, `--color-accent` is #796cbf and #9184d9. That is the brand's
 * own light/dark pair, so the mark is never recoloured — it just stops needing
 * a second copy of the palette. The base violet's failure on a pale ground is
 * already handled by the token dropping to accent-600 there.
 *
 * The arcs sweep 240°, so they measure 2πr × 240/360 — 79.6 and 48.2. The
 * splash's draw-on animation needs those lengths as dash lengths; they live in
 * app.css next to the animation, and are only correct while this `d` is.
 */
interface MarkProps {
  size?: number;
  /** Single-ink: both arcs take `currentColor`. */
  mono?: boolean;
  /** Null inside a lockup — the wordmark beside it already says the name. */
  label?: string | null;
  className?: string;
  style?: CSSProperties;
}

export function ChordCreatorMark({
  size = 32,
  mono = false,
  label = 'Chord Creator',
  className,
  style,
}: MarkProps) {
  const classes = ['cc-mark', mono ? 'is-mono' : null, className].filter(Boolean).join(' ');
  return (
    <svg
      className={classes}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      style={style}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <path
        className="cc-arc cc-arc-outer"
        d="M41.50 15.55A19 19 0 1 0 41.50 48.45"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        className="cc-arc cc-arc-inner"
        d="M37.75 22.04A11.5 11.5 0 1 0 37.75 41.96"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Mark plus wordmark. The wordmark is live text, not artwork, so it stays
 * crisp and selectable — and the brand's two ratios (gap 0.42× the mark, type
 * 0.75×) are applied here rather than hard-coded per size, so one number
 * scales the lockup correctly everywhere it appears.
 */
export function ChordCreatorLockup({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={['cc-lockup', className].filter(Boolean).join(' ')}
      style={{ gap: size * 0.42 }}
    >
      <ChordCreatorMark size={size} label={null} />
      <span className="cc-wordmark" style={{ fontSize: size * 0.75 }}>
        chord<em>creator</em>
      </span>
    </span>
  );
}
