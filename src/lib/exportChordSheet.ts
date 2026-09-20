import type { Song } from '../types/song';
import { capoChosen, capoLabel } from '../components/CapoChip';
import { GRID_LEFT, GRID_W, VB_H, VB_W } from './layout';
import { canvasToPngBlob, chordToImage, exportPalette, sanitizeFilename } from './exportPng';

/**
 * Every chord in a song as one picture, with the title over it — the thing you
 * post in the band's chat after a lesson, so everybody practises the same
 * shapes. It is a picture rather than the PDF because a chat shows a picture
 * inline and makes you open a PDF.
 *
 * Portrait and a fixed width, because that is what a phone shows without
 * zooming. Three across keeps each diagram big enough to read in the chat's
 * own preview, which is where most people will look at it and no further.
 *
 * The layout is a pure function so it can be tested without a canvas — tests
 * here run in plain node, which is also why nothing in this module touches
 * `document` until `songChordsToPngBlob` is actually called.
 */

export const SHEET_W = 1080;
export const SHEET_PAD = 64;
export const SHEET_GAP = 40;
export const SHEET_TITLE_SIZE = 60;
export const SHEET_META_SIZE = 32;
export const SHEET_NAME_SIZE = 40;
export const SHEET_COLUMNS = 3;
export const MAX_SHEET_COLUMNS = 6;
/**
 * Mobile Safari refuses a canvas past a few thousand pixels on a side, and
 * `toBlob` then hands back nothing at all. So a very long chord list gets more
 * columns, never a taller picture.
 */
export const MAX_SHEET_H = 4096;
/** Matches the app when its font has loaded; falls back cleanly with no signal. */
export const SHEET_FONT = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";

export interface SheetCell {
  x: number;
  y: number;
  w: number;
  h: number;
  /**
   * Where the chord name is centred: over the fretboard, not over the box. The
   * box reserves a column on the right for the position numeral (README, "The
   * numeral sits to the right"), so the middle of the box is not the middle of
   * the strings, and a name centred there reads as nudged off its own chord.
   */
  nameX: number;
  nameBaseline: number;
  diagramY: number;
  diagramW: number;
  diagramH: number;
}

export interface ChordSheetLayout {
  width: number;
  height: number;
  columns: number;
  rows: number;
  /** Pixels per SVG unit. Passed to `chordToImage` so each diagram rasterises 1:1. */
  scale: number;
  titleBaseline: number;
  /** Null when the song has neither a capo answer nor a key to state. */
  metaBaseline: number | null;
  cells: SheetCell[];
}

export function chordSheetLayout(
  count: number,
  opts: { hasMeta?: boolean; columns?: number } = {},
): ChordSheetLayout {
  const columns = opts.columns ?? SHEET_COLUMNS;
  const width = SHEET_W;

  const cellW = (width - SHEET_PAD * 2 - (columns - 1) * SHEET_GAP) / columns;
  const diagramW = cellW;
  const diagramH = (cellW * VB_H) / VB_W;
  const nameH = SHEET_NAME_SIZE * 1.3;
  const cellH = nameH + diagramH;

  const titleBaseline = SHEET_PAD + SHEET_TITLE_SIZE;
  const metaBaseline = opts.hasMeta ? titleBaseline + SHEET_META_SIZE * 1.5 : null;
  const gridTop = (metaBaseline ?? titleBaseline) + SHEET_GAP;

  const rows = Math.ceil(count / columns);
  const height = Math.ceil(
    gridTop + rows * cellH + Math.max(0, rows - 1) * SHEET_GAP + SHEET_PAD,
  );

  if (height > MAX_SHEET_H && columns < MAX_SHEET_COLUMNS) {
    return chordSheetLayout(count, { ...opts, columns: columns + 1 });
  }

  const cells: SheetCell[] = [];
  for (let i = 0; i < count; i++) {
    const x = SHEET_PAD + (i % columns) * (cellW + SHEET_GAP);
    const y = gridTop + Math.floor(i / columns) * (cellH + SHEET_GAP);
    cells.push({
      x,
      y,
      w: cellW,
      h: cellH,
      nameX: x + (diagramW * (GRID_LEFT + GRID_W / 2)) / VB_W,
      nameBaseline: y + SHEET_NAME_SIZE,
      diagramY: y + nameH,
      diagramW,
      diagramH,
    });
  }

  return {
    width,
    height,
    columns,
    rows,
    scale: diagramW / VB_W,
    titleBaseline,
    metaBaseline,
    cells,
  };
}

