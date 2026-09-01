/**
 * Two ways of writing a number for a reader, both needed in more than one place.
 *
 * These live in `lib` rather than beside the components that use them because
 * `renderChordSVG` needs the roman numeral, and the export path must not pull
 * React in behind it.
 */

const ROMAN: ReadonlyArray<readonly [number, string]> = [
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

/**
 * Chord charts name a fret position with a roman numeral. Only ever asked for
 * 1..MAX_ROOT_FRET, but the loop is general so it cannot quietly go wrong if
 * the neck ever gets longer.
 */
export function toRoman(n: number): string {
  let left = Math.max(0, Math.round(n));
  let out = '';
  for (const [value, glyph] of ROMAN) {
    while (left >= value) {
      out += glyph;
      left -= value;
    }
  }
  return out;
}

/** "1st", "2nd", "13th" — the spoken form, for labels a screen reader reads out. */
export function ordinal(n: number): string {
  const suffix = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (suffix[(v - 20) % 10] ?? suffix[v] ?? suffix[0]);
}
