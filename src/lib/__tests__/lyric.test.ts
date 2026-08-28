import { describe, expect, it } from 'vitest';
import {
  groupByLine,
  lineCount,
  prunePlacements,
  retokenise,
  tokenise,
  unchordedLineCount,
} from '../lyric';
import type { Placements } from '../../types/song';

const LYRIC = ['the harbour lights are on', '', 'and the last boat leaves at nine'].join('\n');

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
