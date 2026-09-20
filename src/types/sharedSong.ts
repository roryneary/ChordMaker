import type { ChordSpec } from './chord';
import type { Song } from './song';

/**
 * What of a song travels when it is shared: the music, and nothing that says
 * whose library it sat in. No `id` — the recipient's copy gets its own. No
 * `shared` or `copiedFrom` — those describe one person's copy, not the song.
 * Chord and word ids do travel: they only have to be unique within a song.
 */
export type SharePayload = Pick<
  Song,
  'title' | 'key' | 'feel' | 'capo' | 'chords' | 'lyric' | 'words' | 'placements'
>;

/**
 * A shared song, at `shared/{id}`: a copy the owner put where others can reach
 * it. Anyone holding the id can read it — the link is the key, which is why the
 * id has to be unguessable — and nobody can list the collection.
 */
export interface SharedSong {
  id: string;
  ownerUid: string;
  /** The owner's claimed handle, lowercased. The rules check it is really theirs. */
  handle: string;
  display: string;
  /** The owner's own song this was copied from. Lineage only; nobody else can read it. */
  songId: string;
  /** Goes up by one each time the owner shares their changes. */
  version: number;
  song: SharePayload;
  publishedAt: number;
  updatedAt: number;
}

/**
 * The shared library's card for a song, at `sharedIndex/{id}` — same id as the
 * shared song it stands for, and there only while the owner has it listed. A
 * song is mostly its word list (tens of kB); browsing reads these instead, and
 * fetches the song itself when one is opened.
 */
export interface SharedCard {
  id: string;
  ownerUid: string;
  handle: string;
  display: string;
  title: string;
  /** For the prefix search; Firestore has no case-insensitive match. */
  titleLower: string;
  chordCount: number;
  /** Enough shapes to draw the row. */
  firstChords: ChordSpec[];
  updatedAt: number;
}
