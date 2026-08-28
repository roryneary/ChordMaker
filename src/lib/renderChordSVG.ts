import type { ChordSpec, StringNumber } from '../types/chord';
import {
  ACTIVE_ALPHA,
  BARRE_H,
  BARRE_R,
  DOT_ALPHA,
  DOT_R,
  DOT_R_ACTIVE,
  GRID_ALPHA,
  GRID_LEFT,
  GRID_W,
  LABEL_SIZE,
  LABEL_X,
  LINE_W,
  MARKER_ALPHA,
  MARKER_Y,
  MIN_ROOT_FRET,
  MUTE_ARM,
  MUTE_BOTTOM,
  MUTE_TOP,
  MUTE_W,
  NUT_ALPHA,
  NUT_H,
  NUT_R,
  NUT_STROKE_W,
  NUT_W,
  NUT_X,
  NUT_Y,
  OPEN_R,
  RING_ALPHA,
  RING_R,
  STRING_COUNT,
  VB_H,
  dotY,
  fretLineY,
  stringX,
  viewBoxWidth,
} from './layout';

export interface RenderOpts {
  mode: 'screen' | 'export';
  /** Export only: pixels per SVG unit. */
  scale?: number;
  /** A resolved hex. Never a var() or a class name — see the note below. */
  ink: string;
  /** null leaves the diagram transparent so it sits on a themed card. */
  paper?: string | null;
  /** Omit for mono, which is what every diagram in this design is. */
  accent?: string | null;
  /** The just-placed finger: a lighter dot plus a halo. Cleared on next interaction. */
  active?: StringNumber | null;
}

/**
 * A serialised SVG carries none of the document's CSS with it, so every style
 * below is a presentation attribute. A class name or a `var(--color-text)`
 * would export as unstyled or black-on-black. Ink strengths are therefore
 * stroke-opacity / fill-opacity rather than the design's color-mix(), which
 * renders identically and survives the trip through canvas.
 *
 * The chord name is NOT drawn here — it is DOM text beside the diagram on
 * screen, and the export composer draws its own.
 */

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Trim float noise so the markup stays readable and diffable. */
const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, ''));

const SANS = "Inter, system-ui, -apple-system, sans-serif";

