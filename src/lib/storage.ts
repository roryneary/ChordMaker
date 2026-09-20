import type { ChordSpec } from '../types/chord';
import type { CopiedFrom, Placements, SavedChord, SharedRef, Song, Word } from '../types/song';
import type { Playlist } from '../types/playlist';
import type { MyChord } from '../types/myChord';
import { newId } from './id';
import { clampRootFret } from './layout';
import { parsePlaylist } from './playlists';

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
/**
 * The retired loose-chord library: shapes built with "Just one chord" and no
 * song open. Nothing ever read it back, so it was a second place for work to
 * go and never be seen again. Read once, folded into a song, then removed —
 * see `looseChordsToSong`.
 */
export const USER_CHORDS_KEY = 'chord-builder:chords:v1';
/** The title the folded shapes are kept under, so the player can see where they went. */
export const LOOSE_CHORDS_TITLE = 'Loose chords';

export interface SongStore {
  songs: Song[];
  currentId: string | null;
  /**
   * Ids changed on this device and not yet confirmed by the account: created,
   * edited, or — when no song here carries the id any more — deleted.
   *
   * It lives in the store, not in the sync hook, for two reasons. It has to
   * survive a reload: an edit made with no signal is still unsaved tomorrow,
   * and the sign-in merge needs to know that or "remote wins" reverts it. And
   * the reducer is the only place that can record a change atomically with
   * making it — an effect marking ids after the render leaves a gap the merge
   * can land in. It says nothing about a server; signed out it simply grows to
   * "every song", which is exactly what a first sign-in has to push.
   */
  unsynced: string[];
  /**
   * Playlists live in the song store rather than one of their own, because
   * deleting a song has to take it out of every playlist in the same step — a
   * second store could only follow the first, and a reload between the two
   * would leave a playlist pointing at nothing.
   */
  playlists: Playlist[];
  /** `unsynced`, for playlists. Separate because an id with nothing behind it
      means "deleted", and the sync has to know from which collection. */
  unsyncedPlaylists: string[];
  /**
   * "My chords": shapes kept outside any song. Here for the playlists' other
   * reason — one store is one save, one merge at sign-in and one line saying
   * whether it is all kept — not because anything ties them to a song. Nothing
   * does: a song holds its own copy of every shape it uses, so no action on a
   * song touches these, and none on these touches a song.
   */
  chords: MyChord[];
  /** `unsynced`, for My chords. */
  unsyncedChords: string[];
}

interface StoredV2 {
  v: 2;
  songs: Song[];
  currentId: string | null;
  /** Absent in stores saved before it existed, which reads as "all confirmed". */
  unsynced?: string[];
  /** Both absent in stores saved before playlists: no playlists, nothing to confirm.
      No version bump — the `capo` precedent, an absent key that already means something. */
  playlists?: Playlist[];
  unsyncedPlaylists?: string[];
  /** The same again for My chords: absent is "none kept, nothing to confirm". */
  chords?: MyChord[];
  unsyncedChords?: string[];
}

export const emptyStore = (): SongStore => ({
  songs: [],
  currentId: null,
  unsynced: [],
  playlists: [],
  unsyncedPlaylists: [],
  chords: [],
  unsyncedChords: [],
});

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

/** A single chord from an untrusted source — the sibling of `parseSong`. */
export function parseSavedChord(x: unknown): SavedChord | null {
  return isSavedChord(x) ? withValidRootFret(x) : null;
}

/**
 * One of My chords from an untrusted source — and, unlike `parseSong` and
 * `parsePlaylist`, it does NOT forgive a missing stamp. That is deliberate, so
 * leave it strict: the retired loose-chord store wrote bare `{ id, spec }`
 * documents to the very path My chords now syncs to, and those shapes were
 * already folded into a "Loose chords" song. The stamps are how the two are
 * told apart; default them and every one of those comes back as a duplicate.
 */
