import type { ChordSpec } from '../types/chord';
import {
  DOT_R,
  GRID_LEFT,
  GRID_W,
  LABEL_X,
  LINE_W,
  NUT_H,
  STRING_COUNT,
  VB_H,
  VB_W,
  dotY,
  fretLineY,
  markerY,
  stringX,
} from './layout';

export interface RenderOpts {
  mode: 'screen' | 'export';
  scale?: number;
}

const INK = '#16150F';
/**
 * A serialised SVG carries none of the document's CSS with it, so every style
 * below is a presentation attribute. No class names, no custom properties.
 * TODO: a webfont would have to be base64-embedded in an in-SVG @font-face.
 */
const SERIF = "Georgia, 'Times New Roman', serif";

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Trim float noise so the markup stays readable and diffable. */
const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, ''));

export function renderChordSVG(spec: ChordSpec, opts: RenderOpts): string {
  const { mode, scale = 1 } = opts;
  const fretCount = spec.fretCount;
  const gridBottom = fretLineY(fretCount);
  const showNut = spec.rootFret === 1;

  const parts: string[] = [];

  // Opaque paper. Without it the PNG is transparent and the black artwork
  // disappears in dark-mode viewers.
  parts.push(`<rect x="0" y="0" width="${VB_W}" height="${VB_H}" fill="#FFFFFF"/>`);

  // Chord name, centred in the title band.
  if (spec.name.trim()) {
    parts.push(
      `<text x="${VB_W / 2}" y="52" text-anchor="middle" fill="${INK}" ` +
        `font-family="${SERIF}" font-size="30">${esc(spec.name.trim())}</text>`,
    );
  }

  // Fret lines. f = 0 is replaced by the nut bar when the window starts at 1.
  for (let f = showNut ? 1 : 0; f <= fretCount; f++) {
    const y = fretLineY(f);
    parts.push(
      `<line x1="${GRID_LEFT}" y1="${n(y)}" x2="${GRID_LEFT + GRID_W}" y2="${n(y)}" ` +
        `stroke="${INK}" stroke-width="${LINE_W}" stroke-linecap="square"/>`,
    );
  }
  if (showNut) {
    parts.push(
      `<rect x="${GRID_LEFT}" y="${n(fretLineY(0) - NUT_H / 2)}" width="${GRID_W}" ` +
        `height="${NUT_H}" fill="${INK}"/>`,
    );
  }

  // String lines.
  for (let s = 1; s <= STRING_COUNT; s++) {
    const x = stringX(s);
    parts.push(
      `<line x1="${n(x)}" y1="${n(fretLineY(0))}" x2="${n(x)}" y2="${n(gridBottom)}" ` +
        `stroke="${INK}" stroke-width="${LINE_W}" stroke-linecap="square"/>`,
    );
  }

  // Position label, always shown.
  parts.push(
    `<text x="${LABEL_X}" y="${n(dotY(1))}" text-anchor="start" ` +
      `dominant-baseline="central" fill="${INK}" font-family="${SERIF}" ` +
      `font-size="20">${spec.rootFret}fr</text>`,
  );

  // Markers above the nut.
  for (let s = 1; s <= STRING_COUNT; s++) {
    const marker = spec.markers[s - 1];
    if (marker === 'none' || !marker) continue;
    const x = stringX(s);
    if (marker === 'open') {
      parts.push(
        `<circle cx="${n(x)}" cy="${n(markerY)}" r="8" fill="none" ` +
          `stroke="${INK}" stroke-width="${LINE_W}"/>`,
      );
    } else {
      const a = 7.5;
      parts.push(
        `<line x1="${n(x - a)}" y1="${n(markerY - a)}" x2="${n(x + a)}" y2="${n(markerY + a)}" ` +
          `stroke="${INK}" stroke-width="${LINE_W}" stroke-linecap="round"/>` +
          `<line x1="${n(x - a)}" y1="${n(markerY + a)}" x2="${n(x + a)}" y2="${n(markerY - a)}" ` +
          `stroke="${INK}" stroke-width="${LINE_W}" stroke-linecap="round"/>`,
      );
    }
  }

  // Barres, drawn under dots so a stray dot would still read.
  for (const barre of spec.barres) {
    const xl = stringX(barre.fromString);
    const xr = stringX(barre.toString);
    parts.push(
      `<rect x="${n(xl - DOT_R)}" y="${n(dotY(barre.fret) - DOT_R)}" ` +
        `width="${n(xr - xl + DOT_R * 2)}" height="${DOT_R * 2}" ` +
        `rx="${DOT_R}" ry="${DOT_R}" fill="${INK}"/>`,
    );
  }

  // Dots.
  for (const dot of spec.dots) {
    parts.push(
      `<circle cx="${n(stringX(dot.string))}" cy="${n(dotY(dot.fret))}" r="${DOT_R}" fill="${INK}"/>`,
    );
  }

  const size =
    mode === 'export'
      ? ` width="${n(VB_W * scale)}" height="${n(VB_H * scale)}"`
      : ' width="100%"';

  const label = spec.name.trim() ? `${spec.name.trim()} chord diagram` : 'Chord diagram';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB_W} ${VB_H}"${size} ` +
    `role="img" aria-label="${esc(label)}">${parts.join('')}</svg>`
  );
}