export function renderChordSVG(spec: ChordSpec, opts: RenderOpts): string {
  const { mode, scale = 1, ink, paper = null, accent = null, active = null } = opts;
  const fretCount = spec.fretCount;
  const gridBottom = fretLineY(fretCount);
  const showNut = spec.rootFret === MIN_ROOT_FRET;
  const vbW = viewBoxWidth(spec.rootFret);

  const mono = !accent;
  const dotFill = mono ? `fill="${ink}" fill-opacity="${DOT_ALPHA}"` : `fill="${accent}"`;
  const activeFill = mono
    ? `fill="${ink}" fill-opacity="${ACTIVE_ALPHA}"`
    : `fill="${accent}" fill-opacity="${ACTIVE_ALPHA}"`;
  const ringStroke = mono ? ink : accent;

  const parts: string[] = [];

  // Opaque paper on export: without it the PNG is transparent and the artwork
  // disappears in dark-mode viewers. On screen it stays transparent so the
  // diagram sits on whatever card holds it.
  if (paper) {
    parts.push(`<rect x="0" y="0" width="${vbW}" height="${VB_H}" fill="${paper}"/>`);
  }

  // Gridlines: frets then strings, one group sharing the ink strength.
  const grid: string[] = [];
  // f = 0 is replaced by the nut bar when the window starts at the first fret.
  for (let f = showNut ? 1 : 0; f <= fretCount; f++) {
    const y = fretLineY(f);
    grid.push(
      `<line x1="${GRID_LEFT}" y1="${n(y)}" x2="${GRID_LEFT + GRID_W}" y2="${n(y)}"/>`,
    );
  }
  for (let s = 1; s <= STRING_COUNT; s++) {
    const x = stringX(s);
    grid.push(`<line x1="${n(x)}" y1="${n(fretLineY(0))}" x2="${n(x)}" y2="${n(gridBottom)}"/>`);
  }
  parts.push(
    `<g stroke="${ink}" stroke-opacity="${GRID_ALPHA}" stroke-width="${LINE_W}">` +
      `${grid.join('')}</g>`,
  );

  if (showNut) {
    parts.push(
      `<rect x="${NUT_X}" y="${NUT_Y}" width="${NUT_W}" height="${NUT_H}" rx="${NUT_R}" ` +
        `fill="${ink}" fill-opacity="${NUT_ALPHA}"/>`,
    );
  } else {
    // Up the neck there is no nut, so the position label says where we are.
    parts.push(
      `<text x="${LABEL_X}" y="${n(dotY(1))}" text-anchor="start" ` +
        `dominant-baseline="central" fill="${ink}" fill-opacity="${MARKER_ALPHA}" ` +
        `font-family="${SANS}" font-size="${LABEL_SIZE}">${spec.rootFret}fr</text>`,
    );
  }

  // Markers above the nut. Drawn as SHAPES, not text: a templated text node
  // failed to lay out in the design prototype and every marker rendered
  // zero-width, which makes x32010 musically ambiguous.
  const markers: string[] = [];
  for (let s = 1; s <= STRING_COUNT; s++) {
    const marker = spec.markers[s - 1];
    if (marker === 'none' || !marker) continue;
    const x = stringX(s);
    if (marker === 'open') {
      markers.push(
        `<circle cx="${n(x)}" cy="${MARKER_Y}" r="${OPEN_R}" fill="none" ` +
          `stroke-width="${NUT_STROKE_W}"/>`,
      );
    } else {
      const l = n(x - MUTE_ARM);
      const r = n(x + MUTE_ARM);
      markers.push(
        `<g stroke-width="${MUTE_W}" stroke-linecap="round">` +
          `<line x1="${l}" y1="${MUTE_TOP}" x2="${r}" y2="${MUTE_BOTTOM}"/>` +
          `<line x1="${l}" y1="${MUTE_BOTTOM}" x2="${r}" y2="${MUTE_TOP}"/>` +
          `</g>`,
      );
    }
  }
  if (markers.length) {
    parts.push(
      `<g stroke="${ink}" stroke-opacity="${MARKER_ALPHA}" fill="none">${markers.join('')}</g>`,
    );
  }

  // Barres, drawn under dots so a stray dot would still read.
  for (const barre of spec.barres) {
    const xl = stringX(barre.fromString);
    const xr = stringX(barre.toString);
    parts.push(
      `<rect x="${n(xl - BARRE_R)}" y="${n(dotY(barre.fret) - BARRE_H / 2)}" ` +
        `width="${n(xr - xl + BARRE_R * 2)}" height="${BARRE_H}" ` +
        `rx="${BARRE_R}" ${dotFill}/>`,
    );
  }

  for (const dot of spec.dots) {
    const on = active === dot.string;
    const cx = n(stringX(dot.string));
    const cy = n(dotY(dot.fret));
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${on ? DOT_R_ACTIVE : DOT_R}" ` +
        `${on ? activeFill : dotFill}/>`,
    );
    if (on) {
      parts.push(
        `<circle cx="${cx}" cy="${cy}" r="${RING_R}" fill="none" stroke="${ringStroke}" ` +
          `stroke-opacity="${RING_ALPHA}" stroke-width="${LINE_W}"/>`,
      );
    }
  }

  const size =
    mode === 'export'
      ? ` width="${n(vbW * scale)}" height="${n(VB_H * scale)}"`
      : ' width="100%"';

  const label = spec.name.trim() ? `${spec.name.trim()} chord diagram` : 'Chord diagram';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${VB_H}"${size} ` +
    `role="img" aria-label="${esc(label)}">${parts.join('')}</svg>`
  );
}
