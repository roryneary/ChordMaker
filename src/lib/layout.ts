/**
 * Every number that affects drawing lives here and only here.
 *
 * The grid is the one ported from the design's ChordDiagram: a fixed viewBox
 * scaled with width:100%, so all overlay positioning is expressed as
 * percentages of that box — never as getBoundingClientRect maths.
 */

export const STRING_COUNT = 6;
export const FRET_COUNT   = 5;

export const CELL_W = 16;   // horizontal gap between adjacent string lines
export const CELL_H = 18;   // vertical gap between adjacent fret lines

export const GRID_LEFT = 10;  // string 6 sits here
export const GRID_TOP  = 24;  // the nut line; strings run from here down

export const GRID_W = (STRING_COUNT - 1) * CELL_W;  // 80  → string 1 at x 90
export const GRID_H = FRET_COUNT * CELL_H;          // 90  → last fret at y 114

/** The nut is a bar, not a line: it overhangs the outer strings by 1.4 either side. */
export const NUT_X = GRID_LEFT - 1.4;   // 8.6
export const NUT_Y = GRID_TOP - 3.6;    // 20.4
export const NUT_W = GRID_W + 2.8;      // 82.8
export const NUT_H = 3.6;
export const NUT_R = 1.4;

/** The x/o band above the nut. */
export const MARKER_Y      = 11.4;
export const MARKER_ROW_H  = NUT_Y;  // 20.4 — the band runs from y 0 to the nut
export const OPEN_R        = 3.5;
export const MUTE_ARM      = 3.4;    // the cross spans x ± this, y 8 → 14.8
export const MUTE_TOP      = 8;
export const MUTE_BOTTOM   = 14.8;

export const DOT_R        = 6.6;
export const DOT_R_ACTIVE = 7.2;
export const RING_R       = 11;    // the just-placed-finger halo
export const BARRE_H      = 13.2;
export const BARRE_R      = 6.6;

export const LINE_W       = 1;
export const NUT_STROKE_W = 1.1;
export const MUTE_W       = 1.3;

/** Ink strengths, applied as stroke-opacity / fill-opacity so they survive export. */
export const GRID_ALPHA   = 0.34;
export const NUT_ALPHA    = 0.74;
export const MARKER_ALPHA = 0.62;
export const DOT_ALPHA    = 0.88;
/* The just-placed finger is the STRONGEST dot on the board, never the faintest.
   It was 0.42 — half the ink of a settled dot — so the finger you had just put
   down looked provisional and only "committed" when the next tap moved the halo
   off it. The halo alone says which one is new. */
export const ACTIVE_ALPHA = 1;
export const RING_ALPHA   = 0.55;

/**
 * EVERY diagram is this box, whether or not it carries a position numeral.
 *
 * The grid is 80 wide and the numeral column to its right is the rest. That
 * column is reserved on every chord, drawn or not, because containers size a
 * diagram by its WIDTH: a box that grew only when it carried a numeral drew its
 * fretboard 19% smaller than the nut-position chord in the tile beside it. A
 * fixed box costs a little space under an open chord and keeps every fretboard
 * in the app identical, which is what matters on a stand.
 *
 * Since the box never changes shape, nothing downstream asks how wide a
 * particular chord is — the overlay, the PNG and the PDF all just use VB_W.
 */
export const VB_W = 122;
export const VB_H = 122;

/**
 * The numeral names the fret at the TOP of the window, so it is set on that
 * row's centre line — dotY(1) — not floated in the corner.
 *
 * x is the left edge of the column. It clears string 1 (x 90) plus a DOT_R,
 * not just the grid line: a barre chord up the neck — which is most of what
 * lives up there — puts a dot or a bar end at x 96.6, and a numeral tucked
 * against the grid disappears underneath it. "XVII" measures 21 units at this
 * size, so the column runs 99 → 120 inside a 122 box. It cannot be measured at
 * runtime (the export path renders through canvas with no DOM), so
 * layout.test.ts guards the arithmetic instead.
 */
export const LABEL_X = 99;
export const LABEL_SIZE = 11;

export const MIN_ROOT_FRET = 1;
export const MAX_ROOT_FRET = 17;

/** The only place the neck's length is enforced — the reducer and the loader share it. */
export const clampRootFret = (n: number): number =>
  Math.min(MAX_ROOT_FRET, Math.max(MIN_ROOT_FRET, Math.round(n)));

/** String 6 sits at GRID_LEFT, string 1 at GRID_LEFT + GRID_W. */
export const stringX  = (s: number) => GRID_LEFT + (STRING_COUNT - s) * CELL_W;
/** f = 0 is the nut/top line, f = FRET_COUNT is the bottom line. */
export const fretLineY = (f: number) => GRID_TOP + f * CELL_H;
/** Vertical centre of the cell for relative fret f (1-based). */
export const dotY      = (f: number) => GRID_TOP + (f - 0.5) * CELL_H;

export interface RectPct {
  left: number;
  top: number;
  width: number;
  height: number;
}

const pct = (px: number, of: number) => (px / of) * 100;

/** Hit rect for the cell of string `s` at relative fret `f` (1-based). */
export function cellRectPct(s: number, f: number): RectPct {
  return {
    left:   pct(stringX(s) - CELL_W / 2, VB_W),
    top:    pct(fretLineY(f - 1), VB_H),
    width:  pct(CELL_W, VB_W),
    height: pct(CELL_H, VB_H),
  };
}

/** Hit rect for the x/o marker slot above string `s`. */
export function markerRectPct(s: number): RectPct {
  return {
    left:   pct(stringX(s) - CELL_W / 2, VB_W),
    top:    0,
    width:  pct(CELL_W, VB_W),
    height: pct(MARKER_ROW_H, VB_H),
  };
}
