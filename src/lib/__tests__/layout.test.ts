import { describe, expect, it } from 'vitest';
import {
  CELL_H,
  CELL_W,
  GRID_LEFT,
  GRID_W,
  VB_H,
  VB_W,
  cellRectPct,
  markerRectPct,
  stringX,
} from '../layout';

describe('geometry', () => {
  it('puts string 6 left of string 1 — the mirrored-diagram guard', () => {
    expect(stringX(6)).toBeLessThan(stringX(1));
    expect(stringX(6)).toBe(GRID_LEFT);
    expect(stringX(1)).toBe(GRID_LEFT + GRID_W);
  });

  it('has the documented viewBox', () => {
    expect([VB_W, VB_H]).toEqual([320, 370]);
  });

  it('centres cell rects on their string line', () => {
    const r = cellRectPct(6, 1);
    expect((r.left / 100) * VB_W).toBeCloseTo(stringX(6) - CELL_W / 2);
    expect((r.width / 100) * VB_W).toBeCloseTo(CELL_W);
    expect((r.height / 100) * VB_H).toBeCloseTo(CELL_H);
  });

  it('stacks marker rects directly above the nut', () => {
    const m = markerRectPct(3);
    const c = cellRectPct(3, 1);
    expect(m.left).toBeCloseTo(c.left);
    expect(m.top + m.height).toBeCloseTo(c.top);
  });
});
