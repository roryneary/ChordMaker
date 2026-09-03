/**
 * What `useSongs` and `useUserChords` share about syncing a local library to
 * an account: the rule for what a sign-in does to two libraries, and the one
 * device-wide marker that stops it going wrong across accounts. See
 * `songSync.ts` and `chordSync.ts` for the Firestore calls each builds on top
 * of this with.
 */

const LAST_UID_KEY = 'chord-builder:lastSyncedUid:v1';

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
  /** What the local library becomes — remote plus anything only local knew. */
  merged: T[];
  /** Local-only entries that need writing up, so the merge isn't one-sided. */
  toPush: T[];
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
 * `allowPush` exists for the one case this rule alone would get wrong: local
 * entries left over from a *different* account that previously used this
 * device. Without it, signing in as someone else would silently hand your
 * unsynced work to their library. The caller decides by comparing the
 * incoming uid against `lastSyncedUid()`.
 *
 * Generic over songs and loose chords alike — both are "a list of things with
 * an id, owned by an account," and the rule does not care which.
 */
export function mergeOnSignIn<T extends { id: string }>(
  local: T[],
  remote: T[],
  allowPush: boolean,
): MergeResult<T> {
  const remoteIds = new Set(remote.map((s) => s.id));
  const localOnly = local.filter((s) => !remoteIds.has(s.id));

  if (!allowPush) return { merged: remote, toPush: [] };
  return { merged: [...remote, ...localOnly], toPush: localOnly };
}
