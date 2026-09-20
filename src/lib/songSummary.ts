import type { Song } from '../types/song';
import { ordinal } from './numerals';
import { senderLabel } from './sharedSong';

/** "Five chords in · capo on the 2nd" — the line under a song's name in any list. */
export function songSubLine(song: Song): string {
  const bits: string[] = [];
  const n = song.chords.length;
  if (n) bits.push(`${n} chord${n === 1 ? '' : 's'} in`);
  if (song.capo) bits.push(`capo on the ${ordinal(song.capo)}`);
  // Whose it was, last: it is the player's song now, and that is a footnote.
  if (song.copiedFrom) bits.push(`from ${senderLabel(song.copiedFrom)}`);
  return bits.join(' · ') || 'Nothing in it yet';
}

/* There is deliberately no "how far along is it" tag. There was one — "Just
   chords", "Half done", "Ready" — and it called a song unfinished until every
   lyric line had a chord dropped on it. Dropping chords on words is a nice to
   have: a song can be complete with the shapes written into the words by hand,
   or with no words at all, and the tag had no way to know that. Nothing here
   judges a song; `songSubLine` says what is in it and leaves it at that. */
