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
export const ACTIVE_ALPHA = 0.42;
export const RING_ALPHA   = 0.55;

export const VB_H = 122;
/** Every diagram in the design sits at the nut, so 100 is the common width. */
export const VB_W = 100;
/** Up the neck, "5fr" needs its own column to the right of string 1. */
export const VB_W_LABELLED = 116;
export const LABEL_X = 100;
export const LABEL_SIZE = 11;

export const MIN_ROOT_FRET = 1;
export const MAX_ROOT_FRET = 17;

/** A diagram only widens when it has a position label to carry. */
export const viewBoxWidth = (rootFret: number): number =>
  rootFret > MIN_ROOT_FRET ? VB_W_LABELLED : VB_W;

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

/**
 * Hit rect for the cell of string `s` at relative fret `f` (1-based).
 * `vbW` must match the width the artwork was drawn at, or the overlay drifts
 * off the diagram on labelled (up-the-neck) chords.
 */
export function cellRectPct(s: number, f: number, vbW: number = VB_W): RectPct {
  return {
    left:   pct(stringX(s) - CELL_W / 2, vbW),
    top:    pct(fretLineY(f - 1), VB_H),
    width:  pct(CELL_W, vbW),
    height: pct(CELL_H, VB_H),
  };
}

/** Hit rect for the x/o marker slot above string `s`. */
export function markerRectPct(s: number, vbW: number = VB_W): RectPct {
  return {
    left:   pct(stringX(s) - CELL_W / 2, vbW),
    top:    0,
    width:  pct(CELL_W, vbW),
    height: pct(MARKER_ROW_H, VB_H),
  };
}
