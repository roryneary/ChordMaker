import {
  type DocumentData,
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import type { Song } from '../types/song';
import { getFirebaseDb } from './firebase';
import { withoutUndefined } from './firestoreData';
import { parseSong } from './storage';

/**
 * The remote half of a song's life, once an account exists. One document per
 * song at `users/{uid}/songs/{songId}` — ROADMAP.md §2's shape, chosen because
 * chords and placements are always read and written with the song, so a
 * subcollection would buy nothing but partial-write risk.
 *
 * `localStorage` stays the source of truth for the open session. The reducer
 * in `useSongs` never talks to a server; it only lists the ids it has changed
 * (`SongStore.unsynced`), and the hook sends those through the calls below and
 * strikes them off when the account confirms. This module is the seam.
 *
 * Every function here rejects on failure and none of them catches: deciding
 * what a failure means — show it, retry it, keep the id on the list — is the
 * caller's job, and `useSongs` is the only caller.
 *
 * The merge rule itself (`mergeOnSignIn`) and the cross-account guard live in
 * `accountSync.ts`, which does not care which kind of record it is moving.
 */

const songsRef = (uid: string) => collection(getFirebaseDb(), 'users', uid, 'songs');

/**
 * Firestore rejects `undefined` field values outright, and `capo` is
 * `undefined` on purpose — "nobody has answered yet" (`types/song.ts`). Drop
 * the key rather than writing `null`, which already means something else:
 * an explicit "no capo". Getting this wrong would silently answer the
 * question for every song synced before its player chose.
 *
 * `withoutUndefined` goes all the way down, because `capo` is no longer the
 * only one: `shared` and `copiedFrom` are optional too, and
 * `copiedFrom.display` is optional inside that.
 */
const toDoc = (song: Song): DocumentData => withoutUndefined(song);

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
