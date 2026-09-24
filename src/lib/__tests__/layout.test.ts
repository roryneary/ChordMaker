import { describe, expect, it } from 'vitest';
import {
  BARRE_R,
  CELL_H,
  CELL_W,
  DOT_R,
  GRID_LEFT,
  GRID_W,
  LABEL_SIZE,
  LABEL_X,
  MARKER_ROW_H,
  MARKER_Y,
  MAX_ROOT_FRET,
  OPEN_R,
  type Orient,
  UPRIGHT,
  VB_H,
  VB_W,
  cellRectPct,
  dotY,
  fretLineY,
  gridCentreX,
  labelAt,
  markerRectPct,
  place,
  stringX,
} from '../layout';
import { toRoman } from '../numerals';

describe('geometry', () => {
  it('puts string 6 left of string 1 — the mirrored-diagram guard', () => {
    expect(stringX(6)).toBeLessThan(stringX(1));
    expect(stringX(6)).toBe(GRID_LEFT);
    expect(stringX(1)).toBe(GRID_LEFT + GRID_W);
  });

  it('matches the design ChordDiagram grid exactly', () => {
    expect([VB_W, VB_H]).toEqual([122, 122]);
    // String x positions, low E (string 6) first.
    expect([6, 5, 4, 3, 2, 1].map(stringX)).toEqual([10, 26, 42, 58, 74, 90]);
    // Fret lines; strings run 24 -> 114.
    expect([1, 2, 3, 4, 5].map(fretLineY)).toEqual([42, 60, 78, 96, 114]);
    expect(fretLineY(0)).toBe(24);
    // Dot centres: 24 + (f - 0.5) * 18.
    expect([1, 2, 3, 4, 5].map(dotY)).toEqual([33, 51, 69, 87, 105]);
  });

  it('gives every diagram the same box, so no chord draws a smaller fretboard', () => {
    /* The numeral column is reserved whether or not a numeral is drawn.
       Containers size a diagram by its WIDTH, so a box that grew only for
       up-the-neck chords rendered their fretboard smaller than the nut chord in
       the tile beside it. There is deliberately no per-chord width to ask for. */
    expect(VB_W).toBe(122);
  });

  it('starts the numeral clear of a dot on string 1, not just clear of the grid', () => {
    /* Most chords up the neck are barres, which put a dot or a bar end at
       stringX(1) + DOT_R. A numeral tucked against the grid line vanishes
       underneath it — which is exactly what happened at LABEL_X 93. */
    expect(LABEL_X).toBeGreaterThan(stringX(1) + DOT_R);
    expect(LABEL_X).toBeGreaterThan(stringX(1) + BARRE_R);
  });

  it('keeps the widest numeral inside the box', () => {
    /* The export path renders through canvas with no DOM, so the text can never
       be measured — the column is sized by estimate, and this is what stops a
       later tweak to LABEL_SIZE or VB_W clipping "XVII" off the PNG. Cap widths
       as a fraction of the em, from Inter's metrics. */
    const EM: Record<string, number> = { I: 0.31, V: 0.67, X: 0.67 };
    const widest = [...toRoman(MAX_ROOT_FRET)].reduce((w, g) => w + EM[g]! * LABEL_SIZE, 0);
    expect(LABEL_X + widest).toBeLessThanOrEqual(VB_W);
  });

  it('sets the numeral on the centre line of the fret it names', () => {
    // Not floated in a corner: it labels the top row of the window.
    expect(dotY(1)).toBe(33);
  });

  it('centres cell rects on their string line', () => {
    const r = cellRectPct(6, 1);
    expect((r.left / 100) * VB_W).toBeCloseTo(stringX(6) - CELL_W / 2);
    expect((r.width / 100) * VB_W).toBeCloseTo(CELL_W);
    expect((r.height / 100) * VB_H).toBeCloseTo(CELL_H);
  });

  it('lands every overlay button on its own string line', () => {
    for (const s of [1, 2, 3, 4, 5, 6]) {
      const r = cellRectPct(s, 1);
      const centre = ((r.left + r.width / 2) / 100) * VB_W;
      expect(centre).toBeCloseTo(stringX(s));
    }
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

describe('turning the diagram for the player', () => {
  const ALL: Orient[] = [
    { leftHanded: false, sideways: false },
    { leftHanded: true, sideways: false },
    { leftHanded: false, sideways: true },
    { leftHanded: true, sideways: true },
  ];

  it('leaves the upright right-handed diagram exactly as it was', () => {
    expect(place(stringX(6), dotY(1))).toEqual([stringX(6), dotY(1)]);
    expect(cellRectPct(3, 2)).toEqual(cellRectPct(3, 2, UPRIGHT));
  });

  /* The mirror image a left-hander sees of their own neck. */
  it('puts string 6 on the right for a left-hander', () => {
    const o = { leftHanded: true, sideways: false };
    expect(place(stringX(6), 0, o)[0]).toBe(stringX(1));
    expect(place(stringX(1), 0, o)[0]).toBe(stringX(6));
    // The numeral column is still clear of the outermost string's dot.
    expect(place(stringX(6), 0, o)[0] + BARRE_R).toBeLessThan(LABEL_X);
  });

  /* Like tab: the thinnest string on top, the nut on the left. */
  it('lays the neck across, thinnest string on top, when sideways', () => {
    const o = { leftHanded: false, sideways: true };
    expect(place(stringX(1), 0, o)[1]).toBeLessThan(place(stringX(6), 0, o)[1]);
    expect(place(0, fretLineY(0), o)[0]).toBeLessThan(place(0, fretLineY(5), o)[0]);
    // Open and muted marks are on the far side of the nut from the frets.
    expect(place(0, MARKER_Y, o)[0]).toBeLessThan(place(0, fretLineY(0), o)[0]);
  });

  it('puts the nut on the right for a left-hander, sideways', () => {
    const o = { leftHanded: true, sideways: true };
    expect(place(0, fretLineY(0), o)[0]).toBeGreaterThan(place(0, fretLineY(5), o)[0]);
    expect(place(stringX(1), 0, o)[1]).toBeLessThan(place(stringX(6), 0, o)[1]);
  });

  /* The box is the same 122 × 122 every way round, so every container, the
     PNG and the PDF size a turned chord exactly as they size an upright one. */
  it('keeps every string, fret, dot and mark inside the same box', () => {
    for (const o of ALL) {
      for (let s = 1; s <= 6; s++) {
        for (const y of [MARKER_Y - OPEN_R, fretLineY(0), fretLineY(5), dotY(5) + DOT_R]) {
          for (const x of [stringX(s) - DOT_R, stringX(s) + DOT_R]) {
            const [px, py] = place(x, y, o);
            expect(px).toBeGreaterThanOrEqual(0);
            expect(px).toBeLessThanOrEqual(VB_W);
            expect(py).toBeGreaterThanOrEqual(0);
            expect(py).toBeLessThanOrEqual(VB_H);
          }
        }
      }
    }
  });

  it('keeps the numeral clear of the strings and inside the box, every way round', () => {
    for (const o of ALL) {
      const at = labelAt(o);
      expect(at.y + LABEL_SIZE / 2).toBeLessThanOrEqual(VB_H);
      if (o.sideways) {
        // Under the thickest string's dots, which are the lowest thing drawn.
        expect(at.y - LABEL_SIZE / 2).toBeGreaterThan(place(stringX(6) - DOT_R, 0, o)[1]);
        // Centred on the first fret's column.
        expect(at.x).toBeCloseTo(place(0, dotY(1), o)[0]);
      } else {
        expect(at.x).toBe(LABEL_X);
      }
    }
  });

  it('lands every overlay button on its own string and fret, every way round', () => {
    for (const o of ALL) {
      for (const s of [1, 3, 6]) {
        for (const f of [1, 4]) {
          const r = cellRectPct(s, f, o);
          const cx = ((r.left + r.width / 2) / 100) * VB_W;
          const cy = ((r.top + r.height / 2) / 100) * VB_H;
          const [ex, ey] = place(stringX(s), dotY(f), o);
          expect(cx).toBeCloseTo(ex);
          expect(cy).toBeCloseTo(ey);
        }
      }
    }
  });

  it('puts the name over the middle of the fretboard', () => {
    expect(gridCentreX(UPRIGHT)).toBe(GRID_LEFT + GRID_W / 2);
    expect(gridCentreX({ leftHanded: true, sideways: false })).toBe(GRID_LEFT + GRID_W / 2);
    const across = { leftHanded: false, sideways: true };
    expect(gridCentreX(across)).toBeCloseTo(
      (place(0, fretLineY(0), across)[0] + place(0, fretLineY(5), across)[0]) / 2,
    );
  });
});
