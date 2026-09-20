import { type DocumentData, collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import type { MyChord } from '../types/myChord';
import { getFirebaseDb } from './firebase';
import { withoutUndefined } from './firestoreData';
import { parseMyChord } from './storage';

/**
 * The remote half of My chords: one document per kept chord at
 * `users/{uid}/chords/{chordId}`, which `firestore.rules` checks field by
 * field (`validChord`).
 *
 * That path had a tenant before. The retired loose-chord store wrote bare
 * `{ id, spec }` documents to it, and they may still be there; their shapes
 * were folded into a "Loose chords" song long ago. `parseMyChord` will not
 * read a document without its two stamps, so they are skipped here rather than
 * coming back as duplicates. They are deliberately NOT cleared on the way
 * past: "delete what I cannot read" is a rule an older build of this app would
 * apply to a newer build's chords.
 *
 * The contract is `songSync.ts`'s: every function rejects on failure and none
 * catches, because `useSongs` is the only caller and deciding what a failure
 * means is its job.
 */

const chordsRef = (uid: string) => collection(getFirebaseDb(), 'users', uid, 'chords');

/* `Dot.finger` is optional, and Firestore refuses an `undefined` outright. */
const toDoc = (chord: MyChord): DocumentData => withoutUndefined(chord);

export async function writeMyChord(uid: string, chord: MyChord): Promise<void> {
  await setDoc(doc(chordsRef(uid), chord.id), toDoc(chord));
}

export async function deleteRemoteMyChord(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(chordsRef(uid), id));
}

export async function fetchRemoteMyChords(uid: string): Promise<MyChord[]> {
  const snap = await getDocs(chordsRef(uid));
  const chords: MyChord[] = [];
  for (const d of snap.docs) {
    const chord = parseMyChord({ ...d.data(), id: d.id });
    if (chord) chords.push(chord);
  }
  return chords;
}
