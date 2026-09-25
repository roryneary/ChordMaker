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

/** Two pages showing, as `[left, right]` page numbers. */
export type PagePair = [number, number];

/**
 * Rolling pages: the page you have finished — the lower of the two — is the
 * one that turns, to the page after the higher. The page being read never
 * moves, so the tap can come any time while reading it. Unchanged at the end.
 */
export function rollForward([left, right]: PagePair, pageCount: number): PagePair {
  const next = Math.max(left, right) + 1;
  if (next >= pageCount) return [left, right];
  return left < right ? [next, right] : [left, next];
}

/** Back one: the higher page turns back to the one before the lower. */
export function rollBack([left, right]: PagePair): PagePair {
  const prev = Math.min(left, right) - 1;
  if (prev < 0) return [left, right];
  return left > right ? [prev, right] : [left, prev];
}

/**
 * The pair still valid after the pages were cut again (a new text size, a
 * resized window): the lower page is kept in view, the next beside it.
 */
export function clampPair([left, right]: PagePair, pageCount: number): PagePair {
  const low = Math.max(0, Math.min(Math.min(left, right), pageCount - 1));
  if (Math.max(left, right) < pageCount && Math.abs(left - right) === 1) return [left, right];
  return [low, low + 1];
}