export function parseMyChord(x: unknown): MyChord | null {
  const chord = parseSavedChord(x);
  const raw = x as Partial<MyChord> | null;
  if (!chord || typeof raw?.createdAt !== 'number' || typeof raw.updatedAt !== 'number') {
    return null;
  }
  return { id: chord.id, spec: chord.spec, createdAt: raw.createdAt, updatedAt: raw.updatedAt };
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

/* Both of these come back `undefined` for anything short of a whole record. A
   half-read one is worse than none: a `shared` with no id would show a song as
   shared with no link to send, and a `copiedFrom` with no uid names nobody. */

function parseSharedRef(x: unknown): SharedRef | undefined {
  if (typeof x !== 'object' || x === null) return undefined;
  const raw = x as Partial<SharedRef>;
  if (typeof raw.shareId !== 'string' || typeof raw.version !== 'number') return undefined;
  return {
    shareId: raw.shareId,
    version: raw.version,
    // Unknown reads as "changed since", which costs one needless tap; the
    // other way round would hide a real change.
    at: typeof raw.at === 'number' ? raw.at : 0,
    listed: raw.listed === true,
  };
}

function parseCopiedFrom(x: unknown): CopiedFrom | undefined {
  if (typeof x !== 'object' || x === null) return undefined;
  const raw = x as Partial<CopiedFrom>;
  if (
    typeof raw.shareId !== 'string' ||
    typeof raw.version !== 'number' ||
    typeof raw.uid !== 'string' ||
    typeof raw.handle !== 'string'
  ) {
    return undefined;
  }
  return {
    shareId: raw.shareId,
    version: raw.version,
    uid: raw.uid,
    handle: raw.handle,
    ...(typeof raw.display === 'string' ? { display: raw.display } : {}),
    ...(raw.follows === false ? { follows: false as const } : {}),
  };
}

export function parseSong(x: unknown): Song | null {
  if (typeof x !== 'object' || x === null) return null;
  const raw = x as Partial<Song>;
  if (typeof raw.id !== 'string') return null;

  const now = Date.now();
  const shared = parseSharedRef(raw.shared);
  const copiedFrom = parseCopiedFrom(raw.copiedFrom);
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
    // Left off entirely when absent, like `capo`: absent is the state.
    ...(shared ? { shared } : {}),
    ...(copiedFrom ? { copiedFrom } : {}),
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : now,
  };
}

export function serializeStore(store: SongStore): string {
  const stored: StoredV2 = {
    v: 2,
    songs: store.songs,
    currentId: store.currentId,
    unsynced: store.unsynced,
    playlists: store.playlists,
    unsyncedPlaylists: store.unsyncedPlaylists,
    chords: store.chords,
    unsyncedChords: store.unsyncedChords,
  };
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
    const ids = (x: unknown): string[] =>
      Array.isArray(x) ? x.filter((id): id is string => typeof id === 'string') : [];
    const playlists = Array.isArray(data.playlists)
      ? data.playlists.map(parsePlaylist).filter((p): p is Playlist => p !== null)
      : [];
    const chords = Array.isArray(data.chords)
      ? data.chords.map(parseMyChord).filter((c): c is MyChord => c !== null)
      : [];
    return {
      songs,
      currentId,
      unsynced: ids(data.unsynced),
      playlists,
      unsyncedPlaylists: ids(data.unsyncedPlaylists),
      chords,
      unsyncedChords: ids(data.unsyncedChords),
    };
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
    return { ...emptyStore(), songs: [song], currentId: song.id, unsynced: [song.id] };
  } catch {
    return null;
  }
}

/* --- Folding in the loose chords ----------------------------------------- */

/**
 * The loose chords as one song, or null if there is nothing worth keeping.
 * Everything is a song now, and these were somebody's work, so they become one
 * rather than being dropped with the store that held them. Chords keep their
 * ids. The capo starts unanswered, for the reason `migrateV1` gives.
 */
export function looseChordsToSong(raw: string | null): Song | null {
  if (!raw) return null;
  try {
    const chords = parseSavedChords(JSON.parse(raw) as unknown);
    if (!chords.length) return null;
    return { ...newSong(LOOSE_CHORDS_TITLE), chords };
  } catch {
    return null;
  }
}

/**
 * Puts the folded song at the top of the library, where it will be seen. It
 * does not steal the open song: it is present, not open. It is new to the
 * account, so it is listed as unconfirmed like any other new song.
 */
export function adoptLooseChords(store: SongStore, song: Song): SongStore {
  return {
    ...store,
    songs: [song, ...store.songs],
    currentId: store.currentId ?? song.id,
    unsynced: [...store.unsynced, song.id],
  };
}

/* --- Browser storage ----------------------------------------------------- */

function loadSongs(): SongStore {
  const existing = parseStore(window.localStorage.getItem(STORAGE_KEY));
  if (existing) return existing;

  const migrated = migrateV1(window.localStorage.getItem(LEGACY_KEY));
  if (migrated) {
    saveStore(migrated); // so the migration only runs once
    return migrated;
  }
  return emptyStore();
}

export function loadStore(): SongStore {
  try {
    let store = loadSongs();

    const rawLoose = window.localStorage.getItem(USER_CHORDS_KEY);
    if (rawLoose !== null) {
      const loose = looseChordsToSong(rawLoose);
      if (loose) {
        store = adoptLooseChords(store, loose);
        saveStore(store);
      }
      /* Removed, unlike LEGACY_KEY, which is left for a downgrade to find:
         the code that read this key is gone, so nothing could find it again —
         and leaving it would fold the same chords into a new song every load.
         Removed even when it held "[]", which the old hook wrote on every
         start whether or not a chord had ever been saved. */
      window.localStorage.removeItem(USER_CHORDS_KEY);
    }
    return store;
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
