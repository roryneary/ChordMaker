import type { SavedChord, Song } from '../types/song';

/**
 * The song's chords in the order they are first played: by the first word each
 * is dropped on, reading the words from the top. A chord not on any word keeps
 * its place relative to the other unplaced ones, after all the placed ones —
 * it is in the song for a reason (a bridge not typed in yet, say), just not one
 * the words can say where.
 *
 * Hands back the same array when that is already the order, so the reducer can
 * tell "Order as played" on an ordered song apart from an edit.
 */
export function orderByFirstUse(song: Pick<Song, 'chords' | 'words' | 'placements'>): SavedChord[] {
  const first = new Map<string, number>();
  song.words.forEach((word, i) => {
    const chordId = song.placements[word.id];
    if (chordId && !first.has(chordId)) first.set(chordId, i);
  });

  const ordered = song.chords
    .map((chord, i) => ({ chord, i, at: first.get(chord.id) ?? Number.POSITIVE_INFINITY }))
    .sort((a, b) => a.at - b.at || a.i - b.i)
    .map((entry) => entry.chord);

  return ordered.every((chord, i) => chord === song.chords[i]) ? song.chords : ordered;
}
