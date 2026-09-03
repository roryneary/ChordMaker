import type { ChordSpec } from '../types/chord';
import type { Placements, SavedChord, Song, Word } from '../types/song';
import { newId } from './id';
import { clampRootFret } from './layout';

/**
 * The song store: many songs keyed by id, plus a pointer at the open one.
 *
 * v1 held a single song under its own key. That key is migrated on first load
 * rather than ignored — it is somebody's work — and left in place afterwards so
 * a downgrade does not lose it.
 */

export const STORAGE_KEY = 'chord-builder:songs:v2';
/** The single-song key this replaces. Read once, on migration; never written. */
export const LEGACY_KEY = 'chord-builder:song:v1';
/** Chords the user built and kept, merged over the built-in library. */
export const USER_CHORDS_KEY = 'chord-builder:chords:v1';

export interface SongStore {
  songs: Song[];
  currentId: string | null;
}

interface StoredV2 {
  v: 2;
  songs: Song[];
  currentId: string | null;
}

export const emptyStore = (): SongStore => ({ songs: [], currentId: null });

export function newSong(title = ''): Song {
  const now = Date.now();
  return {
    id: newId(),
    title,
    key: '',
    feel: '',
    // capo is left absent, not null: nobody has been asked yet. See types/song.ts.
    chords: [],
    lyric: '',
    words: [],
    placements: {},
    createdAt: now,
    updatedAt: now,
  };
}

/* --- Defensive parsing ---------------------------------------------------
   Anything unrecognisable yields a fresh value rather than a crash: a corrupt
   entry must not take the whole library down with it. */

const isSpec = (x: unknown): x is ChordSpec =>
  typeof x === 'object' &&
  x !== null &&
  typeof (x as ChordSpec).name === 'string' &&
  typeof (x as ChordSpec).rootFret === 'number' &&
  typeof (x as ChordSpec).fretCount === 'number' &&
  Array.isArray((x as ChordSpec).markers) &&
  Array.isArray((x as ChordSpec).dots) &&
  Array.isArray((x as ChordSpec).barres);

const isSavedChord = (x: unknown): x is SavedChord =>
  typeof x === 'object' &&
  x !== null &&
  typeof (x as SavedChord).id === 'string' &&
  isSpec((x as SavedChord).spec);

/**
 * rootFret decides whether a nut is drawn and how wide the viewBox is, so a
 * value from outside the neck would render a diagram with no nut and a numeral
 * for a fret that does not exist. Clamped rather than rejected: the shape is
 * still the player's work, it is only sitting in the wrong place.
 */
const withValidRootFret = (c: SavedChord): SavedChord => {
  const rootFret = clampRootFret(c.spec.rootFret);
  return rootFret === c.spec.rootFret ? c : { ...c, spec: { ...c.spec, rootFret } };
};

/** A single chord from an untrusted source — the sibling of `parseSong`,
    and what Firestore documents in `chordSync.ts` are read through. */
export function parseSavedChord(x: unknown): SavedChord | null {
  return isSavedChord(x) ? withValidRootFret(x) : null;
}

const parseSavedChords = (x: unknown): SavedChord[] =>
  Array.isArray(x) ? x.map(parseSavedChord).filter((c): c is SavedChord => c !== null) : [];

const isWord = (x: unknown): x is Word =>
  typeof x === 'object' &&
  x !== null &&
  typeof (x as Word).id === 'string' &&
  typeof (x as Word).line === 'number' &&
  typeof (x as Word).text === 'string';

function parsePlacements(x: unknown): Placements {
  if (typeof x !== 'object' || x === null) return {};
  const out: Placements = {};
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

const str = (x: unknown, fallback = ''): string => (typeof x === 'string' ? x : fallback);

export function parseSong(x: unknown): Song | null {
  if (typeof x !== 'object' || x === null) return null;
  const raw = x as Partial<Song>;
  if (typeof raw.id !== 'string') return null;

  const now = Date.now();
  return {
    id: raw.id,
    title: str(raw.title),
    key: str(raw.key),
    feel: str(raw.feel),
    // Three states, so the null a song was *saved* with survives the trip and
    // is not confused with a song that has never been asked.
    capo: typeof raw.capo === 'number' || raw.capo === null ? raw.capo : undefined,
    chords: parseSavedChords(raw.chords),
    lyric: str(raw.lyric),
    words: Array.isArray(raw.words) ? raw.words.filter(isWord) : [],
    placements: parsePlacements(raw.placements),
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : now,
  };
}

export function serializeStore(store: SongStore): string {
  const stored: StoredV2 = { v: 2, songs: store.songs, currentId: store.currentId };
  return JSON.stringify(stored);
}

export function parseStore(raw: string | null): SongStore | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<StoredV2>;
    if (data?.v !== 2 || !Array.isArray(data.songs)) return null;
    const songs = data.songs.map(parseSong).filter((s): s is Song => s !== null);
    const currentId =
      typeof data.currentId === 'string' && songs.some((s) => s.id === data.currentId)
        ? data.currentId
        : (songs[0]?.id ?? null);
    return { songs, currentId };
  } catch {
    return null;
  }
}

/* --- v1 migration -------------------------------------------------------- */

interface StoredV1 {
  v: 1;
  title: string;
  chords: SavedChord[];
}

/**
 * Wraps the single v1 song as the first entry of the new library. It had no
 * lyric, key, feel or capo — those start empty, which is exactly the state a
 * song is in before the words are pasted. The capo in particular starts
 * *unanswered* rather than "no capo": v1 never asked, so neither can we say.
 */
export function migrateV1(raw: string | null): SongStore | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<StoredV1>;
    if (data?.v !== 1 || typeof data.title !== 'string' || !Array.isArray(data.chords)) {
      return null;
    }
    const chords = parseSavedChords(data.chords);
    if (!chords.length && !data.title.trim()) return null; // nothing worth keeping

    const song: Song = { ...newSong(data.title), chords };
    return { songs: [song], currentId: song.id };
  } catch {
    return null;
  }
}

/* --- Browser storage ----------------------------------------------------- */

export function loadStore(): SongStore {
  try {
    const existing = parseStore(window.localStorage.getItem(STORAGE_KEY));
    if (existing) return existing;

    const migrated = migrateV1(window.localStorage.getItem(LEGACY_KEY));
    if (migrated) {
      saveStore(migrated); // so the migration only runs once
      return migrated;
    }
  } catch {
    // Fall through to an empty library.
  }
  return emptyStore();
}

export function saveStore(store: SongStore): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeStore(store));
  } catch {
    // Private mode or a full quota: the session still works, it just won't persist.
  }
}

/* --- The user's own chords ----------------------------------------------- */

export function loadUserChords(): SavedChord[] {
  try {
    const raw = window.localStorage.getItem(USER_CHORDS_KEY);
    if (!raw) return [];
    return parseSavedChords(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function saveUserChords(chords: SavedChord[]): void {
  try {
    window.localStorage.setItem(USER_CHORDS_KEY, JSON.stringify(chords));
  } catch {
    // As above.
  }
}
