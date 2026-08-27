/**
 * Every number that affects drawing lives here and only here.
 * The SVG is a fixed viewBox scaled with width:100%, so all overlay
 * positioning is expressed as percentages of that box — never as
 * getBoundingClientRect maths.
 */

export const STRING_COUNT = 6;
export const FRET_COUNT   = 5;

export const CELL_W = 44;   // horizontal gap between adjacent string lines
export const CELL_H = 50;   // vertical gap between adjacent fret lines

export const GRID_W = (STRING_COUNT - 1) * CELL_W;  // 220
export const GRID_H = FRET_COUNT * CELL_H;          // 250

export const TITLE_H      = 46;  // chord name band
export const MARKER_ROW_H = 34;  // x/o row above the nut
export const PAD_LEFT   = 28;
export const PAD_RIGHT  = 72;    // room for "12fr"
export const PAD_TOP    = 16;
export const PAD_BOTTOM = 24;

export const DOT_R  = 14;
export const NUT_H  = 9;
export const LINE_W = 2.5;

export const VB_W = PAD_LEFT + GRID_W + PAD_RIGHT;                         // 320
export const VB_H = PAD_TOP + TITLE_H + MARKER_ROW_H + GRID_H + PAD_BOTTOM; // 370

export const GRID_LEFT = PAD_LEFT;
export const GRID_TOP  = PAD_TOP + TITLE_H + MARKER_ROW_H;                 // 96

/** String 6 sits at GRID_LEFT, string 1 at GRID_LEFT + GRID_W. */
export const stringX  = (s: number) => GRID_LEFT + (STRING_COUNT - s) * CELL_W;
/** f = 0 is the nut/top line, f = FRET_COUNT is the bottom line. */
export const fretLineY = (f: number) => GRID_TOP + f * CELL_H;
/** Vertical centre of the cell for relative fret f (1-based). */
export const dotY      = (f: number) => GRID_TOP + (f - 0.5) * CELL_H;
export const markerY   = GRID_TOP - MARKER_ROW_H / 2;

/**
 * Position label origin. Clearing DOT_R keeps "12fr" off a dot sitting on
 * string 1 — at GRID_LEFT + GRID_W + 12 the two collide by 2px.
 */
export const LABEL_X = GRID_LEFT + GRID_W + DOT_R + 6;

export const MIN_ROOT_FRET = 1;
export const MAX_ROOT_FRET = 17;

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
    top:    pct(GRID_TOP - MARKER_ROW_H, VB_H),
    width:  pct(CELL_W, VB_W),
    height: pct(MARKER_ROW_H, VB_H),
  };
}
