import { newId } from './id';
import type { Placements, Word } from '../types/song';

/**
 * The lyric is one raw string with its line breaks preserved verbatim — that is
 * the only structural markup the song has. A blank line becomes a gap on the
 * sheet and in full screen; there are no named sections.
 *
 * Chords attach to WORDS, not to offsets. Word indices break the moment someone
 * inserts a word earlier in the line, and character offsets break on any edit at
 * all — so each word carries an id minted at paste time, and an edit re-matches
 * the new text against the old words to carry those ids across. That is what
 * makes the promise on the words editor true: chords you have already placed
 * stay put when you edit the words.
 */

/** Splits on any run of whitespace; punctuation stays attached to its word. */
const WORD_SPLIT = /\s+/;

export function tokenise(text: string): Word[] {
  const words: Word[] = [];
  text.split('\n').forEach((raw, line) => {
    raw
      .trim()
      .split(WORD_SPLIT)
      .filter(Boolean)
      .forEach((word) => words.push({ id: newId(), line, text: word }));
  });
  return words;
}

export const lineCount = (text: string): number => text.split('\n').length;

/** Lines of words, blank lines included as empty arrays so gaps still render. */
export function groupByLine(words: Word[], lines: number): Word[][] {
  const out: Word[][] = Array.from({ length: Math.max(lines, 0) }, () => []);
  for (const w of words) {
    if (w.line >= 0 && w.line < out.length) out[w.line].push(w);
  }
  return out;
}

const isBlank = (line: string): boolean => line.trim() === '';

/** Blank lines a tidy could take out — what the words editor's button counts. */
export const blankLineCount = (text: string): number =>
  text.trim() ? text.split('\n').filter(isBlank).length : 0;

/**
 * Takes the blank lines out of a pasted lyric, and tries not to take the verse
 * breaks with them.
 *
 * A lyrics site very often double-spaces everything: a blank after every line,
 * two or more between verses. There the single blanks are noise and the longer
 * runs are the structure, so every gap loses the noise and what is left of it is
 * capped at one line. A lyric that is not double-spaced has nothing to tell the
 * two apart by, so its blanks all go. Either way a press always removes
 * something, and pressing again after the first case takes the verse breaks too.
 *
 * Blank lines before the first words and after the last always go. No word is
 * touched and none changes order, so `retokenise` carries every id across and
 * placed chords stay where they are.
 */
export function removeBlankLines(text: string): string {
  const lines = text.split('\n');
  const content: string[] = [];
  /** `gaps[i]` is how many blank lines sat between `content[i]` and the next. */
  const gaps: number[] = [];
  let run = 0;
  for (const line of lines) {
    if (isBlank(line)) {
      run++;
      continue;
    }
    if (content.length) gaps.push(run);
    content.push(line);
    run = 0;
  }
  if (!content.length) return '';

  const noise = gaps.length ? Math.min(...gaps) : 0;
  const out: string[] = [];
  content.forEach((line, i) => {
    out.push(line);
    if (i < gaps.length && noise > 0 && gaps[i] > noise) out.push('');
  });
  return out.join('\n');
}

/**
 * The first `limit` lines *with words on them*, blank gaps kept between them
 * for spacing but never spending the budget. Used to build a short preview
 * (`SongScreen`'s three-line card) without a leading or interspersed blank
 * line — extremely common in anything pasted from a lyrics site — burning the
 * whole preview on gaps and showing nothing.
 */
export function firstLinesWithContent(lines: Word[][], limit: number): Word[][] {
  const out: Word[][] = [];
  let withContent = 0;
  for (const line of lines) {
    out.push(line);
    if (line.length > 0 && ++withContent >= limit) break;
  }
  return out;
}

/**
 * Longest common subsequence over the two word sequences, as a map from index
 * in `b` to the index in `a` it matches. Anything unmatched in `b` is genuinely
 * new text and earns a fresh id.
 *
 * O(n·m) in time and memory, which is nothing at lyric scale — a long song is a
 * few hundred words. Past the guard below we stop paying for exactness, because
 * a table that size means the text is not a lyric any more.
 */
const LCS_LIMIT = 2000;

export function lcsPairs(a: string[], b: string[]): Map<number, number> {
  const pairs = new Map<number, number>();
  if (!a.length || !b.length) return pairs;

  if (a.length > LCS_LIMIT || b.length > LCS_LIMIT) {
    // Greedy fallback: walk both in order, matching equal words as they come.
    let i = 0;
    for (let j = 0; j < b.length && i < a.length; j++) {
      if (a[i] === b[j]) pairs.set(j, i++);
    }
    return pairs;
  }

  const rows = a.length + 1;
  const cols = b.length + 1;
  const table = new Uint32Array(rows * cols);

  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * cols + j] =
        a[i] === b[j]
          ? table[(i + 1) * cols + (j + 1)] + 1
          : Math.max(table[(i + 1) * cols + j], table[i * cols + (j + 1)]);
    }
  }

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      pairs.set(j, i);
      i++;
      j++;
    } else if (table[(i + 1) * cols + j] >= table[i * cols + (j + 1)]) {
      i++;
    } else {
      j++;
    }
  }
  return pairs;
}

/**
 * Re-tokenise an edited lyric, carrying word ids across the edit wherever the
 * text still lines up.
 */
export function retokenise(previous: Word[], text: string): Word[] {
  const next = tokenise(text);
  if (!previous.length || !next.length) return next;

  const pairs = lcsPairs(
    previous.map((w) => w.text),
    next.map((w) => w.text),
  );

  return next.map((w, index) => {
    const match = pairs.get(index);
    return match === undefined ? w : { ...w, id: previous[match].id };
  });
}

/** Drops placements whose word did not survive the edit. */
export function prunePlacements(placements: Placements, words: Word[]): Placements {
  const live = new Set(words.map((w) => w.id));
  const out: Placements = {};
  for (const [wordId, chordId] of Object.entries(placements)) {
    if (live.has(wordId)) out[wordId] = chordId;
  }
  return out;
}

/** Also drops placements pointing at a chord that has been removed from the song. */
export function pruneToChords(placements: Placements, chordIds: string[]): Placements {
  const live = new Set(chordIds);
  const out: Placements = {};
  for (const [wordId, chordId] of Object.entries(placements)) {
    if (live.has(chordId)) out[wordId] = chordId;
  }
  return out;
}

/**
 * How many lyric lines carry no chord yet — the "6 lines to chord" readout, and
 * what the landing screen's progress tag is derived from.
 */
export function unchordedLineCount(
  words: Word[],
  placements: Placements,
  lines: number,
): number {
  const chorded = new Set<number>();
  for (const w of words) {
    if (placements[w.id]) chorded.add(w.line);
  }
  let count = 0;
  const grouped = groupByLine(words, lines);
  grouped.forEach((lineWords, index) => {
    // A blank line is a gap, not a line waiting for chords.
    if (lineWords.length > 0 && !chorded.has(index)) count++;
  });
  return count;
}
