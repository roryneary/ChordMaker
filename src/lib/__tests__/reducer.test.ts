import { describe, expect, it } from 'vitest';
import { chordReducer, emptySpec, isEmptySpec } from '../../hooks/useChordSpec';
import type { ChordSpec, StringNumber } from '../../types/chord';

const dot = (s: ChordSpec, string: number, fret: number) =>
  chordReducer(s, { type: 'TOGGLE_DOT', string: string as StringNumber, fret });

describe('invariants', () => {
  it('toggles a dot off when tapped twice', () => {
    const s = dot(dot(emptySpec(), 5, 3), 5, 3);
    expect(s.dots).toHaveLength(0);
  });

  it('moves rather than duplicates a dot on the same string', () => {
    const s = dot(dot(emptySpec(), 5, 3), 5, 1);
    expect(s.dots).toEqual([{ string: 5, fret: 1 }]);
  });

  it('clears a dot when the string is muted, and vice versa', () => {
    const open = chordReducer(dot(emptySpec(), 6, 2), { type: 'CYCLE_MARKER', string: 6 });
    const muted = chordReducer(open, { type: 'CYCLE_MARKER', string: 6 });
    expect(muted.markers[5]).toBe('muted');
    expect(muted.dots).toHaveLength(0);

    const redotted = dot(muted, 6, 2);
    expect(redotted.markers[5]).toBe('none');
    expect(redotted.dots).toHaveLength(1);
  });

  it('cycles markers none -> open -> muted -> none', () => {
    let s = emptySpec();
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      s = chordReducer(s, { type: 'CYCLE_MARKER', string: 1 });
      seen.push(s.markers[0]);
    }
    expect(seen).toEqual(['open', 'muted', 'none']);
  });

  it('stores a full barre as one shape and clears what it spans', () => {
    let s = dot(emptySpec(), 3, 1);
    s = chordReducer(s, { type: 'CYCLE_MARKER', string: 6 }); // open
    s = chordReducer(s, { type: 'COMPLETE_BARRE', fret: 1, a: 1, b: 6 });
    expect(s.barres).toEqual([{ fret: 1, fromString: 6, toString: 1 }]);
    expect(s.dots).toHaveLength(0);
    expect(s.markers.every((m) => m === 'none')).toBe(true);
  });

  it('normalises barre direction regardless of tap order', () => {
    const a = chordReducer(emptySpec(), { type: 'COMPLETE_BARRE', fret: 2, a: 6, b: 2 });
    const b = chordReducer(emptySpec(), { type: 'COMPLETE_BARRE', fret: 2, a: 2, b: 6 });
    expect(a.barres).toEqual(b.barres);
    expect(a.barres[0].fromString).toBeGreaterThan(a.barres[0].toString);
  });

  it('stores a span of one as a dot, not a barre', () => {
    const s = chordReducer(emptySpec(), { type: 'COMPLETE_BARRE', fret: 3, a: 4, b: 4 });
    expect(s.barres).toHaveLength(0);
    expect(s.dots).toEqual([{ string: 4, fret: 3 }]);
  });

  it('removes a barre when a covered cell is tapped', () => {
    let s = chordReducer(emptySpec(), { type: 'COMPLETE_BARRE', fret: 1, a: 5, b: 1 });
    s = dot(s, 3, 1);
    expect(s.barres).toHaveLength(0);
    expect(s.dots).toHaveLength(0);
  });

  it('truncates a barre when a string inside it is muted', () => {
    let s = chordReducer(emptySpec(), { type: 'COMPLETE_BARRE', fret: 1, a: 6, b: 1 });
    s = chordReducer(s, { type: 'CYCLE_MARKER', string: 3 });
    expect(s.barres).toEqual([{ fret: 1, fromString: 6, toString: 4 }]);
  });

  it('drops a barre that cannot survive truncation', () => {
    let s = chordReducer(emptySpec(), { type: 'COMPLETE_BARRE', fret: 1, a: 3, b: 2 });
    s = chordReducer(s, { type: 'CYCLE_MARKER', string: 2 });
    expect(s.barres).toHaveLength(0);
  });

  it('clamps the root fret to 1..17 and keeps relative frets', () => {
    let s = dot(emptySpec(), 5, 3);
    s = chordReducer(s, { type: 'SET_ROOT_FRET', rootFret: 99 });
    expect(s.rootFret).toBe(17);
    s = chordReducer(s, { type: 'SET_ROOT_FRET', rootFret: 0 });
    expect(s.rootFret).toBe(1);
    expect(s.dots).toEqual([{ string: 5, fret: 3 }]);
  });

  it('steps the window by a delta, so a burst of taps is not lost to one render', () => {
    /* The stepper dispatches a delta rather than spec.rootFret + 1. React
       batches taps that land in one task, so an absolute value computed in the
       component would have every step but the first read the same stale spec. */
    let s = dot(emptySpec(), 5, 3);
    for (let i = 0; i < 6; i++) s = chordReducer(s, { type: 'NUDGE_ROOT_FRET', by: 1 });
    expect(s.rootFret).toBe(7);
    expect(s.dots).toEqual([{ string: 5, fret: 3 }]);

    // And it stops at the ends of the neck rather than running off them.
    for (let i = 0; i < 50; i++) s = chordReducer(s, { type: 'NUDGE_ROOT_FRET', by: 1 });
    expect(s.rootFret).toBe(17);
    for (let i = 0; i < 50; i++) s = chordReducer(s, { type: 'NUDGE_ROOT_FRET', by: -1 });
    expect(s.rootFret).toBe(1);
  });

  it('never lets a string carry a dot and barre coverage at the SAME fret', () => {
    let s = dot(emptySpec(), 4, 2);
    s = chordReducer(s, { type: 'COMPLETE_BARRE', fret: 2, a: 6, b: 2 });
    const clashing = s.dots.filter((d) =>
      s.barres.some(
        (b) => b.fret === d.fret && d.string <= b.fromString && d.string >= b.toString,
      ),
    );
    expect(clashing).toHaveLength(0);
  });

  // A barre plus dots above it is how every chord dictionary draws F major.
  it('keeps a dot on a barred string when it sits on another fret', () => {
    let s = chordReducer(emptySpec(), { type: 'COMPLETE_BARRE', fret: 1, a: 6, b: 1 });
    s = dot(s, 5, 3);
    s = dot(s, 4, 3);
    s = dot(s, 3, 2);
    expect(s.barres).toEqual([{ fret: 1, fromString: 6, toString: 1 }]);
    expect(s.dots).toEqual([
      { string: 5, fret: 3 },
      { string: 4, fret: 3 },
      { string: 3, fret: 2 },
    ]);
  });

  it('keeps dots on other frets when a barre is laid over them', () => {
    let s = dot(emptySpec(), 5, 3);
    s = dot(s, 4, 3);
    s = dot(s, 3, 2);
    s = chordReducer(s, { type: 'COMPLETE_BARRE', fret: 1, a: 6, b: 1 });
    expect(s.barres).toEqual([{ fret: 1, fromString: 6, toString: 1 }]);
    expect(s.dots).toHaveLength(3);
  });

  it('reports emptiness for the export gate', () => {
    expect(isEmptySpec(emptySpec())).toBe(true);
    expect(isEmptySpec(chordReducer(emptySpec(), { type: 'CYCLE_MARKER', string: 1 }))).toBe(false);
  });
});
