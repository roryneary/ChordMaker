import type { Song } from '../types/song';

/**
 * Which songs were opened last, on this device.
 *
 * It is not in the song and not in the store. Opening a song to play it is not
 * an edit: stamping `updatedAt` for it would send a write to the account every
 * time a sheet was read, and tell everyone holding a copy of a shared song that
 * it had changed. So it is a list of ids beside the store, like a remembered
 * sort order — about this device's use of the songs, not about the songs.
 *
 * An id with no song behind it (deleted, or another account's) is never a
 * problem: `recentSongs` skips it, so nothing has to keep the two in step.
 */
export const RECENT_KEY = 'chord-builder:recent:v1';

/** Far more than any screen shows, so deleting a few recent songs does not empty the list. */
const KEPT = 24;

/** The list with `id` at the front. The same array back if it is already there. */
export function bumpRecent(recent: readonly string[], id: string): readonly string[] {
  if (recent[0] === id) return recent;
  return [id, ...recent.filter((r) => r !== id)].slice(0, KEPT);
}

/**
 * The `n` songs to offer first: the ones opened last, in that order, then —
 * if that is not enough — the rest by last edit. The second half is what
 * someone sees who has opened nothing since this list existed, or who has just
 * signed in on a new device: their latest work, not an empty shelf.
 */
export function recentSongs(songs: readonly Song[], recent: readonly string[], n: number): Song[] {
  const byId = new Map(songs.map((s) => [s.id, s] as const));
  const seen = new Set<string>();
  const opened: Song[] = [];
  for (const id of recent) {
    const song = byId.get(id);
    // A stored list is only as good as whatever wrote it: an id twice is one song.
    if (!song || seen.has(id)) continue;
    seen.add(id);
    opened.push(song);
  }
  const rest = songs.filter((s) => !seen.has(s.id)).sort((a, b) => b.updatedAt - a.updatedAt);
  return [...opened, ...rest].slice(0, n);
}

export function parseRecent(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    return Array.isArray(data) ? data.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}
