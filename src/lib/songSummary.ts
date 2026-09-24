import type { Song } from '../types/song';
import { ordinal } from './numerals';
import { senderLabel } from './sharedSong';

/**
 * "Bob Dylan · 5 chords in · capo on the 2nd" — the line under a song's name in
 * any list. One function, so the song card, the playlist row and the add-songs
 * row all say the same thing about a song.
 *
 * Who plays it leads. In a list it is what tells two songs of the same name
 * apart, and it is what somebody scanning for a song actually remembers; the
 * counts behind it are detail. A song with nobody named simply starts at the
 * count, as every song did before the field existed.
 */
export function songSubLine(song: Song): string {
  const bits: string[] = [];
  const artist = song.artist?.trim();
  if (artist) bits.push(artist);
  const n = song.chords.length;
  if (n) bits.push(`${n} chord${n === 1 ? '' : 's'} in`);
  if (song.capo) bits.push(`capo on the ${ordinal(song.capo)}`);
  // Whose it was, last: it is the player's song now, and that is a footnote.
  if (song.copiedFrom) bits.push(`from ${senderLabel(song.copiedFrom)}`);
  return bits.join(' · ') || 'Nothing in it yet';
}

/**
 * No name, no artist, no words, no chords: what a start card leaves behind when
 * it is tapped and backed out of. The capo is not counted — an answer to "which
 * fret?" about a song with nothing in it is not something anyone would miss.
 * Who plays it is, because it is text somebody typed, and typed text is not
 * something this may throw away quietly.
 */
export function isBlankSong(song: Song): boolean {
  return (
    !song.title.trim() &&
    !song.artist?.trim() &&
    !song.lyric.trim() &&
    song.chords.length === 0
  );
}

/* There is deliberately no "how far along is it" tag. There was one — "Just
   chords", "Half done", "Ready" — and it called a song unfinished until every
   lyric line had a chord dropped on it. Dropping chords on words is a nice to
   have: a song can be complete with the shapes written into the words by hand,
   or with no words at all, and the tag had no way to know that. Nothing here
   judges a song; `songSubLine` says what is in it and leaves it at that. */

/**
 * Where opening a song goes. A song is opened to be played far more often than
 * to be changed, so the reading view is where it lands — unless there is
 * nothing on it to read yet, no words and no chords, in which case the only
 * useful thing to do with it is fill it in.
 */
export function playOrEdit(song: Song): 'play' | 'edit' {
  return song.words.length > 0 || song.chords.length > 0 ? 'play' : 'edit';
}
