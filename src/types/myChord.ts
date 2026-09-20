import type { ChordSpec } from './chord';

/**
 * One of "My chords": a shape the player made and chose to keep, outside any
 * song. It is the song's `SavedChord` plus the two stamps the account sync
 * needs — a song's chord borrows its song's.
 *
 * Nothing points at one of these. Using it in a song copies the `spec` into
 * that song, exactly as picking a built-in shape does, and the song's copy
 * records no origin: editing or deleting this never reaches into a song. That
 * is what keeps a song one self-contained document (README, "My chords").
 *
 * `firestore.rules` names these fields, and `spec`'s. Add one here and not
 * there, and every save of every chord is refused.
 */
export interface MyChord {
  id: string;
  spec: ChordSpec;
  createdAt: number;
  updatedAt: number;
}
