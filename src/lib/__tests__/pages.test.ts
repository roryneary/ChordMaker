import { describe, expect, it } from 'vitest';
import {
  type PageItem,
  type FitSearch,
  clampSpread,
  fitStep,
  pageEnd,
  paginate,
  spreadBack,
  spreadForward,
  startFit,
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

describe('two pages, turned as a spread', () => {
  it('moves on two pages at a time, and stops at the last spread', () => {
    expect(spreadForward(0, 5)).toBe(2);
    expect(spreadForward(2, 5)).toBe(4);
    expect(spreadForward(4, 5)).toBe(4);
    expect(spreadForward(2, 4)).toBe(2);
    expect(spreadForward(0, 1)).toBe(0);
  });

  it('goes back two pages at a time, and stops at the first', () => {
    expect(spreadBack(4)).toBe(2);
    expect(spreadBack(2)).toBe(0);
    expect(spreadBack(0)).toBe(0);
  });

  it('keeps a valid spread when the pages are cut again', () => {
    expect(clampSpread(2, 5)).toBe(2);
    expect(clampSpread(4, 3)).toBe(2);
    expect(clampSpread(4, 4)).toBe(2);
    expect(clampSpread(3, 8)).toBe(2);
    expect(clampSpread(0, 1)).toBe(0);
  });
});

describe('fitting a song to two pages', () => {
  /** Steps the search as the screen does, with `pagesAt` standing in for the browser. */
  function fit(scale: number, floor: number, pagesAt: (s: number) => number) {
    let search: FitSearch = startFit(scale, floor);
    const drawn = [search.at];
    while (!search.done) {
      search = fitStep(search, pagesAt(search.at));
      drawn.push(search.at);
    }
    return { at: search.at, drawn };
  }
  /** A song `size` pages long at full size: pages shrink with the text. */
  const song = (size: number) => (s: number) => Math.ceil(size * s - 1e-9);

  it('leaves a song that already fits alone, drawn once', () => {
    expect(fit(1, 0.6, song(1.8))).toEqual({ at: 1, drawn: [1, 1] });
  });

  it('shrinks a longer song to the biggest size that makes two pages', () => {
    const { at } = fit(1, 0.6, song(2.6));
    expect(song(2.6)(at)).toBeLessThanOrEqual(2);
    expect(at).toBeGreaterThan(2 / 2.6 - 0.03);
    expect(at).toBeLessThanOrEqual(1);
  });

  it('stops at the floor and settles for the fewest spreads', () => {
    // Seven pages at full size is five at the floor: three spreads would do at 0.6,
    // but two spreads (four pages) are not reachable, so it keeps as big as six pages allow.
    const { at } = fit(1, 0.6, song(7));
    expect(song(7)(at)).toBeLessThanOrEqual(6);
    expect(at).toBeGreaterThan(6 / 7 - 0.03);
  });

  it("keeps the player's size when shrinking would not save a spread", () => {
    // Four pages at full size, three at the floor: two spreads either way.
    expect(fit(1, 0.6, song(4)).at).toBe(1);
  });

  it("never grows past the player's size or shrinks a size already under the floor", () => {
    expect(fit(0.5, 0.6, song(9)).at).toBe(0.5);
    expect(fit(1.25, 0.6, song(0.5)).at).toBe(1.25);
  });

  it('finds the size in a handful of draws', () => {
    expect(fit(1.4, 0.6, song(3)).drawn.length).toBeLessThanOrEqual(10);
  });
});
