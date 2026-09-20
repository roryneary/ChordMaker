/**
 * What syncing a local library to an account comes down to: the rule for what
 * a sign-in does to two libraries, and the device-wide marker that stops it
 * going wrong across accounts. `useSongs` is the only caller, and runs it twice
 * — once for songs, once for playlists — which is why it is generic over
 * anything with an id. See `songSync.ts` and `playlistSync.ts` for the
 * Firestore calls built on top of it.
 */

const LAST_UID_KEY = 'chord-builder:lastSyncedUid:v1';
const STASH_PREFIX = 'chord-builder:stash:v1:';

/** Which account, if any, last hydrated a library on this device. */
export function lastSyncedUid(): string | null {
  try {
    return window.localStorage.getItem(LAST_UID_KEY);
  } catch {
    return null;
  }
}

export function rememberSyncedUid(uid: string): void {
  try {
    window.localStorage.setItem(LAST_UID_KEY, uid);
  } catch {
    // Private mode or a full quota: worst case, the next sign-in asks again.
  }
}

export interface MergeResult<T> {
  /** What the local library becomes. */
  merged: T[];
  /** Entries the account does not have, or has an older copy of: write these up. */
  toPush: T[];
  /** Ids deleted here while unconfirmed, which the account still holds. */
  toDelete: string[];
  /** Local entries the merge leaves out because they are not this account's. */
  stranded: T[];
}

/**
 * What happens to a library the moment an account attaches to it.
 *
 * Remote wins on an id both sides have — same rule as sharing (ROADMAP.md
 * §1): there is no sound way to merge two edited copies of one entry, so this
 * picks a side rather than guessing. The case that matters more in practice
 * is a *new* account, where remote starts empty and everything local survives
 * by falling into `toPush` — that's the migration ROADMAP.md calls out as
 * "must not be got wrong": local work has to become the account's, not be
 * quietly discarded in favour of an empty synced library.
 *
 * `unsynced` is the exception to "remote wins", and it is what makes the rule
 * safe to run on every page load rather than once per sign-in. It names the
 * ids this device changed and never had confirmed — an edit made with no
 * signal, a write the database refused, a tab closed mid-save. For those the
 * remote copy is known to be the stale one, so local wins and goes back up;
 * and an unconfirmed *delete* stays deleted instead of being resurrected by
 * the copy the account still holds. Without it, editing a song on a dead
 * connection and reopening the app later silently reverted the edit.
 *
 * `allowPush` exists for the one case this rule alone would get wrong: local
 * entries left over from a *different* account that previously used this
 * device. Without it, signing in as someone else would silently hand your
 * unsynced work to their library. The caller decides by comparing the
 * incoming uid against `lastSyncedUid()`, and is handed `stranded` so that
 * work can be set aside rather than overwritten — see `stashLibrary`.
 */
export function mergeOnSignIn<T extends { id: string }>(
  local: T[],
  remote: T[],
  allowPush: boolean,
  unsynced: readonly string[] = [],
): MergeResult<T> {
  const remoteIds = new Set(remote.map((s) => s.id));
  const localOnly = local.filter((s) => !remoteIds.has(s.id));

  if (!allowPush) return { merged: remote, toPush: [], toDelete: [], stranded: localOnly };

  const dirty = new Set(unsynced);
  const localById = new Map(local.map((s) => [s.id, s] as const));

  const toDelete: string[] = [];
  const localWins: T[] = [];
  const kept: T[] = [];
  for (const theirs of remote) {
    const mine = localById.get(theirs.id);
    if (!dirty.has(theirs.id)) kept.push(theirs);
    else if (mine) {
      kept.push(mine);
      localWins.push(mine);
    } else toDelete.push(theirs.id);
  }

  return {
    merged: [...kept, ...localOnly],
    toPush: [...localWins, ...localOnly],
    toDelete,
    stranded: [],
  };
}

/* --- The stash -------------------------------------------------------------
   When a different account signs in on this device, the library already here
   is replaced by theirs — it has to be, it is not theirs to see. It used to be
   simply overwritten, which meant signing in with Google after using email
   (two uids for one person) emptied the device with no warning and no way
   back. Now it is set aside under the uid it belonged to, and handed back the
   next time that account signs in here. */

/** Which library a stash holds. Songs keep the unprefixed key they always had,
    so a stash written before playlists existed is still found. */
export type StashBucket = 'songs' | 'playlists' | 'chords';

const stashKey = (owner: string | null, bucket: StashBucket) =>
  `${STASH_PREFIX}${bucket === 'songs' ? '' : `${bucket}:`}${owner ?? 'nobody'}`;

/** Adds to whatever is already stashed for `owner`; a newer copy of an id replaces the older. */
export function mergeStash<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const incomingIds = new Set(incoming.map((s) => s.id));
  return [...existing.filter((s) => !incomingIds.has(s.id)), ...incoming];
}

export function stashLibrary<T extends { id: string }>(
  owner: string | null,
  entries: T[],
  bucket: StashBucket = 'songs',
): void {
  if (!entries.length) return;
  try {
    const key = stashKey(owner, bucket);
    const raw = window.localStorage.getItem(key);
    const existing = raw ? (JSON.parse(raw) as T[]) : [];
    const merged = mergeStash(Array.isArray(existing) ? existing : [], entries);
    window.localStorage.setItem(key, JSON.stringify(merged));
  } catch {
    // A full quota. Nothing more can be done from here.
  }
}

/** Reads the stash for `owner` and empties it. The caller validates what comes back. */
export function takeStash(owner: string, bucket: StashBucket = 'songs'): unknown[] {
  try {
    const key = stashKey(owner, bucket);
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    window.localStorage.removeItem(key);
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
