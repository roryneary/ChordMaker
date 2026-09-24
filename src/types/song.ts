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

/**
 * On the owner's song: it has been shared, and this is where. The shared copy
 * is a separate document (`shared/{shareId}`, see types/sharedSong.ts) — nobody
 * is ever let into the owner's own songs, so sharing copies out instead.
 */
export interface SharedRef {
  shareId: string;
  /** Counts each time the owner shares their changes. Never shown: the UI says
      "changed", not "version 3". */
  version: number;
  /**
   * The song's `updatedAt` as of the last time it was shared, so "you've
   * changed this since you shared it" is `updatedAt > at`. The reducer sets it
   * (`SONG_SHARED`), because recording the share is itself an edit and must not
   * read as a change.
   */
  at: number;
  /** Whether it also shows in the browsable library, or travels by link only. */
  listed: boolean;
}

/**
 * On a recipient's song: whose it was. The song is theirs outright — this is
 * lineage, and the address to ask whether the sender has changed theirs since.
 *
 * It names the sender by `uid`, and carries the handle only to draw "from
 * @rory" without a lookup: people rename, and a lineage keyed on the name would
 * be orphaned by it (ROADMAP.md §3). Never an email — this travels with the
 * song for good.
 */
export interface CopiedFrom {
  shareId: string;
  /** The shared copy's version this song was taken at, or last caught up to. */
  version: number;
  uid: string;
  handle: string;
  /** The handle as its owner typed it. Absent falls back to `handle`. */
  display?: string;
  /** `false` once the player chose "keep mine": they have gone their own way,
      and are not asked about the sender's changes again. Absent means it follows. */
  follows?: false;
}

export interface Song {
  id: string;
  title: string;
  /**
   * Who plays it — "Bob Dylan". Optional, the `capo` precedent: absent means
   * nobody has said, and every song saved before the field existed reads
   * correctly without it, so there is no migration. Blank is never stored — the
   * reducer drops the key when the field is cleared — so absent is the single
   * way of not knowing.
   *
   * Deliberately the performer and not the writer: it is what a song gets
   * reached for by ("that Dylan one"), and the one line under a title in a list
   * has room for one name. A `writer` can follow this same shape if it is
   * missed (ROADMAP.md §0.5).
   */
  artist?: string;
  /** Displayed as "Key of G". Free text — the design shows a letter, not an enum. */
  key: string;
  /** Displayed as "steady". A word, deliberately, not a BPM number. */
  feel: string;
  /**
   * Fret number. `null` is an explicit "no capo"; **absent** means nobody has
   * chosen yet, and the two are deliberately different. Defaulting an unasked
   * song to "No capo" answers the question on the player's behalf, and a capo
   * transposes every chord on the sheet — so the song screen asks for it before
   * the song can be called finished. Songs saved before this existed carry
   * `capo: null` and read as already decided.
   */
  capo?: number | null;
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
  /** Both optional, the `capo` precedent: absent is a meaningful state — never
      shared, made here — and every song already saved reads correctly without them. */
  shared?: SharedRef;
  copiedFrom?: CopiedFrom;
  createdAt: number;
  updatedAt: number;
}
