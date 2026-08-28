import type { Barre, ChordSpec, Dot, StringMarker, StringNumber } from '../types/chord';
import { FRET_COUNT, MAX_ROOT_FRET, STRING_COUNT } from './layout';

/**
 * The design's compact chord notation: six characters, low E to high e.
 * `x` = muted, `0` = open, `1`–`9` = fret. G is `320003`, F is `133211`.
 *
 * ChordSpec stays the canonical model — this string cannot express more than one
 * barre, a fret past 9, or a string left unset. The notation is here because it
 * is how the chord library stores its shapes, and it is a tenth of the size.
 *
 * Note the two index conventions in play. A shape string runs low E first, so
 * its index 0 is string 6; ChordSpec numbers strings the guitarist's way, 1 =
 * high E. `stringAt` is the only place that conversion happens.
 */

export const SHAPE_LENGTH = 6;

/** Shape index 0 (low E) is string 6; index 5 (high e) is string 1. */
const stringAt = (index: number): StringNumber => (STRING_COUNT - index) as StringNumber;

interface Fretted {
  index: number;
  fret: number; // absolute
}

export interface ShapeReading {
  fretted: Fretted[];
  opens: number[];
  mutes: number[];
  /** The absolute fret the barre lies at, or null when the shape has none. */
  barreFret: number | null;
  /** Shape indices spanned by the barre, low to high. */
  barreSpan: [number, number] | null;
}

/**
 * Barre detection, ported from the design's ChordDiagram: the lowest fret among
 * the fretted strings carries a barre when at least two strings sit at it AND
 * they span at least four positions.
 *
 * That span rule is load-bearing. Without it A major (`x02220` — three strings
 * at fret 2 spanning 2) draws as a barre, which is wrong; with it F (`133211`,
 * spanning 5) and Bm (`x24432`, spanning 4) still correctly do.
 *
 * ONE DELIBERATE DEVIATION from the ported logic: a barre is also rejected when
 * any string strictly inside the span is open or muted. A finger laid across
 * the neck frets every string it crosses, so an open string within the span
 * disproves the barre. Without this, Bm7 `x20202` and F#m7 `202220` — both of
 * which have genuinely open strings between fretted ones — draw a bar straight
 * over strings the player is letting ring. Neither is a barre chord.
 */
export function readShape(shape: string): ShapeReading {
  const fretted: Fretted[] = [];
  const opens: number[] = [];
  const mutes: number[] = [];

  shape
    .trim()
    .split('')
    .slice(0, SHAPE_LENGTH)
    .forEach((c, index) => {
      if (c === 'x' || c === 'X') mutes.push(index);
      else if (c === '0') opens.push(index);
      else if (/[1-9]/.test(c)) fretted.push({ index, fret: Number(c) });
    });

  let barreFret: number | null = null;
  let barreSpan: [number, number] | null = null;

  if (fretted.length) {
    const min = Math.min(...fretted.map((d) => d.fret));
    const at = fretted.filter((d) => d.fret === min).map((d) => d.index);
    const [first, last] = [at[0], at[at.length - 1]];
    const unfretted = new Set([...opens, ...mutes]);
    const spanIsSolid = () => {
      for (let i = first + 1; i < last; i++) if (unfretted.has(i)) return false;
      return true;
    };
    if (at.length >= 2 && last - first >= 4 && spanIsSolid()) {
      barreFret = min;
      barreSpan = [first, last];
    }
  }

  return { fretted, opens, mutes, barreFret, barreSpan };
}

/**
 * The window of frets the shape needs. Nut-position shapes (everything in the
 * library) start at fret 1 and draw a nut; anything higher slides the window up
 * and the diagram grows a "5fr" label instead.
 */
export function rootFretFor(fretted: Fretted[]): number {
  if (!fretted.length) return 1;
  const frets = fretted.map((d) => d.fret);
  const max = Math.max(...frets);
  if (max <= FRET_COUNT) return 1;
  return Math.min(Math.min(...frets), MAX_ROOT_FRET);
}

export function shapeToSpec(name: string, shape: string): ChordSpec {
  const { fretted, opens, mutes, barreFret, barreSpan } = readShape(shape);
  const rootFret = rootFretFor(fretted);
  const relative = (absolute: number) => absolute - rootFret + 1;

  const markers: StringMarker[] = Array.from(
    { length: STRING_COUNT },
    () => 'none' as StringMarker,
  );
  for (const i of opens) markers[stringAt(i) - 1] = 'open';
  for (const i of mutes) markers[stringAt(i) - 1] = 'muted';

  const barres: Barre[] = [];
  if (barreFret !== null && barreSpan) {
    barres.push({
      fret: relative(barreFret),
      // The lower shape index is the lower-pitched, leftmost string, which is
      // the higher string number — which is what `fromString` means.
      fromString: stringAt(barreSpan[0]),
      toString: stringAt(barreSpan[1]),
    });
  }

  const dots: Dot[] = fretted
    // Strings carried by the barre are excluded from the individual dots.
    .filter((d) => barreFret === null || d.fret !== barreFret)
    .filter((d) => relative(d.fret) >= 1 && relative(d.fret) <= FRET_COUNT)
    .map((d) => ({ string: stringAt(d.index), fret: relative(d.fret) }));

  return { name, rootFret, fretCount: FRET_COUNT, markers, dots, barres };
}

const covers = (b: Barre, s: number) => s <= b.fromString && s >= b.toString;

/**
 * The inverse, for storing a chord compactly. Returns null whenever the spec
 * says something the notation cannot — multiple barres, a fret past 9, or a
 * string left unset — in which case store the full spec instead.
 *
 * A shape up the neck is fine: the notation writes ABSOLUTE frets, so the
 * window the spec happens to be drawn in does not survive the round trip, but
 * the chord does. C# is `x46664` whether its diagram starts at the nut or at
 * the fourth fret.
 */
export function specToShape(spec: ChordSpec): string | null {
  if (spec.barres.length > 1) return null;
  const absolute = (relative: number) => spec.rootFret + relative - 1;

  const chars: string[] = [];
  for (let i = 0; i < SHAPE_LENGTH; i++) {
    const s = stringAt(i);
    const barre = spec.barres.find((b) => covers(b, s));
    const dot = spec.dots.find((d) => d.string === s);
    const relative = dot?.fret ?? (barre ? barre.fret : null);

    if (relative !== null) {
      const fret = absolute(relative);
      if (fret < 1 || fret > 9) return null;
      chars.push(String(fret));
      continue;
    }
    const marker = spec.markers[s - 1] ?? 'none';
    if (marker === 'open') chars.push('0');
    else if (marker === 'muted') chars.push('x');
    else return null; // an unset string has no notation
  }

  return chars.join('');
}
