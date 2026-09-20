import { describe, expect, it } from 'vitest';
import {
  blankLineCount,
  firstLinesWithContent,
  groupByLine,
  lineCount,
  prunePlacements,
  removeBlankLines,
  retokenise,
  tokenise,
  unchordedLineCount,
} from '../lyric';
import type { Placements } from '../../types/song';

const LYRIC = ['the harbour lights are on', '', 'and the last boat leaves at nine'].join('\n');

describe('firstLinesWithContent', () => {
  it('does not let a leading blank line burn the preview budget', () => {
    // Exactly the shape a lyric pasted from a lyrics site tends to have: a
    // blank line before the words start. SongScreen's card should still show
    // real lines, not spend its first slot on the gap.
    const lyric = ['', 'G / Bm7 / Am7 / C/D', 'walking home in the rain'].join('\n');
    const grouped = groupByLine(tokenise(lyric), lineCount(lyric));
    const shown = firstLinesWithContent(grouped, 2);
    // The gap is kept for spacing, but both real lines made it in — a raw
    // index slice of the same length would have shown only the gap and the
    // first real line.
    expect(shown).toHaveLength(3);
    expect(shown[0]).toEqual([]);
    expect(shown[1].length).toBeGreaterThan(0);
    expect(shown[2].length).toBeGreaterThan(0);
  });

  it('stops right after the Nth line with words, not before or after', () => {
    const lyric = ['one', 'two', 'three', 'four'].join('\n');
    const grouped = groupByLine(tokenise(lyric), lineCount(lyric));
    expect(firstLinesWithContent(grouped, 2)).toHaveLength(2);
  });

  it('a limit no lyric can reach just returns everything', () => {
    const lyric = 'only one line here';
    const grouped = groupByLine(tokenise(lyric), lineCount(lyric));
    expect(firstLinesWithContent(grouped, 10)).toEqual(grouped);
  });
});

describe('tokenise', () => {
  it('keeps line breaks verbatim, blank lines included', () => {
    const words = tokenise(LYRIC);
    expect(lineCount(LYRIC)).toBe(3);
    expect(words.filter((w) => w.line === 0).map((w) => w.text)).toEqual([
      'the',
      'harbour',
      'lights',
      'are',
      'on',
    ]);
    // Line 1 is blank — it becomes a gap on the sheet, not a line of words.
    expect(words.some((w) => w.line === 1)).toBe(false);
    expect(words.filter((w) => w.line === 2)).toHaveLength(7);
  });

  it('groups back into lines, preserving the gap', () => {
    const grouped = groupByLine(tokenise(LYRIC), lineCount(LYRIC));
    expect(grouped).toHaveLength(3);
    expect(grouped[1]).toEqual([]);
  });

  it('gives every word its own id', () => {
    const words = tokenise('la la la');
    expect(new Set(words.map((w) => w.id)).size).toBe(3);
  });
});

