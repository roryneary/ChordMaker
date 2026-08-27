/**
 * String numbering follows guitar convention:
 *   1 = high E, 6 = low E.
 * On screen, string 6 is LEFTMOST and string 1 is RIGHTMOST.
 * All left-to-right conversion happens in layout.ts and nowhere else.
 */
export type StringNumber = 1 | 2 | 3 | 4 | 5 | 6;

export type StringMarker = 'none' | 'open' | 'muted';

export interface Dot {
  string: StringNumber;
  /** 1..FRET_COUNT, relative to the displayed window — NOT an absolute fret. */
  fret: number;
  /** Reserved for v2 finger numbers; nothing reads it yet. */
  finger?: 1 | 2 | 3 | 4;
}

export interface Barre {
  fret: number;              // relative, same as Dot.fret
  fromString: StringNumber;  // always the higher number (lower pitch, leftmost)
  toString: StringNumber;    // always the lower number (higher pitch, rightmost)
}

export interface ChordSpec {
  name: string;
  /** Absolute fret number of the top row of the grid. 1..17. */
  rootFret: number;
  fretCount: number;         // fixed at 5 in v1
  /** Index 0 = string 1 (high E) … index 5 = string 6 (low E). */
  markers: StringMarker[];
  dots: Dot[];
  barres: Barre[];
}
