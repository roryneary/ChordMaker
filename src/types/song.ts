import type { ChordSpec } from './chord';

export interface SavedChord {
  id: string;
  spec: ChordSpec;
}

/** One song at a time: the chords the user has built for it, in order. */
export interface Song {
  title: string;
  chords: SavedChord[];
}
