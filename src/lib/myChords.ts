import { LIBRARY, libraryChordToSpec } from '../data/chordLibrary';
import { newId } from './id';
import type { ChordSpec } from '../types/chord';
import type { MyChord } from '../types/myChord';

/**
 * "My chords": the rules for the shapes a player keeps outside any song.
 *
 * The one that matters is sameness. A library is one entry per *shape* — not
 * per name, since two voicings of G are both "G" and both worth keeping, and
 * not per id, since the same shape kept on a phone and on a laptop has two.
 */

/** `firestore.rules` holds the same number (`validChord`): past it, a save is refused for good. */
export const MAX_CHORD_NAME = 100;

/** A name as it is kept: trimmed, and no longer than the account will take. */
export const cleanChordName = (name: string): string => name.trim().slice(0, MAX_CHORD_NAME);

const STRINGS = [6, 5, 4, 3, 2, 1] as const;

/**
 * What a shape *is*, as a string: for each string from low E to high e, the
 * fret it is stopped at, or `0` open, `x` muted, `-` unset.
 *
 * Frets are absolute, so the same chord is the same key wherever its diagram's
 * window sits. A barre and the same strings fretted one by one are the same
 * key, because they are the same sound. And it has an answer for every spec.
 *
 * That last is why this is not `specToShape`, which it otherwise agrees with
 * (a dot wins over a barre on its string, as there): that one is null for two
 * barres or a fret past nine. B drawn with two barres would have fallen
 * through to some second scheme, B drawn with dots would not, and the two
 * would have been different chords — one of them not recognised as built in.
 */
export function shapeKey(spec: ChordSpec): string {
  const absolute = (relative: number) => spec.rootFret + relative - 1;
  return STRINGS.map((s) => {
    const dot = spec.dots.find((d) => d.string === s);
    if (dot) return String(absolute(dot.fret));
    const barres = spec.barres.filter((b) => s <= b.fromString && s >= b.toString);
    if (barres.length) return String(absolute(Math.max(...barres.map((b) => b.fret))));
    const marker = spec.markers[s - 1] ?? 'none';
    return marker === 'open' ? '0' : marker === 'muted' ? 'x' : '-';
  }).join('.');
}

const BUILT_IN_KEYS = new Set(LIBRARY.map((c) => shapeKey(libraryChordToSpec(c))));

/** One of the shapes the app ships with, whatever it has been named. */
export const isBuiltIn = (spec: ChordSpec): boolean => BUILT_IN_KEYS.has(shapeKey(spec));

/** The editor's own test for "nothing drawn yet": markers alone are not a chord. */
const hasShape = (spec: ChordSpec) => spec.dots.length > 0 || spec.barres.length > 0;

/** The kept chord with this shape, if there is one. `exceptId` is the one being edited. */
export function findMine(
  chords: readonly MyChord[],
  spec: ChordSpec,
  exceptId?: string,
): MyChord | null {
  const key = shapeKey(spec);
  return chords.find((c) => c.id !== exceptId && shapeKey(c.spec) === key) ?? null;
}

/**
 * Whether this shape can be kept, and if not, why — the reason is what the
 * screen says instead of offering.
 *
 * - `empty`: nothing drawn.
 * - `builtIn`: it is one of the shapes the app ships with, which are already
 *   in the library and are not listed again as yours.
 * - `mine`: it is already kept.
 * - `offer`: it can be.
 */
export type KeepOffer = 'offer' | 'builtIn' | 'mine' | 'empty';

export function keepOffer(
  chords: readonly MyChord[],
  spec: ChordSpec,
  exceptId?: string,
): KeepOffer {
  if (!hasShape(spec)) return 'empty';
  if (isBuiltIn(spec)) return 'builtIn';
  return findMine(chords, spec, exceptId) ? 'mine' : 'offer';
}

export function newMyChord(spec: ChordSpec, id: string = newId()): MyChord {
  const now = Date.now();
  return { id, spec: { ...spec, name: cleanChordName(spec.name) }, createdAt: now, updatedAt: now };
}

/**
 * One entry per shape, out of a list that may hold a shape twice — which a
 * sign-in can produce, because accounts merge by id and the same shape kept on
 * two devices has two.
 *
 * The older one is kept, then the lower id: a rule with no tie in it, so two
 * devices looking at the same pair drop the same one and end up agreeing.
 * `dropped` is for the caller to delete from the account.
 */
export function collapseByShape(chords: readonly MyChord[]): {
  kept: MyChord[];
  dropped: string[];
} {
  const winners = new Map<string, MyChord>();
  for (const chord of chords) {
    const key = shapeKey(chord.spec);
    const held = winners.get(key);
    const older =
      !held ||
      chord.createdAt < held.createdAt ||
      (chord.createdAt === held.createdAt && chord.id < held.id);
    if (older) winners.set(key, chord);
  }
  const keep = new Set([...winners.values()].map((c) => c.id));
  return {
    kept: chords.filter((c) => keep.has(c.id)),
    dropped: chords.filter((c) => !keep.has(c.id)).map((c) => c.id),
  };
}

/* The library spells its accidentals ♭ and ♯, and nobody types those. */
const fold = (s: string) => s.replace(/♭/g, 'b').replace(/♯/g, '#').toLowerCase();

/** Whether a chord's name answers a search — so "bb" finds B♭. */
export const matchesChordQuery = (name: string, query: string): boolean => {
  const q = fold(query.trim());
  return !q || fold(name).includes(q);
};
