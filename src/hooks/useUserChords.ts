import { useEffect, useRef, useState } from 'react';
import type { SavedChord } from '../types/song';
import { firebaseEnabled } from '../lib/firebase';
import { lastSyncedUid, mergeOnSignIn, rememberSyncedUid } from '../lib/accountSync';
import {
  deleteRemoteUserChord,
  fetchRemoteUserChords,
  pushUserChords,
  writeUserChord,
} from '../lib/chordSync';
import { loadUserChords, saveUserChords } from '../lib/storage';

/**
 * The standalone shapes a player builds with no song open — the "one chord"
 * path in App.tsx, and what the sidebar's Gig bag names. Same problem as
 * `useSongs`, one size smaller: `localStorage` (`USER_CHORDS_KEY`) is what is
 * read and written locally, an account mirrors it, and ROADMAP.md §2 was
 * explicit that these travel with a synced song library rather than being
 * left behind by it. See `accountSync.ts` for the merge rule this shares with
 * `useSongs`, and `chordSync.ts` for the Firestore calls.
 */
export function useUserChords(uid: string | null) {
  const [chords, setChords] = useState<SavedChord[]>(() => loadUserChords());

  /* Reference-diffed against this, same trick as useSongs: `add` always
     produces a new array, so a changed reference is exactly "something to
     push", and HYDRATE-style replacement sets this alongside the state so a
     merge is never mistaken for a local edit and echoed straight back. */
  const prev = useRef(chords);

  useEffect(() => {
    saveUserChords(chords);
  }, [chords]);

  useEffect(() => {
    if (!uid || !firebaseEnabled) return;
    let cancelled = false;

    void (async () => {
      const remote = await fetchRemoteUserChords(uid);
      if (cancelled) return;

      const allowPush = lastSyncedUid() === null || lastSyncedUid() === uid;
      const { merged, toPush } = mergeOnSignIn(chords, remote, allowPush);

      if (toPush.length) await pushUserChords(uid, toPush);
      if (cancelled) return;

      rememberSyncedUid(uid);
      prev.current = merged;
      setChords(merged);
    })();

    return () => {
      cancelled = true;
    };
    // Deliberately uid-only — see the identical note in useSongs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  useEffect(() => {
    if (!uid || !firebaseEnabled) return;
    if (prev.current === chords) return;

    const before = new Map(prev.current.map((c) => [c.id, c] as const));
    const afterIds = new Set(chords.map((c) => c.id));

    for (const chord of chords) {
      if (before.get(chord.id) !== chord) void writeUserChord(uid, chord);
    }
    for (const chord of prev.current) {
      if (!afterIds.has(chord.id)) void deleteRemoteUserChord(uid, chord.id);
    }

    prev.current = chords;
  }, [uid, chords]);

  const add = (chord: SavedChord) => setChords((cs) => [...cs, chord]);

  return { chords, add };
}
