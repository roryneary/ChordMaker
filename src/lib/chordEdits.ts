import type { ChordSpec } from '../types/chord';

const dotKey = (d: ChordSpec['dots'][number]) => `${d.string}:${d.fret}`;
const barreKey = (b: ChordSpec['barres'][number]) => `${b.fret}:${b.fromString}:${b.toString}`;

const sameSet = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  const seen = new Set(a);
  return b.every((k) => seen.has(k));
};

/**
 * Whether leaving the editor now would lose anything. Compared by what the
 * chord *is*, not by what was tapped: a dot put down and taken off again is no
 * edit, and dots or barres stored in a different order are the same shape.
 * Names are compared trimmed, because that is how they are saved.
 */
export function chordChanged(current: ChordSpec, saved: ChordSpec): boolean {
  return (
    current.name.trim() !== saved.name.trim() ||
    current.rootFret !== saved.rootFret ||
    current.markers.join() !== saved.markers.join() ||
    !sameSet(current.dots.map(dotKey), saved.dots.map(dotKey)) ||
    !sameSet(current.barres.map(barreKey), saved.barres.map(barreKey))
  );
}
