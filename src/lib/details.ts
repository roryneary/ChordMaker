import type { Song, SongDetail } from '../types/song';

/**
 * What a song is asked about when it is opened to edit and has not got it.
 * Only these two, on purpose: the capo has its own question on the song screen
 * (CapoChip), and a video or a key is too often not wanted to be worth asking.
 */
export const SONG_DETAILS: readonly SongDetail[] = ['artist', 'notes'];

export const DETAIL_LABEL: Record<SongDetail, string> = {
  artist: 'Who plays it',
  notes: 'Notes on how to play it',
};

/** Tolerant, like the rest of `parseSong`: anything not a known detail is dropped, once each. */
export function parseNotNeeded(x: unknown): SongDetail[] {
  if (!Array.isArray(x)) return [];
  return SONG_DETAILS.filter((d) => x.includes(d));
}

/** The details this song has not got and has not been said not to need. */
export function missingDetails(song: Song): SongDetail[] {
  const has: Record<SongDetail, boolean> = {
    artist: !!song.artist?.trim(),
    notes: !!song.notes?.length,
  };
  return SONG_DETAILS.filter((d) => !has[d] && !song.notNeeded?.includes(d));
}

/**
 * What to ask about as the song screen opens: the missing details of a song
 * that was made **before this session began** — one being come back to. A song
 * made a minute ago is still being written, and a prompt then would be asking
 * about what the player is about to type anyway.
 */
export function detailsToAsk(song: Song, sessionStart: number): SongDetail[] {
  return song.createdAt < sessionStart ? missingDetails(song) : [];
}
