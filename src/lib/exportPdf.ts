import type { Placements, Song, SongNote, Word } from '../types/song';
import { type Orient, UPRIGHT, VB_H, VB_W } from './layout';
import { chordToPngBlob, sanitizeFilename } from './exportPng';
import { capoChosen, capoLabel } from '../components/CapoChip';
import { groupByLine, lineCount } from './lyric';
import { NOTE_KIND_LABEL, notesByWord, songWideNotes } from './notes';

/**
 * "Print for the stand": one A4 page you can read standing up.
 *
 * Not the screen layout scaled down — a sheet. The chords run across the top as
 * a reference row, then the lyric fills the rest at the largest size that still
 * fits, with chord names over the words they land on.
 *
 * All page maths are in PDF points on A4 portrait, and the layout is a pure
 * function so pagination can be tested without a PDF library.
 */

export const PAGE_W = 595.28;
export const PAGE_H = 841.89;
export const MARGIN = 42;
export const TITLE_SIZE = 22;
export const META_SIZE = 10.5;
export const CHORD_ROW_H = 96;
export const CHORD_W = 62;
export const CHORD_GAP = 12;
/** The lyric shrinks by steps until it fits rather than spilling to page two. */
export const WORD_SIZES = [15, 14, 13, 12, 11, 10, 9] as const;
export const CHORD_RATIO = 0.62;
/** Leading is proportional: a fixed gap is loose at 15pt and absurd at 9pt. */
export const LINE_GAP_RATIO = 0.4;
/** Notes are set a step below the words they sit among. */
export const NOTE_RATIO = 0.8;

export interface SheetLine {
  words: { text: string; chord: string | null }[];
  /** A blank lyric line: a gap, not a row of words. */
  blank: boolean;
  /** Notes on this line's words, printed under it. */
  notes: SheetNote[];
}

/** A note as printed: a pattern keeps its columns in a fixed-width face. */
export interface SheetNote {
  label: string | null;
  text: string;
  mono: boolean;
}

const sheetNote = (n: SongNote, labelled: boolean): SheetNote => ({
  label: labelled && n.kind !== 'general' ? NOTE_KIND_LABEL[n.kind] : null,
  text: n.text,
  mono: n.kind !== 'general',
});

/** The notes about the whole song, as printed above the words. */
export const sheetWideNotes = (notes: SongNote[] | undefined): SheetNote[] =>
  songWideNotes(notes).map((n) => sheetNote(n, true));

export interface SheetLayout {
  lines: SheetLine[];
  wordSize: number;
  chordSize: number;
  lineHeight: number;
  noteSize: number;
  /** How many chord diagrams fit across the reference row. */
  chordsAcross: number;
  /** True when the lyric could not be made to fit even at the smallest step. */
  overflows: boolean;
}

const contentW = () => PAGE_W - MARGIN * 2;

export function sheetLines(
  lyric: string,
  words: Word[],
  placements: Placements,
  nameOf: (chordId: string) => string | null,
  notes?: SongNote[],
): SheetLine[] {
  const byWord = notesByWord(notes);
  return groupByLine(words, lineCount(lyric)).map((lineWords) => ({
    blank: lineWords.length === 0,
    words: lineWords.map((w) => {
      const chordId = placements[w.id];
      return { text: w.text, chord: chordId ? nameOf(chordId) : null };
    }),
    notes: lineWords.flatMap((w) => byWord.get(w.id) ?? []).map((n) => sheetNote(n, false)),
  }));
}

/** Height of some notes at `size`, estimated as the words are: ~0.5em a glyph. */
function notesHeight(notes: SheetNote[], size: number): number {
  return notes.reduce((sum, note) => {
    const rows = note.text.split('\n').reduce((r, part) => {
      const wide = Math.max(1, part.length) * size * (note.mono ? 0.6 : 0.5);
      return r + Math.max(1, Math.ceil(wide / contentW()));
    }, 0);
    return sum + (note.label ? size * 1.3 : 0) + rows * size * 1.35 + size * 0.3;
  }, 0);
}

/**
 * Picks the largest type size whose lyric still fits under the chord row.
 * Line wrapping is estimated from an average glyph width — jsPDF can measure
 * exactly, but the layout stays pure so it can be tested, and the estimate only
 * has to be good enough to choose a step.
 */
export function a4SheetLayout(
  lines: SheetLine[],
  chordCount = 0,
  // The chord reference row only costs height when there are chords to show.
  available = PAGE_H -
    MARGIN * 2 -
    TITLE_SIZE -
    META_SIZE -
    (chordCount > 0 ? CHORD_ROW_H : 0) -
    28,
  /** The song's own notes, over the words: they shrink with them. */
  wideNotes: SheetNote[] = [],
): SheetLayout {
  const chordsAcross = Math.max(1, Math.floor((contentW() + CHORD_GAP) / (CHORD_W + CHORD_GAP)));
  const anyChords = lines.some((l) => l.words.some((w) => w.chord));

  for (const wordSize of WORD_SIZES) {
    const chordSize = Math.round(wordSize * CHORD_RATIO * 10) / 10;
    // A chorded line needs both rows; a bare one needs only the words.
    const rowH = (anyChords ? chordSize * 1.35 : 0) + wordSize * 1.35;
    const lineHeight = rowH + wordSize * LINE_GAP_RATIO;
    const noteSize = Math.round(wordSize * NOTE_RATIO * 10) / 10;

    const height = lines.reduce((sum, line) => {
      if (line.blank) return sum + wordSize * 0.7;
      // ~0.5em average glyph width, plus a space between words.
      const wide = line.words.reduce((w, x) => w + (x.text.length + 1) * wordSize * 0.5, 0);
      const wraps = Math.max(1, Math.ceil(wide / contentW()));
      return sum + wraps * lineHeight + notesHeight(line.notes, noteSize);
    }, wideNotes.length ? notesHeight(wideNotes, noteSize) + wordSize : 0);

    if (height <= available) {
      return { lines, wordSize, chordSize, lineHeight, noteSize, chordsAcross, overflows: false };
    }
  }

  const wordSize = WORD_SIZES[WORD_SIZES.length - 1];
  const chordSize = Math.round(wordSize * CHORD_RATIO * 10) / 10;
  return {
    lines,
    wordSize,
    chordSize,
    lineHeight: chordSize * 1.35 + wordSize * 1.35 + wordSize * LINE_GAP_RATIO,
    noteSize: Math.round(wordSize * NOTE_RATIO * 10) / 10,
    chordsAcross,
    overflows: true,
  };
}

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read PNG data'));
    reader.readAsDataURL(blob);
  });

