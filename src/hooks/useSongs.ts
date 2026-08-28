import { useEffect, useMemo, useReducer } from 'react';
import type { ChordSpec } from '../types/chord';
import type { SavedChord, Song } from '../types/song';
import { newId } from '../lib/id';
import { prunePlacements, pruneToChords, retokenise } from '../lib/lyric';
import { type SongStore, loadStore, newSong, saveStore } from '../lib/storage';

export type SongsAction =
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

    case 'ADD_CHORD':
      return editSong(store, action.id, (s) => {
        const chord: SavedChord = { id: action.chordId ?? newId(), spec: action.spec };
        return { ...s, chords: [...s.chords, chord] };
      });

    case 'UPDATE_CHORD':
      return editSong(store, action.id, (s) => ({
        ...s,
        chords: s.chords.map((c) =>
          c.id === action.chordId ? { ...c, spec: action.spec } : c,
        ),
      }));

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

export function useSongs() {
  const [store, dispatch] = useReducer(songsReducer, undefined, loadStore);

  useEffect(() => {
    saveStore(store);
  }, [store]);

  const current = useMemo(
    () => store.songs.find((s) => s.id === store.currentId) ?? null,
    [store],
  );

  return { store, songs: store.songs, current, dispatch };
}
