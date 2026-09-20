import { describe, expect, it } from 'vitest';
import { chordChanged } from '../chordEdits';
import { chordReducer, emptySpec } from '../../hooks/useChordSpec';
import type { ChordSpec } from '../../types/chord';

const withDots = (spec: ChordSpec, ...dots: [1 | 2 | 3 | 4 | 5 | 6, number][]) =>
  dots.reduce(
    (s, [string, fret]) => chordReducer(s, { type: 'TOGGLE_DOT', string, fret }),
    spec,
  );

describe('chordChanged', () => {
  it('an untouched empty plate is no edit', () => {
    expect(chordChanged(emptySpec(), emptySpec())).toBe(false);
  });

  it('a dot put down and taken off again is no edit', () => {
    const s = withDots(emptySpec(), [3, 2], [3, 2]);
    expect(chordChanged(s, emptySpec())).toBe(false);
  });

  it('the same dots in a different order are the same shape', () => {
    const a = withDots(emptySpec(), [5, 3], [4, 2]);
    const b = withDots(emptySpec(), [4, 2], [5, 3]);
    expect(chordChanged(a, b)).toBe(false);
  });

  it('sees a new dot, a moved window, a marker and a barre', () => {
    const base = emptySpec();
    expect(chordChanged(withDots(base, [2, 1]), base)).toBe(true);
    expect(chordChanged(chordReducer(base, { type: 'NUDGE_ROOT_FRET', by: 2 }), base)).toBe(true);
    expect(chordChanged(chordReducer(base, { type: 'CYCLE_MARKER', string: 6 }), base)).toBe(true);
    expect(
      chordChanged(chordReducer(base, { type: 'COMPLETE_BARRE', fret: 1, a: 6, b: 1 }), base),
    ).toBe(true);
  });

  it('sees a rename, but not whitespace around the name', () => {
    const saved = { ...emptySpec(), name: 'G' };
    expect(chordChanged({ ...saved, name: 'G7' }, saved)).toBe(true);
    expect(chordChanged({ ...saved, name: ' G ' }, saved)).toBe(false);
  });
});
