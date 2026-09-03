import { useEffect, useMemo, useReducer, useRef } from 'react';
import type { ChordSpec } from '../types/chord';
import type { SavedChord, Song } from '../types/song';
import { newId } from '../lib/id';
import { prunePlacements, pruneToChords, retokenise } from '../lib/lyric';
import { type SongStore, loadStore, newSong, saveStore } from '../lib/storage';
import { firebaseEnabled } from '../lib/firebase';
import { deleteRemoteSong, fetchRemoteSongs, pushSongs, writeSong } from '../lib/songSync';
import { lastSyncedUid, mergeOnSignIn, rememberSyncedUid } from '../lib/accountSync';

export type SongsAction =
  | { type: 'HYDRATE'; songs: Song[] }
  | { type: 'CREATE_SONG'; title: string; id?: string }
  | { type: 'OPEN_SONG'; id: string | null }
  | { type: 'DELETE_SONG'; id: string }
  | { type: 'SET_TITLE'; id: string; title: string }
  | { type: 'SET_META'; id: string; key?: string; feel?: string }
  | { type: 'SET_CAPO'; id: string; capo: number | null }
  | { type: 'SET_LYRIC'; id: string; lyric: string }
  | { type: 'ADD_CHORD'; id: string; spec: ChordSpec; chordId?: string }
  | { type: 'UPDATE_CHORD'; id: string; chordId: string; spec: ChordSpec }
  | { type: 'REMOVE_CHORD'; id: string; chordId: string }
  | { type: 'REORDER_CHORD'; id: string; chordId: string; to: number }
  | { type: 'PLACE_CHORD'; id: string; wordId: string; chordId: string | null };

/**
 * A chord's name is what the sheet prints over the word — a nameless one draws
 * as an em dash on the song screen and as a gap on the printed sheet, so it is
 * refused here rather than saved and rendered as a hole.
 */
export const named = (spec: ChordSpec) => spec.name.trim().length > 0;

const trimName = (spec: ChordSpec): ChordSpec =>
  spec.name === spec.name.trim() ? spec : { ...spec, name: spec.name.trim() };

/** Applies `change` to one song and stamps it, leaving the rest of the store alone. */
function editSong(
  store: SongStore,
  id: string,
  change: (song: Song) => Song,
): SongStore {
  let touched = false;
  const songs = store.songs.map((s) => {
    if (s.id !== id) return s;
    const next = change(s);
    if (next === s) return s;
    touched = true;
    return { ...next, updatedAt: Date.now() };
  });
  return touched ? { ...store, songs } : store;
}

