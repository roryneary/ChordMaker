import { useCallback, useEffect, useRef, useState } from 'react';
import { firebaseEnabled } from '../lib/firebase';
import { updateAvailable } from '../lib/sharedSong';
import { fetchShared } from '../lib/sharedSongSync';
import type { SharedSong } from '../types/sharedSong';
import type { Song } from '../types/song';

/** Opening the same song again within this long does not ask the database again. */
const RECHECK_MS = 60_000;

const follows = (song: Song) => !!song.copiedFrom && song.copiedFrom.follows !== false;

/**
 * Has anyone I took a song from changed theirs since?
 *
 * Asked once a session for every song that still follows its sender, and again
 * for a song when it is opened. What comes back is held here, in memory, and
 * nowhere else: it is the database's answer as of a moment ago, not something
 * this device knows, so it does not belong in the song store — and keeping it
 * out is what lets the reducer go on not knowing a server exists.
 *
 * One `get` per song rather than a query, because a shared song can be read by
 * whoever holds its id and cannot be listed by anyone (`firestore.rules`). That
 * also means it works signed out. Every failure is silent: no signal, or the
 * owner having stopped sharing, is simply "nothing new".
 */
export function useSharedUpdates(songs: Song[], openSongId: string | null) {
  const [latest, setLatest] = useState<ReadonlyMap<string, SharedSong>>(new Map());
  const checkedAt = useRef(new Map<string, number>());

  const check = useCallback((shareIds: string[]) => {
    if (!firebaseEnabled || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    const now = Date.now();
    const due = shareIds.filter((id) => now - (checkedAt.current.get(id) ?? 0) > RECHECK_MS);
    if (!due.length) return;
    for (const id of due) checkedAt.current.set(id, now);

    void (async () => {
      // One at a time: this is housekeeping, and must not crowd out a save.
      for (const id of due) {
        try {
          const shared = await fetchShared(id);
          if (shared) setLatest((m) => new Map(m).set(id, shared));
        } catch {
          // Asked again next session, or the next time the song is opened.
          checkedAt.current.delete(id);
        }
      }
    })();
  }, []);

  /* The ids, as one string, so the effect runs when the *set* of followed
     shares changes and not on every keystroke in every song. */
  const followed = [...new Set(songs.filter(follows).map((s) => s.copiedFrom!.shareId))]
    .sort()
    .join(' ');
  useEffect(() => {
    if (followed) check(followed.split(' '));
  }, [followed, check]);

  const open = songs.find((s) => s.id === openSongId);
  const openShareId = open && follows(open) ? open.copiedFrom!.shareId : null;
  useEffect(() => {
    if (openShareId) check([openShareId]);
  }, [openShareId, check]);

  /** The sender's newer version of `song`, if there is one to offer. */
  const updateFor = useCallback(
    (song: Song): SharedSong | null => {
      const shared = song.copiedFrom ? (latest.get(song.copiedFrom.shareId) ?? null) : null;
      return updateAvailable(song, shared) ? shared : null;
    },
    [latest],
  );

  return { updateFor };
}
