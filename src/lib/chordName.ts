import type { ChordSpec } from '../types/chord';
import { LIBRARY } from '../data/chordLibrary';
import { specToShape } from './shape';

/**
 * Name a shape by recognising it, not by deriving it.
 *
 * Real chord spelling — working out that x02210 is "Am" from intervals — needs
 * a note-name model the app does not have, and would still guess wrong on
 * inversions and omitted fifths. Matching against the library gets the shapes
 * people actually play, and says nothing when it does not know. The name stays
 * user-editable either way, so a miss costs a typed word, not a wrong label.
 */
export function inferChordName(spec: ChordSpec): string | null {
  const shape = specToShape(spec);
  if (!shape) return null;
  return LIBRARY.find((c) => c.shape === shape)?.name ?? null;
}
