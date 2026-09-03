import { collection, deleteDoc, doc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import type { SavedChord } from '../types/song';
import { getFirebaseDb } from './firebase';
import { parseSavedChord } from './storage';

/**
 * The remote half of the "one chord" library — shapes built with no song
 * open, kept at `USER_CHORDS_KEY` locally and the sidebar's Gig bag names.
 * Mirrors `songSync.ts` exactly, one document per chord at
 * `users/{uid}/chords/{chordId}`: same reasoning as songs, and every field on
 * a `SavedChord` is always defined, so there is no `capo`-shaped hole to guard
 * on the way in.
 */

const chordsRef = (uid: string) => collection(getFirebaseDb(), 'users', uid, 'chords');

export async function writeUserChord(uid: string, chord: SavedChord): Promise<void> {
  await setDoc(doc(chordsRef(uid), chord.id), chord);
}

export async function deleteRemoteUserChord(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(chordsRef(uid), id));
}

export async function fetchRemoteUserChords(uid: string): Promise<SavedChord[]> {
  const snap = await getDocs(chordsRef(uid));
  const chords: SavedChord[] = [];
  for (const d of snap.docs) {
    const chord = parseSavedChord({ ...d.data(), id: d.id });
    if (chord) chords.push(chord);
  }
  return chords;
}

/** One batch, so an interrupted migration cannot leave half the library synced. */
export async function pushUserChords(uid: string, chords: SavedChord[]): Promise<void> {
  if (!chords.length) return;
  const batch = writeBatch(getFirebaseDb());
  for (const chord of chords) batch.set(doc(chordsRef(uid), chord.id), chord);
  await batch.commit();
}