describe('removeBlankLines', () => {
  it('takes the noise out of a double-spaced paste and keeps the verse breaks', () => {
    // A blank after every line, two between verses — a lyrics site's shape.
    const pasted = ['', 'one', '', 'two', '', '', 'three', '', 'four', '', ''].join('\n');
    expect(removeBlankLines(pasted)).toBe(['one', 'two', '', 'three', 'four'].join('\n'));
  });

  it('removes every blank when the paste is evenly double-spaced', () => {
    expect(removeBlankLines('one\n\ntwo\n\nthree')).toBe('one\ntwo\nthree');
  });

  it('removes every blank when there is nothing to tell a verse break by', () => {
    // Not double-spaced, so a second press on the first case lands here too.
    expect(removeBlankLines('one\ntwo\n\nthree\n\n\nfour')).toBe('one\ntwo\nthree\nfour');
  });

  it('counts a line of only spaces as blank', () => {
    expect(blankLineCount('one\n   \ntwo')).toBe(1);
    expect(removeBlankLines('one\n   \ntwo')).toBe('one\ntwo');
  });

  it('always removes something when there is something to remove', () => {
    for (const text of ['\none', 'one\n\ntwo', 'one\n\ntwo\n\n\nthree', 'one\ntwo\n']) {
      expect(blankLineCount(removeBlankLines(text))).toBeLessThan(blankLineCount(text));
    }
  });

  it('leaves nothing to count in an empty lyric', () => {
    expect(blankLineCount('\n\n')).toBe(0);
    expect(removeBlankLines('\n\n')).toBe('');
  });

  it('keeps every word id, so placed chords stay put', () => {
    const pasted = 'G / Am7\n\nknow it sounds funny\n\n\nbut I just';
    const before = tokenise(pasted);
    const after = retokenise(before, removeBlankLines(pasted));
    expect(after.map((w) => w.id)).toEqual(before.map((w) => w.id));
    expect(after.map((w) => w.line)).toEqual([0, 0, 0, 1, 1, 1, 1, 3, 3, 3]);
  });
});

/* This is the promise the words editor makes in so many words: "Chords you've
   already placed stay put when you edit the words." */
describe('retokenise', () => {
  it('keeps ids for words that survive an edit', () => {
    const before = tokenise(LYRIC);
    const after = retokenise(before, LYRIC.replace('nine', 'ten'));

    // Positionally, not by text: "the" appears twice in this lyric.
    expect(after).toHaveLength(before.length);
    const last = before.length - 1;
    before.slice(0, last).forEach((word, i) => {
      expect(after[i].id).toBe(word.id);
    });
    // Only the changed word is new.
    expect(after[last].text).toBe('ten');
    expect(after[last].id).not.toBe(before[last].id);
  });

  it('survives a word inserted earlier in the line', () => {
    const before = tokenise('the lights are on');
    const after = retokenise(before, 'the harbour lights are on');
    const id = (words: typeof before, text: string) =>
      words.find((w) => w.text === text)?.id;

    for (const text of ['the', 'lights', 'are', 'on']) {
      expect(id(after, text)).toBe(id(before, text));
    }
  });

  it('survives a whole line inserted above', () => {
    const before = tokenise(LYRIC);
    const after = retokenise(before, `a new first line\n${LYRIC}`);
    const boat = before.find((w) => w.text === 'boat');
    const movedBoat = after.find((w) => w.text === 'boat');

    expect(movedBoat?.id).toBe(boat?.id);
    // …even though it is now on a different line.
    expect(movedBoat?.line).toBe((boat?.line ?? 0) + 1);
  });

  it('carries placements across an edit, dropping only deleted words', () => {
    const before = tokenise(LYRIC);
    const ids = new Map(before.map((w) => [w.text, w.id]));
    const placements: Placements = {
      [ids.get('harbour')!]: 'chord-g',
      [ids.get('nine')!]: 'chord-d',
    };

    const after = retokenise(before, LYRIC.replace('nine', 'ten'));
    const pruned = prunePlacements(placements, after);

    expect(pruned[ids.get('harbour')!]).toBe('chord-g');
    expect(pruned[ids.get('nine')!]).toBeUndefined();
  });

  it('mints fresh ids when the lyric shares no words with the old one', () => {
    const before = tokenise(LYRIC);
    const after = retokenise(before, 'wholly different words replace everything');
    const olds = new Set(before.map((w) => w.id));
    expect(after.every((w) => !olds.has(w.id))).toBe(true);
  });
});

describe('unchordedLineCount', () => {
  it('counts lines with no chord, ignoring blank ones', () => {
    const words = tokenise(LYRIC);
    const lines = lineCount(LYRIC);
    expect(unchordedLineCount(words, {}, lines)).toBe(2);

    const first = words.find((w) => w.text === 'harbour')!;
    expect(unchordedLineCount(words, { [first.id]: 'chord-g' }, lines)).toBe(1);
  });
});