/**
 * The line under the title. An unanswered capo says nothing rather than "Capo
 * not set", for the same reason the printed sheet does: the picture states
 * what is true of the song, and that is a fact about the app.
 */
export function chordSheetMeta(song: Pick<Song, 'key' | 'capo'>): string {
  return [song.key && `Key of ${song.key}`, capoChosen(song.capo) && capoLabel(song.capo)]
    .filter(Boolean)
    .join('   ·   ');
}

/** Shrinks the type until `text` fits, then trims it: a long title must not run off the edge. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  weight: number,
  size: number,
  minSize: number,
): string {
  let px = size;
  ctx.font = `${weight} ${px}px ${SHEET_FONT}`;
  while (px > minSize && ctx.measureText(text).width > maxW) {
    px -= 2;
    ctx.font = `${weight} ${px}px ${SHEET_FONT}`;
  }
  if (ctx.measureText(text).width <= maxW) return text;

  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxW) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

export async function songChordsToPngBlob(song: Song): Promise<Blob> {
  const meta = chordSheetMeta(song);
  const layout = chordSheetLayout(song.chords.length, { hasMeta: meta.length > 0 });

  /* The app's font arrives over the network. Drawing before it has loaded
     would quietly set the very first export in the fallback face. Text drawn
     by the canvas never taints it, webfont or not — that restriction is on
     fonts linked from *inside* an SVG (see README, "Not built"). */
  await document.fonts?.ready;

  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Black ink on white paper whatever the screen theme is — same as the PDF.
  ctx.fillStyle = exportPalette.paper;
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.fillStyle = exportPalette.ink;
  ctx.textBaseline = 'alphabetic';

  const contentW = layout.width - SHEET_PAD * 2;
  ctx.textAlign = 'left';
  const title = fitText(
    ctx,
    song.title.trim() || 'Untitled',
    contentW,
    600,
    SHEET_TITLE_SIZE,
    SHEET_TITLE_SIZE * 0.6,
  );
  ctx.fillText(title, SHEET_PAD, layout.titleBaseline);

  if (layout.metaBaseline !== null) {
    ctx.font = `400 ${SHEET_META_SIZE}px ${SHEET_FONT}`;
    ctx.globalAlpha = 0.62;
    ctx.fillText(meta, SHEET_PAD, layout.metaBaseline);
    ctx.globalAlpha = 1;
  }

  /* Decode every diagram, then draw. `chordToImage` revokes its blob URL once
     `decode()` resolves and the image stays drawable afterwards — the PDF path
     relies on the same thing. */
  const images = await Promise.all(song.chords.map((c) => chordToImage(c.spec, layout.scale)));

  ctx.textAlign = 'center';
  layout.cells.forEach((cell, i) => {
    const name = fitText(
      ctx,
      song.chords[i].spec.name.trim() || '—',
      // Centred left of the box's middle, so the room it has is twice the
      // distance to the nearer edge.
      (cell.nameX - cell.x) * 2,
      500,
      SHEET_NAME_SIZE,
      SHEET_NAME_SIZE * 0.6,
    );
    ctx.fillText(name, cell.nameX, cell.nameBaseline);
    ctx.drawImage(images[i], cell.x, cell.diagramY, cell.diagramW, cell.diagramH);
  });

  return canvasToPngBlob(canvas);
}

export function chordSheetFilename(title: string): string {
  return `${sanitizeFilename(title, 'song')} chords.png`;
}
