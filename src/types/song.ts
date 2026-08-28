import type { ChordSpec } from './chord';

export interface SavedChord {
  id: string;
  spec: ChordSpec;
}

/** One word of the lyric. The id is what a chord placement points at. */
export interface Word {
  id: string;
  /** Index into the lyric's lines, so blank lines still render as gaps. */
  line: number;
  text: string;
}

/** wordId → SavedChord.id */
export type Placements = Record<string, string>;

export interface Song {
  id: string;
  title: string;
  /** Displayed as "Key of G". Free text — the design shows a letter, not an enum. */
  key: string;
  /** Displayed as "steady". A word, deliberately, not a BPM number. */
  feel: string;
  /** Fret number; null reads as "No capo". */
  capo: number | null;
  /**
   * The chords, in the order they are played. A FLAT list: verse/chorus
   * sections were removed in design review because they split one chord list in
   * two and duplicated chords across them. Re-adding them is a regression.
   */
  chords: SavedChord[];
  /** The raw pasted text, line breaks preserved verbatim. */
  lyric: string;
  /** Derived from `lyric`, but ids are stable across edits — see lib/lyric.ts. */
  words: Word[];
  placements: Placements;
  createdAt: number;
  updatedAt: number;
}
