import type { Song } from '../types/song';
import { VB_H, VB_W } from './layout';
import { chordToPngBlob, sanitizeFilename } from './exportPng';

// All page maths are in PDF points on A4 portrait.
export const PAGE_W = 595.28;
export const PAGE_H = 841.89;
export const MARGIN = 48;
export const COLUMNS = 3;
export const GUTTER = 18;
/** Vertical room reserved for the song title on the first page. */
export const TITLE_BAND = 56;

export interface PdfRect {
  page: number; // 0-based
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Where each chord lands. Pure so the pagination can be tested without a
 * PDF library: cells keep the 320x370 chord aspect, rows flow down the page,
 * and a row that does not fit starts a new page.
 */
export function pdfGridLayout(count: number): PdfRect[] {
  const contentW = PAGE_W - MARGIN * 2;
  const cellW = (contentW - GUTTER * (COLUMNS - 1)) / COLUMNS;
  const cellH = cellW * (VB_H / VB_W);

  const rects: PdfRect[] = [];
  let page = 0;
  let y = MARGIN + TITLE_BAND;

  for (let i = 0; i < count; i++) {
    const col = i % COLUMNS;
    if (col === 0 && i > 0) {
      y += cellH + GUTTER;
      if (y + cellH > PAGE_H - MARGIN) {
        page += 1;
        y = MARGIN;
      }
    }
    rects.push({ page, x: MARGIN + col * (cellW + GUTTER), y, w: cellW, h: cellH });
  }
  return rects;
}

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read PNG data'));
    reader.readAsDataURL(blob);
  });

export async function songToPdfBlob(song: Song): Promise<Blob> {
  // jsPDF is ~600 kB; only the PDF button needs it.
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const title = song.title.trim() || 'Untitled song';

  doc.setFont('times', 'normal');
  doc.setFontSize(24);
  doc.text(title, PAGE_W / 2, MARGIN + 24, { align: 'center' });

  const rects = pdfGridLayout(song.chords.length);
  // Every chord name is already drawn into its PNG by renderChordSVG.
  const images = await Promise.all(
    song.chords.map((c) => chordToPngBlob(c.spec).then(blobToDataUrl)),
  );

  let currentPage = 0;
  rects.forEach((r, i) => {
    while (currentPage < r.page) {
      doc.addPage();
      currentPage += 1;
    }
    doc.addImage(images[i], 'PNG', r.x, r.y, r.w, r.h);
  });

  return doc.output('blob');
}

export function songFilename(title: string): string {
  return `${sanitizeFilename(title, 'song')}.pdf`;
}
