/**
 * Turning the page in full screen, so a player moves on with one tap instead of
 * a scroll — a scroll wants a hand for as long as it takes, a tap for an instant.
 *
 * Everything here works on the song as drawn: a list of items (the notes panel,
 * then each line with words on it), each with its top and bottom in pixels down
 * the column, and whether it opens a verse (a blank line came before it). The
 * component measures; these decide.
 */
export interface PageItem {
  top: number;
  bottom: number;
  /** A blank line came before it: the start of a verse, the best place to turn. */
  stanza: boolean;
}

/**
 * How far down the page a verse must start for the turn to wait for it. A
 * verse that starts below 40% goes to the top of the next page whole, rather
 * than having its first lines at the foot of this one; any higher and waiting
 * would throw away most of the page. Low on purpose: at 60%, four-line verses
 * on a seven-line page came out split every other page, and a verse cut in two
 * is exactly where a player loses their place.
 */
const STANZA_REACH = 0.4;

/** The last verse start in (from, to], at least `reach` below `origin`; -1 if none. */
function stanzaBreak(items: PageItem[], from: number, to: number, origin: number, reach: number): number {
  for (let j = Math.min(to, items.length - 1); j > from; j--) {
    if (items[j].stanza && items[j].top - origin >= reach) return j;
  }
  return -1;
}

/**
 * The page that starts at item `start`, `height` tall: the index of the first
 * item on the *next* page. Always moves on by at least one item — a line taller
 * than the page gets a page to itself, clipped, rather than stopping the song.
 */
export function pageEnd(items: PageItem[], start: number, height: number): number {
  const limit = items[start].top + height;
  let end = start + 1;
  while (end < items.length && items[end].bottom <= limit) end++;
  if (end >= items.length) return items.length;
  const verse = stanzaBreak(items, start, end, items[start].top, height * STANZA_REACH);
  return verse > 0 ? verse : end;
}

/** Where every page starts, for a song cut into pages `height` tall. */
export function paginate(items: PageItem[], height: number): number[] {
  if (items.length === 0 || height <= 0) return [0];
  const starts = [0];
  let end = pageEnd(items, 0, height);
  while (end < items.length) {
    starts.push(end);
    end = pageEnd(items, end, height);
  }
  return starts;
}

export interface Turn {
  /** The item to bring to the top of the screen. */
  to: number;
  /** Items on the new screen that were on the old one: `[from, through]`, or null. */
  carried: [number, number] | null;
}

/**
 * One column, scrolled: move on by a screenful less what the eye needs to find
 * its place. Works from where the column actually is, so a player who scrolled
 * by hand is turned on from there. Null at the end — nothing more to show.
 *
 * The last whole line on the screen comes to the top, marked, so it is where
 * you were rather than somewhere to find. When a verse starts low on the
 * screen the turn goes to that verse instead, and it and anything after it
 * that was showing are what is carried.
 */
export function turnForward(items: PageItem[], viewTop: number, viewHeight: number): Turn | null {
  if (items.length === 0) return null;
  const viewBottom = viewTop + viewHeight;
  let first = items.findIndex((it) => it.bottom > viewTop + 1);
  if (first < 0) return null;
  let lastWhole = first - 1;
  while (lastWhole + 1 < items.length && items[lastWhole + 1].bottom <= viewBottom) lastWhole++;
  if (lastWhole >= items.length - 1) return null;
  if (lastWhole < first) {
    // One item taller than the screen: step past it.
    return { to: first + 1, carried: null };
  }
  const verse = stanzaBreak(items, first, lastWhole + 1, viewTop, viewHeight * STANZA_REACH);
  if (verse > 0) {
    return { to: verse, carried: verse <= lastWhole ? [verse, lastWhole] : null };
  }
  if (lastWhole === first) return { to: first + 1, carried: null };
  return { to: lastWhole, carried: [lastWhole, lastWhole] };
}

