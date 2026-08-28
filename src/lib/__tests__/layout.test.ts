import { describe, expect, it } from 'vitest';
import {
  CELL_H,
  CELL_W,
  GRID_LEFT,
  GRID_W,
  MARKER_ROW_H,
  VB_H,
  VB_W,
  VB_W_LABELLED,
  cellRectPct,
  dotY,
  fretLineY,
  markerRectPct,
  stringX,
  viewBoxWidth,
} from '../layout';

describe('geometry', () => {
  it('puts string 6 left of string 1 — the mirrored-diagram guard', () => {
    expect(stringX(6)).toBeLessThan(stringX(1));
    expect(stringX(6)).toBe(GRID_LEFT);
    expect(stringX(1)).toBe(GRID_LEFT + GRID_W);
  });

  it('matches the design ChordDiagram grid exactly', () => {
    expect([VB_W, VB_H]).toEqual([100, 122]);
    // String x positions, low E (string 6) first.
    expect([6, 5, 4, 3, 2, 1].map(stringX)).toEqual([10, 26, 42, 58, 74, 90]);
    // Fret lines; strings run 24 -> 114.
    expect([1, 2, 3, 4, 5].map(fretLineY)).toEqual([42, 60, 78, 96, 114]);
    expect(fretLineY(0)).toBe(24);
    // Dot centres: 24 + (f - 0.5) * 18.
    expect([1, 2, 3, 4, 5].map(dotY)).toEqual([33, 51, 69, 87, 105]);
  });

  it('widens the box only when a position label has to fit', () => {
    expect(viewBoxWidth(1)).toBe(VB_W);
    expect(viewBoxWidth(5)).toBe(VB_W_LABELLED);
  });

  it('centres cell rects on their string line', () => {
    const r = cellRectPct(6, 1);
    expect((r.left / 100) * VB_W).toBeCloseTo(stringX(6) - CELL_W / 2);
    expect((r.width / 100) * VB_W).toBeCloseTo(CELL_W);
    expect((r.height / 100) * VB_H).toBeCloseTo(CELL_H);
  });

  it('measures overlay rects against the width the artwork was drawn at', () => {
    // Same string, wider box: the button must sit at a smaller percentage or it
    // drifts off the diagram on an up-the-neck chord.
    const narrow = cellRectPct(3, 1, VB_W);
    const wide = cellRectPct(3, 1, VB_W_LABELLED);
    expect(wide.left).toBeLessThan(narrow.left);
    expect((wide.left / 100) * VB_W_LABELLED).toBeCloseTo(
      (narrow.left / 100) * VB_W,
    );
  });

  it('stacks marker rects directly above the nut', () => {
    const m = markerRectPct(3);
    const c = cellRectPct(3, 1);
    expect(m.left).toBeCloseTo(c.left);
    expect(m.top).toBe(0);
    // The band ends at the nut, which sits just above the first fret cell.
    expect((m.height / 100) * VB_H).toBeCloseTo(MARKER_ROW_H);
    expect(m.top + m.height).toBeLessThan(c.top);
  });
});
