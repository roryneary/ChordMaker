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

/**
 * How a diagram is turned for the player looking at it (lib/prefs.ts). A chord
 * is stored one way for everybody; this is only how it is drawn.
 *
 * Everything above is the canonical diagram — upright, right-handed, string 6
 * leftmost — and every drawn point goes through `place` on its way out. That
 * keeps one set of numbers, and one set of tests on them, instead of four.
 *
 * - Left-handed, upright: mirrored across the strings, so string 6 is on the
 *   right, the way a left-hander sees their own neck. The numeral column stays
 *   on the right: 90 + DOT_R still clears it.
 * - Sideways: the neck runs across, like tab — nut on the left, string 1 (the
 *   thinnest) on top, frets running right. The box stays 122 × 122, so nothing
 *   that sizes a diagram by its width has to know.
 * - Left-handed, sideways: the same, with the nut on the right.
 */
export interface Orient {
  leftHanded: boolean;
  sideways: boolean;
}

export const UPRIGHT: Orient = { leftHanded: false, sideways: false };

/** Mirror line for a left-handed upright diagram: the middle of the strings. */
const MIRROR_X = GRID_LEFT * 2 + GRID_W;             // 100 → x' = 100 − x
/** Sideways, string 1 goes on top: canonical x 90 → y' 10. */
const SIDEWAYS_Y = GRID_LEFT * 2 + GRID_W;           // 100 → y' = 100 − x

/** Where a canonical point lands in the box, for this orientation. */
export function place(x: number, y: number, o: Orient = UPRIGHT): [number, number] {
  if (!o.sideways) return [o.leftHanded ? MIRROR_X - x : x, y];
  return [o.leftHanded ? VB_W - y : y, SIDEWAYS_Y - x];
}

/** `place` for a rectangle: both corners, then put back in order. */
export function placeRect(
  x: number,
  y: number,
  w: number,
  h: number,
  o: Orient = UPRIGHT,
): { x: number; y: number; w: number; h: number } {
  const [ax, ay] = place(x, y, o);
  const [bx, by] = place(x + w, y + h, o);
  return { x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay) };
}

/**
 * Where the position numeral goes. Text is placed, never transformed — a
 * mirrored or turned "VII" would be unreadable. Upright it is in the column to
 * the right of string 1 on the first fret's centre line (see LABEL_X);
 * sideways it sits under the neck, centred on the first fret's column.
 */
export function labelAt(o: Orient = UPRIGHT): { x: number; y: number; anchor: 'start' | 'middle' } {
  if (!o.sideways) return { x: LABEL_X, y: dotY(1), anchor: 'start' };
  const [x] = place(0, dotY(1), o);
  return { x, y: SIDEWAYS_LABEL_Y, anchor: 'middle' };
}

/** Sideways, under string 6 (y' 90) and its dots (+ DOT_R), inside the box. */
export const SIDEWAYS_LABEL_Y = 108;

/** The middle of the fretboard across the box: what a name is centred over. */
export function gridCentreX(o: Orient = UPRIGHT): number {
  if (!o.sideways) return GRID_LEFT + GRID_W / 2;
  return place(0, GRID_TOP + GRID_H / 2, o)[0];
}

export interface RectPct {
  left: number;
  top: number;
  width: number;
  height: number;
}

const pct = (px: number, of: number) => (px / of) * 100;

const rectPct = (r: { x: number; y: number; w: number; h: number }): RectPct => ({
  left: pct(r.x, VB_W),
  top: pct(r.y, VB_H),
  width: pct(r.w, VB_W),
  height: pct(r.h, VB_H),
});

/** Hit rect for the cell of string `s` at relative fret `f` (1-based). */
export function cellRectPct(s: number, f: number, o: Orient = UPRIGHT): RectPct {
  return rectPct(placeRect(stringX(s) - CELL_W / 2, fretLineY(f - 1), CELL_W, CELL_H, o));
}

/** Hit rect for the x/o marker slot above string `s` — beside the nut, sideways. */
export function markerRectPct(s: number, o: Orient = UPRIGHT): RectPct {
  return rectPct(placeRect(stringX(s) - CELL_W / 2, 0, CELL_W, MARKER_ROW_H, o));
}