/**
 * Back a screenful: the line now at the top becomes the last line of the screen
 * before, so the two overlap by one as a forward turn does. Null at the top.
 * Returns the item to bring to the top; 0 means the very top of the column.
 */
export function turnBack(items: PageItem[], viewTop: number, viewHeight: number): number | null {
  if (items.length === 0 || viewTop <= 1) return null;
  let first = items.findIndex((it) => it.bottom > viewTop + 1);
  if (first < 0) first = items.length - 1;
  let s = first;
  while (s > 0 && items[first].bottom - items[s - 1].top <= viewHeight) s--;
  if (s === first && first > 0) s = first - 1;
  return s;
}

/**
 * Two pages side by side, read like a book: the spread is named by its left
 * page, always even, and the right page is the one after it. A turn moves the
 * whole spread, two pages at a time — so what the player sees next is always
 * the next two pages in order, never one old and one new.
 */
export function spreadForward(left: number, pageCount: number): number {
  const next = left + 2;
  return next < pageCount ? next : left;
}

/** Back a spread; unchanged at the start. */
export function spreadBack(left: number): number {
  return left >= 2 ? left - 2 : left;
}

/**
 * The spread still valid after the pages were cut again (a new text size, a
 * resized window): the one holding the same left page if it still exists,
 * otherwise the last spread.
 */
export function clampSpread(left: number, pageCount: number): number {
  const last = Math.max(0, pageCount - 1);
  const page = Math.max(0, Math.min(left, last));
  return page - (page % 2);
}

/**
 * Two pages, fitted: the text size that puts the whole song on one spread, so
 * nothing is turned mid-song at all. Shrinks only — the player's own size is
 * the most it will be — and never below `floor`, past which a stand is too far
 * away to read. A song too long even then gets the fewest spreads it can, at
 * the biggest size that still makes that few.
 *
 * Only the browser knows how tall a wrapped line is at a size, so this is a
 * search the screen steps: draw at `at`, count the pages, hand the count to
 * `fitStep`, draw at the next `at`, until `done`.
 */
export interface FitSearch {
  /** The size to draw at now. */
  at: number;
  /** Known to fit the target (or the floor, before anything is known). */
  lo: number;
  /** Known not to fit. */
  hi: number;
  /** Pages at the player's own size, once counted. */
  topPages: number | null;
  /** Pages allowed: two, or the fewest whole spreads the floor manages. */
  target: number | null;
  done: boolean;
}

/** Close enough: a step smaller than this is not one anyone can see. */
const FIT_PRECISION = 0.02;

/** Start at the player's own size; most songs fit there and the search ends at once. */
export function startFit(scale: number, floor: number): FitSearch {
  return { at: scale, lo: Math.min(floor, scale), hi: scale, topPages: null, target: null, done: false };
}

/** One step: `pages` is how many pages the song came to at `fit.at`. */
export function fitStep(fit: FitSearch, pages: number): FitSearch {
  if (fit.done) return fit;
  if (fit.topPages === null) {
    // At the player's size: fits, or cannot shrink, and it is settled.
    if (pages <= 2 || fit.at <= fit.lo) return { ...fit, topPages: pages, done: true };
    return { ...fit, topPages: pages, at: fit.lo };
  }
  if (fit.target === null) {
    // At the floor: as few spreads as it is ever going to be.
    const target = Math.max(2, Math.ceil(pages / 2) * 2);
    if (fit.topPages <= target) return { ...fit, target, at: fit.hi, done: true };
    return next({ ...fit, target });
  }
  return next(pages <= fit.target ? { ...fit, lo: fit.at } : { ...fit, hi: fit.at });
}

function next(fit: FitSearch): FitSearch {
  if (fit.hi - fit.lo <= FIT_PRECISION) return { ...fit, at: fit.lo, done: true };
  return { ...fit, at: Math.round(((fit.lo + fit.hi) / 2) * 1000) / 1000 };
}
