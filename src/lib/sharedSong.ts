import type { CopiedFrom, Song } from '../types/song';
import type { SharePayload, SharedCard, SharedSong } from '../types/sharedSong';
import { parseSong } from './storage';

/**
 * Sharing, the part with no server in it: what travels, what a recipient's copy
 * looks like, and the two questions the screens ask — has the owner changed
 * this since sharing it, and has the sender changed theirs since I took it.
 * `sharedSongSync.ts` holds the Firestore calls built on top.
 *
 * The model is copy-on-share (ROADMAP.md §1). A song is never opened up to a
 * second person; a copy is put where others can reach it, and keeping it makes
 * another copy that is the recipient's outright. There is no merge anywhere in
 * here, because there cannot be one: `retokenise` mints word ids per copy, so
 * two edited copies of one song share nothing to merge on.
 */

/* --- How big a song may be -------------------------------------------------
   The rule is four times the longest real song. Bat Out of Hell runs to about
   4,500 characters, so 20,000 — room for a long song and anything typed around
   it. The word list is what actually fills a document (every word carries a
   36-character id), and at these limits a song is still under half of
   Firestore's 1 MiB. `firestore.rules` holds the same numbers, and refuses
   what these let through: keep the two in step. */
export const MAX_TITLE_CHARS = 200;
export const MAX_LYRIC_CHARS = 20_000;
export const MAX_WORDS = 5_000;
export const MAX_CHORDS = 100;

/** Why the account would refuse this song, in words for the player; null if it would not. */
export function tooBigToSave(song: Pick<Song, 'title' | 'lyric' | 'words' | 'chords'>): string | null {
  if (song.lyric.length > MAX_LYRIC_CHARS || song.words.length > MAX_WORDS) {
    return 'These words are too long to save to your account. Split the song in two.';
  }
  if (song.chords.length > MAX_CHORDS) return 'That is more chords than one song can hold.';
  if (song.title.length > MAX_TITLE_CHARS) return 'That title is too long to save.';
  return null;
}

/* --- What travels ---------------------------------------------------------- */

export function toSharePayload(song: Song): SharePayload {
  return {
    title: song.title,
    key: song.key,
    feel: song.feel,
    // Carried as it is, absent included: an unanswered capo is still
    // unanswered for whoever takes the song.
    ...(song.capo === undefined ? {} : { capo: song.capo }),
    chords: song.chords,
    lyric: song.lyric,
    words: song.words,
    placements: song.placements,
  };
}

/** The library card for a shared song. Derived, never edited on its own. */
export function toSharedCard(shared: SharedSong): SharedCard {
  return {
    id: shared.id,
    ownerUid: shared.ownerUid,
    handle: shared.handle,
    display: shared.display,
    title: shared.song.title,
    titleLower: shared.song.title.trim().toLowerCase(),
    chordCount: shared.song.chords.length,
    firstChords: shared.song.chords.slice(0, 4).map((c) => c.spec),
    updatedAt: shared.updatedAt,
  };
}

const num = (x: unknown, fallback: number) => (typeof x === 'number' ? x : fallback);

/**
 * A shared song from the database. Somebody else wrote it, so nothing in it is
 * trusted: the payload goes through `parseSong`, the same defensive read a
 * song from this device's own storage gets.
 */
export function parseSharedSong(id: string, x: unknown): SharedSong | null {
  if (typeof x !== 'object' || x === null) return null;
  const raw = x as Partial<SharedSong>;
  if (typeof raw.ownerUid !== 'string' || typeof raw.handle !== 'string') return null;
  if (typeof raw.version !== 'number') return null;

  if (typeof raw.song !== 'object' || raw.song === null) return null;
  const song = parseSong({ ...raw.song, id });
  if (!song) return null;

  const now = Date.now();
  return {
    id,
    ownerUid: raw.ownerUid,
    handle: raw.handle,
    display: typeof raw.display === 'string' ? raw.display : raw.handle,
    songId: typeof raw.songId === 'string' ? raw.songId : '',
    version: raw.version,
    song: toSharePayload(song),
    publishedAt: num(raw.publishedAt, now),
    updatedAt: num(raw.updatedAt, now),
  };
}

export function parseSharedCard(id: string, x: unknown): SharedCard | null {
  if (typeof x !== 'object' || x === null) return null;
  const raw = x as Partial<SharedCard>;
  if (typeof raw.ownerUid !== 'string' || typeof raw.handle !== 'string') return null;
  if (typeof raw.title !== 'string') return null;

  // The shapes are validated by the same code that validates a song's chords.
  const shapes = parseSong({
    id,
    chords: Array.isArray(raw.firstChords)
      ? raw.firstChords.map((spec, i) => ({ id: String(i), spec }))
      : [],
  });
  return {
    id,
    ownerUid: raw.ownerUid,
    handle: raw.handle,
    display: typeof raw.display === 'string' ? raw.display : raw.handle,
    title: raw.title,
    titleLower: typeof raw.titleLower === 'string' ? raw.titleLower : raw.title.toLowerCase(),
    chordCount: num(raw.chordCount, 0),
    firstChords: (shapes?.chords ?? []).map((c) => c.spec),
    updatedAt: num(raw.updatedAt, Date.now()),
  };
}

/* --- The recipient's side -------------------------------------------------- */

export function lineageOf(shared: SharedSong): CopiedFrom {
  return {
    shareId: shared.id,
    version: shared.version,
    uid: shared.ownerUid,
    handle: shared.handle,
    ...(shared.display && shared.display !== shared.handle ? { display: shared.display } : {}),
  };
}

/**
 * The recipient's own copy: a new song under `id`, theirs from this moment.
 * Stamped now rather than with the sender's dates — it is new *here*, and
 * "recently touched" on the Songs screen is about this library.
 */
export function songFromShare(shared: SharedSong, id: string, now = Date.now()): Song {
  return {
    id,
    ...shared.song,
    copiedFrom: lineageOf(shared),
    createdAt: now,
    updatedAt: now,
  };
}

/** "from @rory". The `@` is earned: the rules only let a claimed handle onto a shared song. */
export function senderLabel(from: Pick<CopiedFrom, 'handle' | 'display'>): string {
  return `@${from.display?.trim() || from.handle}`;
}

/**
 * Has the sender shared changes this copy has not caught up to? False for a
 * copy that has gone its own way, and for a share that is gone (`null`) — the
 * owner stopped sharing, and that is nothing the recipient needs telling.
 */
export function updateAvailable(song: Song, shared: SharedSong | null): boolean {
  const from = song.copiedFrom;
  if (!from || from.follows === false || !shared) return false;
  return shared.id === from.shareId && shared.version > from.version;
}

/** The copy of `shareId` already in this library, if there is one. The newest, if several. */
export function copyOf(songs: Song[], shareId: string): Song | null {
  const copies = songs.filter((s) => s.copiedFrom?.shareId === shareId);
  return copies.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
}

/* --- The owner's side ------------------------------------------------------ */

/** "You've changed this since you shared it." See `SharedRef.at`. */
export function changedSinceShared(song: Song): boolean {
  return !!song.shared && song.updatedAt > song.shared.at;
}

/**
 * The link is the key to the song, so its id must be unguessable. `newId`
 * falls back to `Math.random` where there is no `crypto`; for a song's own id
 * that is fine, for this it is not, so there is no fallback: null means this
 * browser cannot share.
 */
export function newShareId(): string | null {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : null;
}

/** `base` is the page's address without its hash: routes live in the hash. */
export function shareUrl(shareId: string, base: string): string {
  return `${base.replace(/#.*$/, '')}#/shared/${shareId}`;
}
