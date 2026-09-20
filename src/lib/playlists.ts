import type { Playlist, PlaylistItem } from '../types/playlist';
import type { Song } from '../types/song';
import { newId } from './id';

/**
 * Everything about playlists that is not state: what a legal name is, which
 * playlists a song is in, what a playlist's items resolve to. The reducer in
 * `useSongs` holds the invariants and calls into here; the screens read through
 * here so none of them walks `items` on its own.
 */

/** Trimmed, and runs of whitespace collapsed, so "Wedding  set " is "Wedding set". */
export const cleanPlaylistName = (name: string): string => name.trim().replace(/\s+/g, ' ');

/**
 * Two playlists with one name are two pills nobody can tell apart on a song
 * row, so a name is unique — compared the way a person reads it, ignoring case.
 * `exceptId` is the playlist being renamed, which may keep its own name.
 */
export function playlistNameTaken(
  playlists: readonly Playlist[],
  name: string,
  exceptId?: string,
): boolean {
  const wanted = cleanPlaylistName(name).toLowerCase();
  return playlists.some((p) => p.id !== exceptId && p.name.toLowerCase() === wanted);
}

export const newItem = (songId: string): PlaylistItem => ({ id: newId(), songId });

export function newPlaylist(name: string, songIds: readonly string[] = []): Playlist {
  const now = Date.now();
  return {
    id: newId(),
    name: cleanPlaylistName(name),
    items: songIds.map(newItem),
    createdAt: now,
    updatedAt: now,
  };
}

/* --- Defensive parsing: the sibling of `parseSong` in storage.ts ---------- */

const isItem = (x: unknown): x is PlaylistItem =>
  typeof x === 'object' &&
  x !== null &&
  typeof (x as PlaylistItem).id === 'string' &&
  typeof (x as PlaylistItem).songId === 'string';

export function parsePlaylist(x: unknown): Playlist | null {
  if (typeof x !== 'object' || x === null) return null;
  const raw = x as Partial<Playlist>;
  if (typeof raw.id !== 'string') return null;

  const now = Date.now();
  return {
    id: raw.id,
    name: typeof raw.name === 'string' ? raw.name : '',
    // Only the two fields that mean anything, so a stray key in a stored item
    // does not ride along into every later write.
    items: Array.isArray(raw.items)
      ? raw.items.filter(isItem).map(({ id, songId }) => ({ id, songId }))
      : [],
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : now,
  };
}

/* --- Reading --------------------------------------------------------------- */

/** One pill on a song row: a playlist the song is in, and where in it. */
export interface Membership {
  playlistId: string;
  name: string;
  /** The song's first entry there — what opening the pill scrolls to. */
  itemId: string;
}

/**
 * songId → the playlists holding it, in the order the playlists are listed.
 * One entry per playlist however many times the song appears in it: the pill
 * says "in this set", not how often. Built once per render of a list, from
 * data already in memory — this is the lookup that cost StreetPerformer a
 * Firestore query per song.
 */
export function membershipBySong(playlists: readonly Playlist[]): Map<string, Membership[]> {
  const out = new Map<string, Membership[]>();
  for (const p of playlists) {
    const seen = new Set<string>();
    for (const item of p.items) {
      if (seen.has(item.songId)) continue;
      seen.add(item.songId);
      const list = out.get(item.songId) ?? [];
      list.push({ playlistId: p.id, name: p.name, itemId: item.id });
      out.set(item.songId, list);
    }
  }
  return out;
}

export interface ResolvedItem {
  item: PlaylistItem;
  song: Song;
}

/**
 * A playlist's items with their songs, in running order. An item whose song is
 * not here is skipped rather than rendered as a hole: `DELETE_SONG` sweeps
 * playlists on this device, but a playlist can still arrive from the account
 * naming a song another device deleted.
 */
export function resolveItems(playlist: Playlist, songs: readonly Song[]): ResolvedItem[] {
  const byId = new Map(songs.map((s) => [s.id, s] as const));
  const out: ResolvedItem[] = [];
  for (const item of playlist.items) {
    const song = byId.get(item.songId);
    if (song) out.push({ item, song });
  }
  return out;
}

/* --- Changing -------------------------------------------------------------- */

/** `items` with one entry moved to index `to`, or the same array if nothing moves. */
export function moveItem(items: PlaylistItem[], itemId: string, to: number): PlaylistItem[] {
  const from = items.findIndex((i) => i.id === itemId);
  if (from === -1) return items;
  const target = Math.max(0, Math.min(to, items.length - 1));
  if (target === from) return items;
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return next;
}

/** `items` without any entry for `songId`, or the same array if it held none. */
export function withoutSong(items: PlaylistItem[], songId: string): PlaylistItem[] {
  return items.some((i) => i.songId === songId) ? items.filter((i) => i.songId !== songId) : items;
}

/* --- Finding a song to add -------------------------------------------------- */

/** Case-insensitive, every typed word somewhere in the title. Blank matches all. */
export function matchesQuery(song: Song, query: string): boolean {
  const title = song.title.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => title.includes(word));
}
