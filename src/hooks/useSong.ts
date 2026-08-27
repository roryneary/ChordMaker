import { useEffect, useReducer } from 'react';
import type { ChordSpec } from '../types/chord';
import type { SavedChord, Song } from '../types/song';

export const STORAGE_KEY = 'chord-builder:song:v1';

export const emptySong = (): Song => ({ title: '', chords: [] });

export type SongAction =
  | { type: 'SET_TITLE'; title: string }
  | { type: 'ADD_CHORD'; spec: ChordSpec; id?: string }
  | { type: 'UPDATE_CHORD'; id: string; spec: ChordSpec }
  | { type: 'REMOVE_CHORD'; id: string }
  | { type: 'CLEAR_SONG' };

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function songReducer(song: Song, action: SongAction): Song {
  switch (action.type) {
    case 'SET_TITLE':
      return { ...song, title: action.title };

    case 'ADD_CHORD': {
      const chord: SavedChord = { id: action.id ?? newId(), spec: action.spec };
      return { ...song, chords: [...song.chords, chord] };
    }

    case 'UPDATE_CHORD':
      return {
        ...song,
        chords: song.chords.map((c) => (c.id === action.id ? { ...c, spec: action.spec } : c)),
      };

    case 'REMOVE_CHORD':
      return { ...song, chords: song.chords.filter((c) => c.id !== action.id) };

    case 'CLEAR_SONG':
      return emptySong();

    default:
      return song;
  }
}

interface StoredSong {
  v: 1;
  title: string;
  chords: SavedChord[];
}

export function serializeSong(song: Song): string {
  const stored: StoredSong = { v: 1, title: song.title, chords: song.chords };
  return JSON.stringify(stored);
}

const isSpec = (x: unknown): x is ChordSpec =>
  typeof x === 'object' &&
  x !== null &&
  typeof (x as ChordSpec).name === 'string' &&
  typeof (x as ChordSpec).rootFret === 'number' &&
  typeof (x as ChordSpec).fretCount === 'number' &&
  Array.isArray((x as ChordSpec).markers) &&
  Array.isArray((x as ChordSpec).dots) &&
  Array.isArray((x as ChordSpec).barres);

/** Anything unrecognisable yields a fresh song rather than a crash. */
export function parseSong(raw: string | null): Song {
  if (!raw) return emptySong();
  try {
    const data = JSON.parse(raw) as Partial<StoredSong>;
    if (data?.v !== 1 || typeof data.title !== 'string' || !Array.isArray(data.chords)) {
      return emptySong();
    }
    const chords = data.chords.filter(
      (c): c is SavedChord =>
        typeof c === 'object' && c !== null && typeof c.id === 'string' && isSpec(c.spec),
    );
    return { title: data.title, chords };
  } catch {
    return emptySong();
  }
}

function loadSong(): Song {
  try {
    return parseSong(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return emptySong();
  }
}

function saveSong(song: Song): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeSong(song));
  } catch {
    // Private mode or a full quota: the session still works, it just won't persist.
  }
}

export function useSong() {
  const [song, dispatchSong] = useReducer(songReducer, undefined, loadSong);

  useEffect(() => {
    saveSong(song);
  }, [song]);

  return { song, dispatchSong };
}
