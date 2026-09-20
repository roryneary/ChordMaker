import { describe, expect, it } from 'vitest';
import {
  MAX_SHEET_H,
  SHEET_COLUMNS,
  SHEET_GAP,
  SHEET_W,
  chordSheetFilename,
  chordSheetLayout,
  chordSheetMeta,
} from '../exportChordSheet';
import { GRID_LEFT, GRID_W, VB_W } from '../layout';

/**
 * The picture of every chord in a song. Drawing it needs a canvas; deciding
 * where everything goes does not, and that is the part that can go wrong
 * quietly — a diagram off the edge, a picture too tall for a phone to make.
 */

describe('the chord sheet layout', () => {
  it('still has a page for a song with no chords', () => {
    const layout = chordSheetLayout(0);
    expect(layout.cells).toEqual([]);
    expect(layout.rows).toBe(0);
    expect(layout.height).toBeGreaterThan(0);
  });

  it('lays five chords out three across, in reading order', () => {
    const layout = chordSheetLayout(5);
    expect(layout.columns).toBe(SHEET_COLUMNS);
    expect(layout.rows).toBe(2);
    expect(layout.cells).toHaveLength(5);

    const [a, b, c, d] = layout.cells;
    expect(a.y).toBe(b.y);
    expect(b.y).toBe(c.y);
    expect(a.x).toBeLessThan(b.x);
    expect(b.x).toBeLessThan(c.x);
    // The fourth starts the second row, under the first.
    expect(d.x).toBe(a.x);
    expect(d.y).toBeCloseTo(a.y + a.h + SHEET_GAP);
  });

  it('keeps every cell on the page', () => {
    const layout = chordSheetLayout(11, { hasMeta: true });
    for (const cell of layout.cells) {
      expect(cell.x).toBeGreaterThanOrEqual(0);
      expect(cell.x + cell.w).toBeLessThanOrEqual(layout.width);
      expect(cell.y).toBeGreaterThan(layout.metaBaseline!);
      expect(cell.diagramY + cell.diagramH).toBeLessThanOrEqual(layout.height);
    }
  });

  it('rasterises each diagram at exactly the size it is drawn', () => {
    // Anything else and the browser resamples the artwork, softening thin lines.
    const layout = chordSheetLayout(3);
    expect(layout.scale * VB_W).toBeCloseTo(layout.cells[0].diagramW);
  });

  it('centres the name over the strings, not over the box', () => {
    const [cell] = chordSheetLayout(1).cells;
    const middleOfStrings = cell.x + layout1Scale() * (GRID_LEFT + GRID_W / 2);
    expect(cell.nameX).toBeCloseTo(middleOfStrings);
    // The box keeps a column on the right for the numeral, so that is left of centre.
    expect(cell.nameX).toBeLessThan(cell.x + cell.w / 2);
  });

  it('makes room for the capo and key line only when there is one', () => {
    const bare = chordSheetLayout(3);
    const withMeta = chordSheetLayout(3, { hasMeta: true });
    expect(bare.metaBaseline).toBeNull();
    expect(withMeta.metaBaseline).toBeGreaterThan(withMeta.titleBaseline);
    expect(withMeta.cells[0].y).toBeGreaterThan(bare.cells[0].y);
  });

  it('adds columns rather than height for a very long list', () => {
    const layout = chordSheetLayout(60);
    expect(layout.height).toBeLessThanOrEqual(MAX_SHEET_H);
    expect(layout.columns).toBeGreaterThan(SHEET_COLUMNS);
    expect(layout.cells).toHaveLength(60);
  });

  it('never gets wider: it has to read on a phone without zooming', () => {
    for (const count of [0, 1, 7, 60, 200]) {
      expect(chordSheetLayout(count).width).toBe(SHEET_W);
    }
  });
});

const layout1Scale = () => chordSheetLayout(1).scale;

describe('what the sheet says about the song', () => {
  it('states the capo once somebody has answered, and nothing before', () => {
    expect(chordSheetMeta({ key: '', capo: undefined })).toBe('');
    expect(chordSheetMeta({ key: '', capo: null })).toContain('capo');
    expect(chordSheetMeta({ key: '', capo: 2 })).toContain('2nd');
  });

  it('puts the key first when there is one', () => {
    expect(chordSheetMeta({ key: 'G', capo: 2 })).toMatch(/^Key of G/);
  });

  it('names the file after the song', () => {
    expect(chordSheetFilename('Harbour Lights')).toBe('Harbour Lights chords.png');
    expect(chordSheetFilename('  ')).toBe('song chords.png');
    expect(chordSheetFilename('AC/DC: live?')).toBe('ACDC live chords.png');
  });
});
