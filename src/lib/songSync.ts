import {
  type DocumentData,
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import type { Song } from '../types/song';
import { getFirebaseDb } from './firebase';
import { parseSong } from './storage';

/**
 * The remote half of a song's life, once an account exists. One document per
 * song at `users/{uid}/songs/{songId}` — ROADMAP.md §2's shape, chosen because
 * chords and placements are always read and written with the song, so a
 * subcollection would buy nothing but partial-write risk.
 *
 * `localStorage` stays the source of truth for the open session — the reducer
 * in `useSongs` neither knows nor cares that a server exists (see
 * `editSong`'s reference-preserving updates, which is what lets the push side
 * below diff cheaply). This module is the seam: it reads what changed and
 * mirrors it, in both directions, around sign-in.
 *
 * The merge rule itself (`mergeOnSignIn`) and the cross-account guard live in
 * `accountSync.ts` — `chordSync.ts` needs the identical rule for the loose
 * chord library, and neither cares which kind of record it is moving.
 */

const songsRef = (uid: string) => collection(getFirebaseDb(), 'users', uid, 'songs');

/**
 * Firestore rejects `undefined` field values outright, and `capo` is
 * `undefined` on purpose — "nobody has answered yet" (`types/song.ts`). Drop
 * the key rather than writing `null`, which already means something else:
 * an explicit "no capo". Getting this wrong would silently answer the
 * question for every song synced before its player chose.
 */
function toDoc(song: Song): DocumentData {
  const { capo, ...rest } = song;
  return capo === undefined ? rest : { ...rest, capo };
}

export async function writeSong(uid: string, song: Song): Promise<void> {
  await setDoc(doc(songsRef(uid), song.id), toDoc(song));
}

export async function deleteRemoteSong(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(songsRef(uid), id));
}

export async function fetchRemoteSongs(uid: string): Promise<Song[]> {
  const snap = await getDocs(songsRef(uid));
  const songs: Song[] = [];
  for (const d of snap.docs) {
    // The doc id is the song id, but parseSong reads it from the stored
    // fields — the two must agree, so pass the doc's own id in defensively.
    const song = parseSong({ ...d.data(), id: d.id });
    if (song) songs.push(song);
  }
  return songs;
}

/** One batch, so an interrupted migration cannot leave half a library synced. */
export async function pushSongs(uid: string, songs: Song[]): Promise<void> {
  if (!songs.length) return;
  const batch = writeBatch(getFirebaseDb());
  for (const song of songs) batch.set(doc(songsRef(uid), song.id), toDoc(song));
  await batch.commit();
}
