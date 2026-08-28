import type { ChordSpec } from '../types/chord';
import { VB_H, viewBoxWidth } from './layout';
import { EXPORT_INK, EXPORT_PAPER } from '../theme/tokens';
import { renderChordSVG } from './renderChordSVG';

export const DEFAULT_SCALE = 3;

/**
 * Downloads and prints are black ink on white paper whatever the screen theme
 * is — a chord dictionary page, not a screenshot of the app.
 */
export const exportPalette = { ink: EXPORT_INK, paper: EXPORT_PAPER } as const;

/** The drawn size of a chord, which now depends on whether it carries a label. */
export const chordBox = (spec: ChordSpec) => ({ w: viewBoxWidth(spec.rootFret), h: VB_H });

/**
 * Decodes a chord into a drawable image at `scale` pixels per SVG unit. The
 * SVG carries its own explicit width/height (mode: 'export') rather than a
 * percentage, so the browser rasterises it at that exact resolution instead
 * of guessing from a default replaced-element size. Shared by the
 * single-chord PNG export below and the whole-song PNG.
 */
export async function chordToImage(spec: ChordSpec, scale = DEFAULT_SCALE): Promise<HTMLImageElement> {
  const svg = renderChordSVG(spec, { mode: 'export', scale, ...exportPalette });
  // An explicit charset on the Blob handles names like "C#" without the
  // unescape(encodeURIComponent(...)) data-URI dance.
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.src = url;
    // decode() resolves only once the image is actually decodable. onload is
    // where Safari otherwise hands back a blank canvas.
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function chordToPngBlob(spec: ChordSpec, scale = DEFAULT_SCALE): Promise<Blob> {
  const img = await chordToImage(spec, scale);
  const box = chordBox(spec);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(box.w * scale);
  canvas.height = Math.round(box.h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas produced no PNG data'))),
      'image/png',
    );
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // On iOS this routes through the share sheet rather than a silent save.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const ILLEGAL = /[/\\:*?"<>|]/g;

/** A name safe for every desktop filesystem, or `fallback` if nothing survives. */
export function sanitizeFilename(name: string, fallback: string): string {
  const cleaned = name.replace(ILLEGAL, '').replace(/\s+/g, ' ').trim().slice(0, 60).trim();
  return cleaned || fallback;
}

export function chordFilename(name: string): string {
  return `${sanitizeFilename(name, 'chord')}.png`;
}
