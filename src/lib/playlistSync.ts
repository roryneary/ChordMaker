import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import type { Playlist } from '../types/playlist';
import { getFirebaseDb } from './firebase';
import { parsePlaylist } from './playlists';

/**
 * The remote half of a playlist: one document at
 * `users/{uid}/playlists/{playlistId}`, items and all. `firestore.rules`
 * already covers it — the owner's rule matches everything under their uid.
 *
 * StreetPerformer kept items in a subcollection, one document each with a
 * `position`. A reorder there rewrote every item, and finding which playlists
 * a song was in cost a query per playlist per song. Here the items are an
 * array inside the playlist, so a reorder is one write and membership is a
 * loop over what is already in memory.
 *
 * The contract is `songSync.ts`'s: every function rejects on failure and none
 * catches, because `useSongs` is the only caller and deciding what a failure
 * means is its job.
 */

const playlistsRef = (uid: string) => collection(getFirebaseDb(), 'users', uid, 'playlists');

export async function writePlaylist(uid: string, playlist: Playlist): Promise<void> {
  await setDoc(doc(playlistsRef(uid), playlist.id), playlist);
}

export async function deleteRemotePlaylist(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(playlistsRef(uid), id));
}

export async function fetchRemotePlaylists(uid: string): Promise<Playlist[]> {
  const snap = await getDocs(playlistsRef(uid));
  const playlists: Playlist[] = [];
  for (const d of snap.docs) {
    const playlist = parsePlaylist({ ...d.data(), id: d.id });
    if (playlist) playlists.push(playlist);
  }
  return playlists;
}
