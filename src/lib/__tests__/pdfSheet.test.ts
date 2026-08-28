import { describe, expect, it } from 'vitest';
import { WORD_SIZES, a4SheetLayout, sheetLines } from '../exportPdf';
import { tokenise } from '../lyric';
import type { Placements } from '../../types/song';

const LYRIC = ['the harbour lights are on', '', 'and the last boat leaves at nine'].join('\n');

const linesFor = (lyric: string, placements: Placements = {}, names: Record<string, string> = {}) => {
  const words = tokenise(lyric);
  return {
    words,
    lines: sheetLines(lyric, words, placements, (id) => names[id] ?? null),
  };
};

describe('sheetLines', () => {
  it('keeps the blank line as a gap, not a row of words', () => {
    const { lines } = linesFor(LYRIC);
    expect(lines).toHaveLength(3);
    expect(lines[1]).toEqual({ blank: true, words: [] });
    expect(lines[0].words.map((w) => w.text)).toEqual([
      'the',
      'harbour',
      'lights',
      'are',
      'on',
    ]);
  });

  it('carries each placed chord onto the word it lands on', () => {
    const words = tokenise(LYRIC);
    const harbour = words.find((w) => w.text === 'harbour')!;
    const lines = sheetLines(LYRIC, words, { [harbour.id]: 'c1' }, () => 'G');

    const withChord = lines[0].words.filter((w) => w.chord);
    expect(withChord).toEqual([{ text: 'harbour', chord: 'G' }]);
  });
});

describe('a4SheetLayout', () => {
  it('uses the largest type size when the lyric is short', () => {
    const { lines } = linesFor(LYRIC);
    const layout = a4SheetLayout(lines);
    expect(layout.wordSize).toBe(WORD_SIZES[0]);
    expect(layout.overflows).toBe(false);
  });

  it('keeps the chord roughly 0.6 of the word size', () => {
    const { lines } = linesFor(LYRIC);
    const { wordSize, chordSize } = a4SheetLayout(lines);
    expect(chordSize / wordSize).toBeGreaterThan(0.55);
    expect(chordSize / wordSize).toBeLessThan(0.7);
  });

  /* One A4 page is the promise, so a long lyric shrinks rather than spilling
     onto a second sheet you would have to hold in the other hand. */
  it('steps the size down until a long lyric fits the page', () => {
    const long = Array.from({ length: 40 }, () => 'the harbour lights are on tonight').join('\n');
    const { lines } = linesFor(long);
    const layout = a4SheetLayout(lines);
    expect(layout.wordSize).toBeLessThan(WORD_SIZES[0]);
    expect(layout.overflows).toBe(false);
  });

  it('reports an overflow rather than silently clipping', () => {
    const huge = Array.from({ length: 400 }, () => 'the harbour lights are on tonight').join('\n');
    const { lines } = linesFor(huge);
    const layout = a4SheetLayout(lines);
    expect(layout.wordSize).toBe(WORD_SIZES[WORD_SIZES.length - 1]);
    expect(layout.overflows).toBe(true);
  });

  it('fits at least four chord diagrams across the reference row', () => {
    const { lines } = linesFor(LYRIC);
    expect(a4SheetLayout(lines).chordsAcross).toBeGreaterThanOrEqual(4);
  });
});