export function songsReducer(store: SongStore, action: SongsAction): SongStore {
  switch (action.type) {
    case 'HYDRATE': {
      // Keeps the open song open if the merge still has it; falls back rather
      // than pointing at nothing, same as OPEN_SONG's own guard.
      const currentId = action.songs.some((s) => s.id === store.currentId)
        ? store.currentId
        : (action.songs[0]?.id ?? null);
      return { songs: action.songs, currentId };
    }

    case 'CREATE_SONG': {
      const song = { ...newSong(action.title), ...(action.id ? { id: action.id } : {}) };
      return { songs: [song, ...store.songs], currentId: song.id };
    }

    case 'OPEN_SONG':
      return { ...store, currentId: action.id };

    case 'DELETE_SONG': {
      const songs = store.songs.filter((s) => s.id !== action.id);
      const currentId =
        store.currentId === action.id ? (songs[0]?.id ?? null) : store.currentId;
      return { songs, currentId };
    }

    case 'SET_TITLE':
      return editSong(store, action.id, (s) => ({ ...s, title: action.title }));

    case 'SET_META':
      return editSong(store, action.id, (s) => ({
        ...s,
        key: action.key ?? s.key,
        feel: action.feel ?? s.feel,
      }));

    case 'SET_CAPO':
      return editSong(store, action.id, (s) => ({ ...s, capo: action.capo }));

    case 'SET_LYRIC':
      return editSong(store, action.id, (s) => {
        if (s.lyric === action.lyric) return s;
        // Ids carry across the edit wherever the text still lines up, which is
        // what keeps already-placed chords attached to their words.
        const words = retokenise(s.words, action.lyric);
        return {
          ...s,
          lyric: action.lyric,
          words,
          placements: prunePlacements(s.placements, words),
        };
      });

    case 'ADD_CHORD': {
      if (!named(action.spec)) return store;
      const spec = trimName(action.spec);
      return editSong(store, action.id, (s) => {
        const chord: SavedChord = { id: action.chordId ?? newId(), spec };
        return { ...s, chords: [...s.chords, chord] };
      });
    }

    case 'UPDATE_CHORD': {
      if (!named(action.spec)) return store;
      const spec = trimName(action.spec);
      return editSong(store, action.id, (s) => ({
        ...s,
        chords: s.chords.map((c) => (c.id === action.chordId ? { ...c, spec } : c)),
      }));
    }

    case 'REMOVE_CHORD':
      return editSong(store, action.id, (s) => {
        const chords = s.chords.filter((c) => c.id !== action.chordId);
        // A placement pointing at a chord that no longer exists would render as
        // a blank slot, so they go with it.
        return {
          ...s,
          chords,
          placements: pruneToChords(
            s.placements,
            chords.map((c) => c.id),
          ),
        };
      });

    case 'REORDER_CHORD':
      return editSong(store, action.id, (s) => {
        const from = s.chords.findIndex((c) => c.id === action.chordId);
        if (from === -1) return s;
        const chords = s.chords.slice();
        const [moved] = chords.splice(from, 1);
        chords.splice(Math.max(0, Math.min(action.to, chords.length)), 0, moved);
        return { ...s, chords };
      });

    case 'PLACE_CHORD':
      return editSong(store, action.id, (s) => {
        const placements = { ...s.placements };
        if (action.chordId === null) delete placements[action.wordId];
        else placements[action.wordId] = action.chordId;
        return { ...s, placements };
      });

    default:
      return store;
  }
}

/**
 * `uid` is null signed out. Signed in, `localStorage` is still what the UI
 * reads and writes through the reducer — nothing here changes that — but a
 * sign-in pulls the account's remote library down and merges it in
 * (`mergeOnSignIn`, see songSync.ts for the migration rule), and every local
 * edit thereafter is mirrored up.
 */
export function useSongs(uid: string | null) {
  const [store, dispatch] = useReducer(songsReducer, undefined, loadStore);

  useEffect(() => {
    saveStore(store);
  }, [store]);

  /* The push effect below diffs against this to find what an edit touched —
     see `editSong`, which returns the very same song and array references for
     anything an action did not touch. Set alongside HYDRATE so the merge
     itself is never mistaken for a fresh local edit and echoed straight back. */
  const prevSongs = useRef(store.songs);

  useEffect(() => {
    if (!uid || !firebaseEnabled) return;
    let cancelled = false;

    void (async () => {
      const remote = await fetchRemoteSongs(uid);
      if (cancelled) return;

      const allowPush = lastSyncedUid() === null || lastSyncedUid() === uid;
      const { merged, toPush } = mergeOnSignIn(store.songs, remote, allowPush);

      if (toPush.length) await pushSongs(uid, toPush);
      if (cancelled) return;

      rememberSyncedUid(uid);
      prevSongs.current = merged;
      dispatch({ type: 'HYDRATE', songs: merged });
    })();

    return () => {
      cancelled = true;
    };
    // Deliberately uid-only: this runs once per sign-in, not on every local
    // edit — the push effect below is what mirrors those.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  useEffect(() => {
    if (!uid || !firebaseEnabled) return;
    if (prevSongs.current === store.songs) return; // nothing this action touched

    const before = new Map(prevSongs.current.map((s) => [s.id, s] as const));
    const afterIds = new Set(store.songs.map((s) => s.id));

    for (const song of store.songs) {
      if (before.get(song.id) !== song) void writeSong(uid, song);
    }
    for (const song of prevSongs.current) {
      if (!afterIds.has(song.id)) void deleteRemoteSong(uid, song.id);
    }

    prevSongs.current = store.songs;
  }, [uid, store.songs]);

  const current = useMemo(
    () => store.songs.find((s) => s.id === store.currentId) ?? null,
    [store],
  );

  return { store, songs: store.songs, current, dispatch };
}
