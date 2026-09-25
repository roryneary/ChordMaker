import type { Word } from '../types/song';

/**
 * Chords typed into the lyric as a line of their own — "G / Bm7 / Am7 / C/D" —
 * the way a sheet is written by hand, and the way StreetPerformer kept every
 * song. They are lyric text like any other, so nothing in the song says which
 * lines they are; this tells them from the words, so the reading view can draw
 * them as chords, or leave them out when only the words are wanted.
 *
 * Deliberately a guess about text, not a speller: it answers "is this line
 * chords", never "what chord is this".
 */

/** Root, quality, extensions, optional bass: G, F#m7, Cmaj7, Dsus4, Bb, G/B, E7b9, Aadd9. */
const CHORD = /^[A-G][#b♯♭]?(?:maj|min|m|dim|aug|sus|add|M|\+|°|ø)?(?:[#b♯♭]?\d{1,2}|maj\d{1,2}|sus\d|add\d{1,2}|\+|°)*(?:\/[A-G][#b♯♭]?)?$/;

/** What else turns up on a chord line: bar lines, beat slashes, repeats, no-chord. */
const FILLER = /^(?:\||\|\||\/+|-+|\.+|:?\|:?|x\d+|\d+x|n\.?c\.?)$/i;

/** One token of a line: a chord symbol, optionally in brackets. */
export function isChordToken(text: string): boolean {
  const bare = text.replace(/^\(+|\)+$/g, '');
  return bare !== '' && CHORD.test(bare);
}

/**
 * Whether a line of the lyric is chords rather than words.
 *
 * More than one "/" anywhere on it settles it: beat slashes and slash chords are
 * how a chord line is written, and words almost never carry two. Otherwise every
 * token has to be a chord or chord-line filler, with at least one real chord — a
 * line of just "x2" is not chords. A lyric line that is only "A" reads as a chord:
 * the one ambiguity, accepted.
 */
export function isChordLine(words: readonly Pick<Word, 'text'>[]): boolean {
  if (words.length === 0) return false;
  const slashes = words.reduce((n, w) => n + (w.text.match(/\//g)?.length ?? 0), 0);
  if (slashes > 1) return true;
  let chords = 0;
  for (const { text } of words) {
    if (isChordToken(text)) chords++;
    else if (!FILLER.test(text)) return false;
  }
  return chords > 0;
}

/**
 * The lines with the typed chord lines taken out, as the reading view shows
 * words only. Taking out an intro line that stood between two gaps would leave
 * a double gap, so runs of blank lines close up to one, and none are left at
 * the top or bottom.
 */
export function wordsOnly(lines: Word[][]): Word[][] {
  const out: Word[][] = [];
  for (const line of lines) {
    if (line.length === 0) {
      if (out.length > 0 && out[out.length - 1].length > 0) out.push(line);
    } else if (!isChordLine(line)) {
      out.push(line);
    }
  }
  while (out.length > 0 && out[out.length - 1].length === 0) out.pop();
  return out;
}
