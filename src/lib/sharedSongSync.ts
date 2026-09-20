import {
  collection,
  doc,
  endAt,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  startAfter,
  startAt,
  writeBatch,
} from 'firebase/firestore';
import type { SharedRef, Song } from '../types/song';
import type { SharedCard, SharedSong } from '../types/sharedSong';
import { getFirebaseDb } from './firebase';
import { withoutUndefined } from './firestoreData';
import { parseSharedCard, parseSharedSong, toSharePayload, toSharedCard } from './sharedSong';

/**
 * The remote half of sharing. Two collections, always written together:
 * `shared/{id}` is the song, which anyone holding the id can read and nobody
 * can list; `sharedIndex/{id}` is its card in the browsable library, there
 * only while the owner has it listed. Same id, one batch or transaction, so a
 * card cannot outlive its song or describe a different version of it.
 *
 * Unlike `songSync.ts`, none of this goes through the unconfirmed list.
 * Sharing is something a player asks for and waits on, like an export: it
 * needs a signal, it succeeds or it says why. What rides the ordinary sync is
 * only the *result* — `Song.shared`, on the owner's own song.
 *
 * Every function rejects on failure and none of them catches, as in
 * `songSync.ts`: what a failure means is the caller's to decide.
 */

const sharedDoc = (id: string) => doc(getFirebaseDb(), 'shared', id);
const cardDoc = (id: string) => doc(getFirebaseDb(), 'sharedIndex', id);

/** Who is sharing. The rules check the handle is really theirs. */
export interface Sharer {
  uid: string;
  handle: string;
  display: string;
}

/** The owner stopped sharing it — from another device, since this one thought otherwise. */
export class ShareGoneError extends Error {
  constructor() {
    super('That song is no longer shared.');
    this.name = 'ShareGoneError';
  }
}

/** The document id is the id; it is not stored a second time inside. */
function body<T extends { id: string }>(record: T): Omit<T, 'id'> {
  const rest: Partial<T> = { ...record };
  delete rest.id;
  return withoutUndefined(rest) as Omit<T, 'id'>;
}

/** Shares a song for the first time. `shareId` comes from `newShareId`. */
export async function publishSong(
  sharer: Sharer,
  song: Song,
  shareId: string,
  listed: boolean,
): Promise<SharedSong> {
  const now = Date.now();
  const shared: SharedSong = {
    id: shareId,
    ownerUid: sharer.uid,
    handle: sharer.handle,
    display: sharer.display,
    songId: song.id,
    version: 1,
    song: toSharePayload(song),
    publishedAt: now,
    updatedAt: now,
  };

  const batch = writeBatch(getFirebaseDb());
  batch.set(sharedDoc(shareId), body(shared));
  if (listed) batch.set(cardDoc(shareId), body(toSharedCard(shared)));
  await batch.commit();
  return shared;
}

/**
 * "Share the changes". In a transaction because the version has to step
 * forward by exactly one from whatever is there — this device's idea of it may
 * be behind if the owner also shares from another — and recipients are told of
 * a change by that number going up.
 */
export async function publishChanges(
  sharer: Sharer,
  song: Song,
  ref: SharedRef,
): Promise<SharedSong> {
  return runTransaction(getFirebaseDb(), async (tx) => {
    const snap = await tx.get(sharedDoc(ref.shareId));
    const existing = snap.exists() ? parseSharedSong(snap.id, snap.data()) : null;
    if (!existing) throw new ShareGoneError();

    const shared: SharedSong = {
      ...existing,
      // The handle as it is now: a rename since must not leave the old name on it.
      handle: sharer.handle,
      display: sharer.display,
      version: existing.version + 1,
      song: toSharePayload(song),
      updatedAt: Date.now(),
    };
    tx.set(sharedDoc(ref.shareId), body(shared));
    if (ref.listed) tx.set(cardDoc(ref.shareId), body(toSharedCard(shared)));
    return shared;
  });
}

/** Puts the song in the browsable library, or takes it out. The link works either way. */
export async function setListed(ref: SharedRef, listed: boolean): Promise<void> {
  await runTransaction(getFirebaseDb(), async (tx) => {
    const snap = await tx.get(sharedDoc(ref.shareId));
    const shared = snap.exists() ? parseSharedSong(snap.id, snap.data()) : null;
    if (!shared) throw new ShareGoneError();
    // The card is drawn from what is shared, not from the owner's song as it
    // is now: unshared changes must not leak out through the library.
    if (listed) tx.set(cardDoc(ref.shareId), body(toSharedCard(shared)));
    else tx.delete(cardDoc(ref.shareId));
  });
}

/** Stops sharing. The link dies for everyone; copies people kept are theirs and stay. */
export async function unshare(shareId: string): Promise<void> {
  const batch = writeBatch(getFirebaseDb());
  batch.delete(sharedDoc(shareId));
  batch.delete(cardDoc(shareId));
  await batch.commit();
}

/** Null when there is no such shared song — never was, or no longer. Works signed out. */
export async function fetchShared(shareId: string): Promise<SharedSong | null> {
  const snap = await getDoc(sharedDoc(shareId));
  return snap.exists() ? parseSharedSong(snap.id, snap.data()) : null;
}

export const LIBRARY_PAGE = 30;

function cards(docs: { id: string; data: () => unknown }[]): SharedCard[] {
  return docs
    .map((d) => parseSharedCard(d.id, d.data()))
    .filter((c): c is SharedCard => c !== null);
}

/** The library, most recently shared first. `after` is the last card of the page before. */
export async function fetchListed(after?: SharedCard): Promise<SharedCard[]> {
  const index = collection(getFirebaseDb(), 'sharedIndex');
  const snap = await getDocs(
    after
      ? query(index, orderBy('updatedAt', 'desc'), startAfter(after.updatedAt), limit(LIBRARY_PAGE))
      : query(index, orderBy('updatedAt', 'desc'), limit(LIBRARY_PAGE)),
  );
  return cards(snap.docs);
}

/**
 * Titles beginning with `text`. A prefix, because that is the one kind of text
 * search Firestore can do on its own; `` is the last code point it sorts,
 * so the range is "everything that starts with this".
 */
export async function searchListed(text: string): Promise<SharedCard[]> {
  const prefix = text.trim().toLowerCase();
  if (!prefix) return fetchListed();
  const snap = await getDocs(
    query(
      collection(getFirebaseDb(), 'sharedIndex'),
      orderBy('titleLower'),
      startAt(prefix),
      endAt(`${prefix}`),
      limit(LIBRARY_PAGE),
    ),
  );
  return cards(snap.docs);
}
