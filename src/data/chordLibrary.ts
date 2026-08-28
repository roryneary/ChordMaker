import type { ChordSpec } from '../types/chord';
import { shapeToSpec } from '../lib/shape';

/**
 * The built-in chord library.
 *
 * It lives here, in the bundle, rather than behind a fetch: forty-eight shapes
 * at roughly thirty bytes each is about 1.5 kB, smaller than the favicon. That
 * buys no schema, no sync, no server, and — the point of "Keep it in the gig
 * bag" — it works with no signal.
 *
 * Every count shown in the UI reads LIBRARY.length, so the number on screen can
 * never drift from what is actually here.
 *
 * Shapes run low E to high e: `x` muted, `0` open, `1`–`9` fret.
 */

export interface LibraryChord {
  name: string;
  shape: string;
  group: ChordGroup;
}

export type ChordGroup = 'major' | 'minor' | 'seventh' | 'minor7' | 'major7' | 'sus';

/** Section order for the browse screen. */
export const GROUP_LABELS: Record<ChordGroup, string> = {
  major: 'Major',
  minor: 'Minor',
  seventh: 'Seventh',
  minor7: 'Minor seventh',
  major7: 'Major seventh',
  sus: 'Sus and add',
};

export const LIBRARY: LibraryChord[] = [
  // Major — the twelve.
  { name: 'A', shape: 'x02220', group: 'major' },
  { name: 'B♭', shape: 'x13331', group: 'major' },
  { name: 'B', shape: 'x24442', group: 'major' },
  { name: 'C', shape: 'x32010', group: 'major' },
  { name: 'C♯', shape: 'x46664', group: 'major' },
  { name: 'D', shape: 'xx0232', group: 'major' },
  { name: 'E♭', shape: 'xx1343', group: 'major' },
  { name: 'E', shape: '022100', group: 'major' },
  { name: 'F', shape: '133211', group: 'major' },
  { name: 'F♯', shape: '244322', group: 'major' },
  { name: 'G', shape: '320003', group: 'major' },
  { name: 'A♭', shape: '466544', group: 'major' },

  // Minor — the ten a guitarist actually reaches for.
  { name: 'Am', shape: 'x02210', group: 'minor' },
  { name: 'B♭m', shape: 'x13321', group: 'minor' },
  { name: 'Bm', shape: 'x24432', group: 'minor' },
  { name: 'Cm', shape: 'x35543', group: 'minor' },
  { name: 'C♯m', shape: 'x46654', group: 'minor' },
  { name: 'Dm', shape: 'xx0231', group: 'minor' },
  { name: 'Em', shape: '022000', group: 'minor' },
  { name: 'Fm', shape: '133111', group: 'minor' },
  { name: 'F♯m', shape: '244222', group: 'minor' },
  { name: 'Gm', shape: '355333', group: 'minor' },

  // Dominant sevenths — the turnarounds.
  { name: 'A7', shape: 'x02020', group: 'seventh' },
  { name: 'B7', shape: 'x21202', group: 'seventh' },
  { name: 'C7', shape: 'x32310', group: 'seventh' },
  { name: 'D7', shape: 'xx0212', group: 'seventh' },
  { name: 'E7', shape: '020100', group: 'seventh' },
  { name: 'F7', shape: '131211', group: 'seventh' },
  { name: 'G7', shape: '320001', group: 'seventh' },

  { name: 'Am7', shape: 'x02010', group: 'minor7' },
  { name: 'Bm7', shape: 'x20202', group: 'minor7' },
  { name: 'Dm7', shape: 'xx0211', group: 'minor7' },
  { name: 'Em7', shape: '020000', group: 'minor7' },
  { name: 'F♯m7', shape: '202220', group: 'minor7' },
  { name: 'Gm7', shape: '353333', group: 'minor7' },

  { name: 'Amaj7', shape: 'x02120', group: 'major7' },
  { name: 'Cmaj7', shape: 'x32000', group: 'major7' },
  { name: 'Dmaj7', shape: 'xx0222', group: 'major7' },
  { name: 'Emaj7', shape: '021100', group: 'major7' },
  { name: 'Fmaj7', shape: 'xx3210', group: 'major7' },
  { name: 'Gmaj7', shape: '320002', group: 'major7' },

  { name: 'Asus2', shape: 'x02200', group: 'sus' },
  { name: 'Asus4', shape: 'x02230', group: 'sus' },
  { name: 'Dsus2', shape: 'xx0230', group: 'sus' },
  { name: 'Dsus4', shape: 'xx0233', group: 'sus' },
  { name: 'Esus4', shape: '022200', group: 'sus' },
  { name: 'Cadd9', shape: 'x32030', group: 'sus' },
  { name: 'Gsus4', shape: '330013', group: 'sus' },
];

/**
 * The four the chord editor offers up front — "these four get you through most
 * nights" — plus the two that finish the set of chips.
 */
export const COMMON_NAMES = ['G', 'C', 'D', 'Am', 'Em', 'F'] as const;

export const findLibraryChord = (name: string): LibraryChord | undefined =>
  LIBRARY.find((c) => c.name === name);

export const libraryChordToSpec = (chord: LibraryChord): ChordSpec =>
  shapeToSpec(chord.name, chord.shape);
