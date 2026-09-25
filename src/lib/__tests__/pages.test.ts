import { describe, expect, it } from 'vitest';
import {
  type PageItem,
  clampPair,
  pageEnd,
  paginate,
  rollBack,
  rollForward,
  turnBack,
  turnForward,
} from '../pages';

/** Lines 40px tall with 10px between, a verse starting wherever `verses` says. */
function lines(count: number, verses: number[] = []): PageItem[] {
  return Array.from({ length: count }, (_, i) => ({
    top: i * 50,
    bottom: i * 50 + 40,
    stanza: verses.includes(i),
  }));
}

describe('cutting a song into pages', () => {
  it('fills a page with the lines that fit whole', () => {
    // 0..3 end at 190; line 4 ends at 240, past a 200px page.
    expect(pageEnd(lines(10), 0, 200)).toBe(4);
  });

  it('waits for a verse that starts low on the page', () => {
    // Line 3 starts at 150, 75% down a 200px page: it goes over whole.
    expect(pageEnd(lines(10, [3]), 0, 200)).toBe(3);
  });

  it('does not give up most of a page for a verse', () => {
    // Line 1 starts at 50, a quarter of the way down: not worth a turn.
    expect(pageEnd(lines(10, [1]), 0, 200)).toBe(4);
  });

  it('always moves on, even past a line taller than the page', () => {
    const tall = [{ top: 0, bottom: 900, stanza: false }, ...lines(3).map((l) => ({ ...l, top: l.top + 910, bottom: l.bottom + 910 }))];
    expect(pageEnd(tall, 0, 200)).toBe(1);
  });

  it('cuts the whole song and ends where the lines do', () => {
    expect(paginate(lines(10), 200)).toEqual([0, 4, 8]);
    expect(paginate(lines(3), 200)).toEqual([0]);
    expect(paginate([], 200)).toEqual([0]);
  });
});

describe('turning a scrolled column', () => {
  it('brings the last whole line to the top, marked', () => {
    expect(turnForward(lines(10), 0, 200)).toEqual({ to: 3, carried: [3, 3] });
  });

  it('turns on from wherever the player scrolled to', () => {
    // Scrolled to 120: line 2 (100–140) is cut at the top, line 5 (250–290) is the last whole.
    expect(turnForward(lines(10), 120, 200)).toEqual({ to: 5, carried: [5, 5] });
  });

  it('turns to a verse starting low, carrying what of it showed', () => {
    expect(turnForward(lines(10, [3]), 0, 200)).toEqual({ to: 3, carried: [3, 3] });
    // A verse that has not shown yet is not carried.
    expect(turnForward(lines(10, [4]), 0, 200)).toEqual({ to: 4, carried: null });
  });

  it('does nothing at the end', () => {
    expect(turnForward(lines(10), 300, 200)).toBeNull();
    expect(turnForward([], 0, 200)).toBeNull();
  });

  it('goes back so the top line becomes the last of the screen before', () => {
    // Line 6 at the top (300–340): the screen before runs 3..6.
    expect(turnBack(lines(10), 300, 200)).toBe(3);
    expect(turnBack(lines(10), 100, 200)).toBe(0);
    expect(turnBack(lines(10), 0, 200)).toBeNull();
  });
});

describe('rolling two pages', () => {
  it('turns the page you finished, never the one you are reading', () => {
    expect(rollForward([0, 1], 5)).toEqual([2, 1]);
    expect(rollForward([2, 1], 5)).toEqual([2, 3]);
    expect(rollForward([2, 3], 4)).toEqual([2, 3]);
  });

  it('turns back the same way', () => {
    expect(rollBack([2, 3])).toEqual([2, 1]);
    expect(rollBack([2, 1])).toEqual([0, 1]);
    expect(rollBack([0, 1])).toEqual([0, 1]);
  });

  it('keeps the lower page in view when the pages are cut again', () => {
    expect(clampPair([2, 1], 5)).toEqual([2, 1]);
    expect(clampPair([4, 5], 3)).toEqual([2, 3]);
    expect(clampPair([0, 1], 1)).toEqual([0, 1]);
  });
});