export async function songToPdfBlob(
  song: Song,
  nameOf: (chordId: string) => string | null,
  orient: Orient = UPRIGHT,
): Promise<Blob> {
  // jsPDF is ~600 kB; only printing needs it.
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });

  const lines = sheetLines(song.lyric, song.words, song.placements, nameOf, song.notes);
  const wideNotes = sheetWideNotes(song.notes);
  const layout = a4SheetLayout(lines, song.chords.length, undefined, wideNotes);

  let y = MARGIN + TITLE_SIZE;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(TITLE_SIZE);
  doc.text(song.title.trim() || 'Untitled', MARGIN, y);

  y += META_SIZE + 8;
  // An unanswered capo prints nothing rather than "Capo not set": the sheet on
  // the stand states what is true of the song, and that is a fact about the app.
  const meta = [
    // Who plays it, on the line under the title rather than as a subtitle of its
    // own: the sheet has one page and `a4SheetLayout` counts the lines that fit.
    song.artist?.trim(),
    song.key && `Key of ${song.key}`,
    song.feel,
    capoChosen(song.capo) && capoLabel(song.capo),
  ]
    .filter(Boolean)
    .join('   ·   ');
  doc.setFontSize(META_SIZE);
  doc.setTextColor(90);
  doc.text(meta, MARGIN, y);
  doc.setTextColor(0);

  // The chord reference row.
  const shown = song.chords.slice(0, layout.chordsAcross);
  if (shown.length) {
    y += 16;
    const images = await Promise.all(
      shown.map((c) => chordToPngBlob(c.spec, orient).then(blobToDataUrl)),
    );
    shown.forEach((chord, i) => {
      const x = MARGIN + i * (CHORD_W + CHORD_GAP);
      doc.setFontSize(11);
      doc.text(chord.spec.name.trim() || '—', x + CHORD_W / 2, y + 10, { align: 'center' });
      const h = (CHORD_W * VB_H) / VB_W;
      doc.addImage(images[i], 'PNG', x, y + 16, CHORD_W, h);
    });
    y += CHORD_ROW_H;
  }

  y += 12;
  doc.setDrawColor(200);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 18;

  /* A note as printed: the label, if any, then the text wrapped to the page —
     a pattern in Courier so its columns hold. Leaves y under it. */
  const drawNote = (note: SheetNote, italic: boolean) => {
    const size = layout.noteSize;
    if (note.label) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(size * 0.85);
      doc.setTextColor(90, 80, 150);
      doc.text(note.label, MARGIN, y);
      doc.setTextColor(0);
      y += size * 1.3;
    }
    doc.setFont(note.mono ? 'courier' : 'helvetica', italic && !note.mono ? 'italic' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(60);
    const rows = doc.splitTextToSize(note.text, PAGE_W - MARGIN * 2) as string[];
    for (const row of rows) {
      doc.text(row, MARGIN, y);
      y += size * 1.35;
    }
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');
    y += size * 0.3;
  };

  // How to play it, before the words it is about.
  if (wideNotes.length) {
    for (const note of wideNotes) drawNote(note, false);
    y += layout.wordSize;
  }

  // The lyric, chords over the words they land on.
  for (const line of layout.lines) {
    if (line.blank) {
      y += layout.wordSize * 0.7;
      continue;
    }

    let x = MARGIN;
    for (const word of line.words) {
      doc.setFontSize(layout.wordSize);
      const wordW = doc.getTextWidth(word.text);
      const chordW = word.chord
        ? (doc.setFontSize(layout.chordSize), doc.getTextWidth(word.chord))
        : 0;
      const cellW = Math.max(wordW, chordW);

      if (x + cellW > PAGE_W - MARGIN) {
        x = MARGIN;
        y += layout.lineHeight;
      }

      if (word.chord) {
        doc.setFontSize(layout.chordSize);
        doc.setTextColor(90, 80, 150);
        doc.text(word.chord, x, y);
        doc.setTextColor(0);
      }
      doc.setFontSize(layout.wordSize);
      doc.text(word.text, x, y + layout.wordSize * 1.15);

      x += cellW + layout.wordSize * 0.34;
    }
    y += layout.lineHeight;
    // A word's note, under the line it is on.
    if (line.notes.length) {
      y -= layout.wordSize * LINE_GAP_RATIO;
      for (const note of line.notes) drawNote(note, true);
      y += layout.wordSize * LINE_GAP_RATIO;
    }
  }

  return doc.output('blob');
}

export function songFilename(title: string): string {
  return `${sanitizeFilename(title, 'song')}.pdf`;
}
