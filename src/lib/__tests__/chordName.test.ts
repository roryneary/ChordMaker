import { describe, expect, it } from 'vitest';
import { inferChordName } from '../chordName';
import { LIBRARY, libraryChordToSpec } from '../../data/chordLibrary';
import { emptySpec } from '../../hooks/useChordSpec';
import { shapeToSpec } from '../shape';

describe('inferChordName', () => {
  it('recognises every shape in the library', () => {
    for (const chord of LIBRARY) {
      expect(inferChordName(libraryChordToSpec(chord))).toBe(chord.name);
    }
  });

  it('says nothing rather than guessing at an unknown shape', () => {
    expect(inferChordName(emptySpec())).toBeNull();
    // A real shape, but not one the library knows.
    expect(inferChordName(shapeToSpec('?', '133215'))).toBeNull();
  });
});
