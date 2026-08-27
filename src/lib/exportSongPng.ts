import type { Song } from '../types/song';
import { VB_H, VB_W } from './layout';
import { chordToImage, sanitizeFilename } from './exportPng';

// Layout is in CSS-pixel-equivalent units, then rasterised at RASTER_SCALE
// so the sheet stays crisp when someone pinch-zooms it in a chat app.
export const SHEET_W = 900;
export const MARGIN = 36;
export const COLUMNS = 3;
export const GUTTER = 20;
export const TITLE_H = 64;
export const RASTER_SCALE = 2;

const INK = '#16150F';
const SERIF = "Georgia, 'Times New Roman', serif";

export interface SongPngLayout {
  width: number;
  height: number;
  rects: { x: number; y: number; w: number; h: number }[];
}

/**
 * One continuous sheet, no pagination: rows simply stack until every chord
 * has a slot. Pure so it is testable without touching canvas or images.
 */
export function songPngLayout(count: number): SongPngLayout {
  const contentW = SHEET_W - MARGIN * 2;
  const cellW = (contentW - GUTTER * (COLUMNS - 1)) / COLUMNS;
  const cellH = cellW * (VB_H / VB_W);
  const rows = Math.max(1, Math.ceil(count / COLUMNS));

  const rects = Array.from({ length: count }, (_, i) => {
    const col = i % COLUMNS;
    const row = Math.floor(i / COLUMNS);
    return {
      x: MARGIN + col * (cellW + GUTTER),
      y: MARGIN + TITLE_H + row * (cellH + GUTTER),
      w: cellW,
      h: cellH,
    };
  });

  const height = count === 0 ? MARGIN * 2 + TITLE_H : MARGIN + TITLE_H + rows * cellH + (rows - 1) * GUTTER + MARGIN;
  return { width: SHEET_W, height, rects };
}

export async function songToPngBlob(song: Song, scale = RASTER_SCALE): Promise<Blob> {
  const layout = songPngLayout(song.chords.length);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(layout.width * scale);
  canvas.height = Math.round(layout.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.scale(scale, scale);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, layout.width, layout.height);

  const title = song.title.trim() || 'Untitled song';
  ctx.fillStyle = INK;
  ctx.font = `30px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(title, layout.width / 2, MARGIN + 30);

  // Render each chord at the resolution it will actually occupy, so text
  // inside the tiles stays sharp instead of being a stretched-up bitmap.
  const tileScale = ((layout.rects[0]?.w ?? VB_W) * scale) / VB_W;
  const images = await Promise.all(song.chords.map((c) => chordToImage(c.spec, tileScale)));

  layout.rects.forEach((r, i) => {
    ctx.drawImage(images[i], r.x, r.y, r.w, r.h);
  });

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas produced no PNG data'))),
      'image/png',
    );
  });
}

export function songPngFilename(title: string): string {
  return `${sanitizeFilename(title, 'song')}.png`;
}
