import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  ArrowsIn,
  ArrowsInLineVertical,
  ArrowsInSimple,
  ArrowsOut,
  Columns,
  GearSix,
  MusicNotesSimple,
  PencilSimple,
  Rows,
  Sun,
  TextAa,
} from '@phosphor-icons/react';
import CapoChip from '../components/CapoChip';
import ChordDiagram from '../components/ChordDiagram';
import TextSize from '../components/TextSize';
import LyricBlock from '../components/lyric/LyricBlock';
import { useIsDesktop, useTwoPagesFit } from '../components/shell/useBreakpoint';
import { usePrefs } from '../hooks/usePrefs';
import { isChordLine, wordsOnly } from '../lib/chordLines';
import { groupByLine, lineCount } from '../lib/lyric';
import { NOTE_KIND_LABEL, notesByWord, songWideNotes } from '../lib/notes';
import { VideoLink } from '../components/SongVideos';
import {
  type FitSearch,
  type PageItem,
  clampSpread,
  fitStep,
  paginate,
  spreadBack,
  spreadForward,
  startFit,
  turnBack,
  turnForward,
} from '../lib/pages';
import { readingSizes } from '../lib/prefs';
import type { Placements, Song } from '../types/song';

interface Props {
  song: Song;
  nameOf: (chordId: string) => string | null;
  onExit: () => void;
  /** To the song screen. Absent for a song that is not yours to change yet. */
  onEdit?: () => void;
  /** A line over the title, such as whose song this is. */
  kicker?: ReactNode;
  /** Above the bottom bar: "Add to my songs", say, for a song someone sent. */
  action?: ReactNode;
}

/**
 * The browser's own full screen: no address bar, no tabs, every pixel for the
 * song. Not every browser lets a page ask (an iPhone does not, outside video),
 * so where it cannot the button is not drawn rather than drawn and refused.
 */
function useFillScreen(): { can: boolean; on: boolean; toggle: () => void } {
  const can = typeof document !== 'undefined' && document.fullscreenEnabled === true;
  const [on, setOn] = useState(() => can && !!document.fullscreenElement);

  useEffect(() => {
    if (!can) return;
    const onChange = () => setOn(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      // Leaving the song leaves full screen: the rest of the app has chrome.
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [can]);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  return { can, on, toggle };
}

const NOTES_OPEN_KEY = 'chord-builder:fs-notes-open:v1';
const TWO_PAGES_KEY = 'chord-builder:fs-two-pages:v1';
const TURNED_KEY = 'chord-builder:fs-turned:v1';
const CHORDS_SHOWN_KEY = 'chord-builder:fs-chords-shown:v1';
const FIT_KEY = 'chord-builder:fs-fit:v1';

/**
 * The smallest a song is shrunk to fit two pages: 60% of the drawn size, about
 * 16px words on a wide screen. Smaller and it is not read from a stand.
 */
const FIT_FLOOR = 0.6;

const NO_PLACEMENTS: Placements = {};

/**
 * A yes/no that is this device's habit — not the song's, and not the player's
 * everywhere: whether the notes are open, whether the chords are drawn or only
 * the words, whether a wide screen shows two pages, whether this device has
 * turned a page yet. Not synced prefs: the rules pin a profile's prefs to the
 * keys they name.
 */
function useDeviceFlag(key: string, fallback: boolean): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored === null ? fallback : stored !== 'no';
    } catch {
      return fallback;
    }
  });
  const remember = useCallback(
    (next: boolean) => {
      setOn(next);
      try {
        window.localStorage.setItem(key, next ? 'yes' : 'no');
      } catch {
        // Private mode: back to the default next time.
      }
    },
    [key],
  );
  return [on, remember];
}

/**
 * Keeps the screen awake while the song is open.
 *
 * A phone sleeping mid-verse is the actual failure mode mid-song, which is
 * why this screen exists at all. The lock is dropped by the browser whenever
 * the tab is hidden, so it has to be re-taken on visibilitychange rather than
 * requested once.
 */
function useWakeLock(active: boolean): boolean {
  const [held, setHeld] = useState(false);
  const lock = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        lock.current = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void lock.current.release();
          return;
        }
        setHeld(true);
        lock.current.addEventListener('release', () => setHeld(false));
      } catch {
        // Denied, or unsupported in this context: the screen simply sleeps.
        setHeld(false);
      }
    };

    void acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', acquire);
      void lock.current?.release().catch(() => {});
      lock.current = null;
      setHeld(false);
    };
  }, [active]);

  return held;
}

/**
 * What a turn can see of the song: the column's items (the notes panel, each
 * line with words), measured where they are drawn. `offset` is the column's
 * own top within whatever holds it. `lib/pages` decides; this only measures.
 */
function readItems(col: HTMLElement, offset: number): PageItem[] {
  return Array.from(col.querySelectorAll<HTMLElement>(':scope > [data-item]')).map((el) => ({
    top: el.offsetTop + offset,
    bottom: el.offsetTop + el.offsetHeight + offset,
    stanza: el.hasAttribute('data-stanza'),
  }));
}

/** A tap meant for something on the page — a button, the notes — or a selection, is not a turn. */
function isTurnTap(e: MouseEvent): boolean {
  if ((e.target as HTMLElement).closest('a, button, summary, details, input, textarea, select')) {
    return false;
  }
  return !window.getSelection()?.toString();
}

/** Two pages, read like a book: the left page goes back, the right goes on. */
function tapOnLeft(e: MouseEvent<HTMLElement>): boolean {
  const box = e.currentTarget.getBoundingClientRect();
  return e.clientX - box.left < box.width / 2;
}

/** One column: the top quarter of the words goes back; anywhere else goes on. */
function tapGoesBack(e: MouseEvent<HTMLElement>): boolean {
  const box = e.currentTarget.getBoundingClientRect();
  return e.clientY - box.top < box.height * 0.25;
}

/**
 * M05 / D3. Read the song while playing. No chrome.
 *
 * This is where a song opens — from Songs, Home, a playlist, a shared link.
 * A song is opened to play far more often than to change, so the song screen
 * is one tap further on, behind Edit.
 *
 * A tap on the words turns the page, because scrolling takes a hand off the
 * guitar for as long as it takes and a tap for an instant. One column turns by
 * a screenful, carrying the line you were on to the top, marked. Where there is
 * room, two pages sit side by side like a book: the right page goes on two
 * pages, the left goes back two.
 */
export default function FullScreen({ song, nameOf, onExit, onEdit, kicker, action }: Props) {
  const isDesktop = useIsDesktop();
  const twoFit = useTwoPagesFit();
  const scale = usePrefs().prefs.textScale;
  const awake = useWakeLock(true);
  const fill = useFillScreen();
  const hasWords = song.words.length > 0;
  const [notesOpen, setNotesOpen] = useDeviceFlag(NOTES_OPEN_KEY, true);
  const [chordsShown, setChordsShown] = useDeviceFlag(CHORDS_SHOWN_KEY, true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [twoPages, setTwoPages] = useDeviceFlag(TWO_PAGES_KEY, true);
  const [turned, setTurned] = useDeviceFlag(TURNED_KEY, false);
  const [fitOn, setFitOn] = useDeviceFlag(FIT_KEY, true);
  const byWord = notesByWord(song.notes);
  const wide = songWideNotes(song.notes);
  const paged = hasWords && twoFit && twoPages;
  const fitting = paged && fitOn;

  /* --- Two pages, fitted: the text shrunk until the song is one spread ----- */

  /** The pages' size, "w×h": the room a fit is for. */
  const [room, setRoom] = useState('');
  // A fit holds for one song drawn one way in one room; anything else starts again.
  const fitKey = [song.id, song.updatedAt, scale, chordsShown, notesOpen, isDesktop, room].join('|');
  const [fitState, setFitState] = useState<{ key: string; search: FitSearch } | null>(null);
  const search = fitState?.key === fitKey ? fitState.search : startFit(scale, FIT_FLOOR);
  /** What the song is drawn at: the player's size, or smaller to fit. */
  const readScale = fitting ? search.at : scale;

  const sizes = readingSizes(isDesktop, readScale);

  const lines = lineCount(song.lyric);
  const grouped = groupByLine(song.words, lines);
  // Words only: the typed chord lines go, and nothing placed is drawn.
  const shownLines = chordsShown ? grouped : wordsOnly(grouped);

  /* --- One column, turned a screenful at a time ----------------------------- */

  const scroller = useRef<HTMLDivElement>(null);
  const scrolledCol = useRef<HTMLDivElement>(null);
  /** Lines on screen that were on it before the last turn: where you were. */
  const [carried, setCarried] = useState<[number, number] | null>(null);

  const turnColumn = (back: boolean) => {
    const sc = scroller.current;
    const col = scrolledCol.current;
    if (!sc || !col) return;
    // Measured from just under the scroller's top padding, so a line turned to
    // the top sits where the song's first line does.
    const pad = parseFloat(getComputedStyle(sc).paddingTop) || 0;
    const items = readItems(col, col.offsetTop);
    const viewTop = sc.scrollTop + pad;
    const viewHeight = sc.clientHeight - pad;
    if (back) {
      const to = sc.scrollTop > 1 ? turnBack(items, viewTop, viewHeight) : null;
      if (to === null) return;
      setCarried(null);
      sc.scrollTo({ top: to === 0 ? 0 : items[to].top - pad, behavior: 'smooth' });
    } else {
      const turn = turnForward(items, viewTop, viewHeight);
      if (!turn) return;
      setCarried(turn.carried);
      sc.scrollTo({ top: items[turn.to].top - pad, behavior: 'smooth' });
    }
    if (!turned) setTurned(true);
  };

  /* --- Two pages, a spread at a time ---------------------------------------------------- */

  // Both pages draw the whole song and show a slice of it; the left one is measured.
  const measuredCol = useRef<HTMLDivElement>(null);
  const measuredBody = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ items: PageItem[]; starts: number[] }>({
    items: [],
    starts: [0],
  });
  /** The spread showing, named by its left page. */
  const [spread, setSpread] = useState(0);
  /** Counts turns, so every turn flashes afresh. */
  const [flash, setFlash] = useState(0);

  useLayoutEffect(() => {
    const col = measuredCol.current;
    const body = measuredBody.current;
    if (!paged || !col || !body) return;
    const roomNow = `${body.clientWidth}x${body.clientHeight}`;
    if (roomNow !== room) {
      // A new room is a new fit: settled before the first paint, not after.
      setRoom(roomNow);
      return;
    }
    // Cut again whenever the song, the size or the room changes — the notes
    // opening included, which is the column growing. While fitting, each cut
    // is a step of the search; these all run before the screen paints, so the
    // sizes tried are never seen.
    const measure = () => {
      const items = readItems(col, 0);
      const starts = paginate(items, body.clientHeight);
      const next = { items, starts };
      setLayout((was) => (JSON.stringify(was) === JSON.stringify(next) ? was : next));
      if (fitting && !search.done) setFitState({ key: fitKey, search: fitStep(search, starts.length) });
    };
    measure();
    const watchCol = new ResizeObserver(measure);
    watchCol.observe(col);
    const watchRoom = new ResizeObserver(() => setRoom(`${body.clientWidth}x${body.clientHeight}`));
    watchRoom.observe(body);
    return () => {
      watchCol.disconnect();
      watchRoom.disconnect();
    };
  }, [paged, fitting, fitKey, search, room, song, readScale, chordsShown]);

  const pageCount = layout.starts.length;
  const shown = clampSpread(spread, pageCount);

  const turnPages = (back: boolean) => {
    const next = back ? spreadBack(shown) : spreadForward(shown, pageCount);
    if (next === shown) return;
    setSpread(next);
    setFlash((n) => n + 1);
    if (!turned) setTurned(true);
  };

  /* --- The song, as items a turn can measure ------------------------------- */

  const videos = song.videos ?? [];
  /* "Notes 2", "Videos 1", or both: what the closed panel holds. */
  const panelParts = [
    wide.length > 0 && ['Notes', wide.length] as const,
    videos.length > 0 && ['Videos', videos.length] as const,
  ].filter((p) => p !== false);

  const notesPanel = panelParts.length > 0 && (
    /* At the top of the words rather than pinned: read before playing, then
       turned past. Closed, it is one line; that is remembered. The videos are
       in it too: like the notes, they are for before you play. */
    <details
      className="fs-notes"
      data-item=""
      open={notesOpen}
      onToggle={(e) => setNotesOpen(e.currentTarget.open)}
    >
      <summary>
        {panelParts.map(([name, n], i) => (
          <span key={name}>
            {i > 0 && ' · '}
            {name} <em>{n}</em>
          </span>
        ))}
      </summary>
      {wide.map((note) => (
        <div key={note.id} className={`fs-note note-${note.kind}`}>
          {note.kind !== 'general' && <span>{NOTE_KIND_LABEL[note.kind]}</span>}
          <p style={{ fontSize: Math.max(12, sizes.word * 0.7) }}>{note.text}</p>
        </div>
      ))}
      {videos.length > 0 && (
        <div className="fs-videos">
          {videos.map((video) => (
            <VideoLink key={video.id} video={video} />
          ))}
        </div>
      )}
    </details>
  );

  /** The whole song as one column; `shift` slides it up to a page's first line. */
  const column = (measured: 'scrolled' | 'page' | null, mark: [number, number] | null, shift = 0) => {
    let item = notesPanel ? 1 : 0;
    let afterGap = false;
    return (
      /* The space between lines shrinks with the words: at the small sizes the
         point is more of the song on the screen, and fixed gaps would spend it.
         Small even with the chords on: the chord row above each line already
         parts it from the one before, so a wide gap on top of that only spent
         the screen. With the chords off there is no chord row, so the lines
         close right up — the whole point of reading words only. */
      <div
        ref={measured === 'scrolled' ? scrolledCol : measured === 'page' ? measuredCol : undefined}
        className={`fs-col${chordsShown ? '' : ' fs-col-text'}`}
        style={{
          gap: Math.round((chordsShown ? (isDesktop ? 10 : 8) : isDesktop ? 6 : 4) * readScale),
          transform: shift ? `translateY(${-shift}px)` : undefined,
        }}
      >
        {notesPanel}
        {shownLines.map((lineWords, i) => {
          if (lineWords.length === 0) {
            afterGap = true;
            return <div key={`g${i}`} className="lyric-gap" aria-hidden="true" />;
          }
          const n = item++;
          const stanza = afterGap;
          afterGap = false;
          const isCarried = !!mark && n >= mark[0] && n <= mark[1];
          return (
            <div
              key={`l${i}`}
              className={`fs-line${isCarried ? ' is-carried' : ''}`}
              data-item=""
              data-stanza={stanza ? '' : undefined}
            >
              {chordsShown && isChordLine(lineWords) ? (
                // Chords typed into the lyric: drawn as chords, not as a dimmed line of words.
                <p
                  className="lyric-line typed-chords"
                  style={{ fontSize: Math.max(sizes.chord, sizes.word * 0.75) }}
                >
                  {lineWords.map((w) => w.text).join(' ')}
                </p>
              ) : (
                <LyricBlock
                  lyric={lineWords.map((w) => w.text).join(' ')}
                  words={lineWords.map((w) => ({ ...w, line: 0 }))}
                  placements={chordsShown ? song.placements : NO_PLACEMENTS}
                  nameOf={nameOf}
                  sizes={sizes}
                  notes={byWord}
                  notesInline
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const page = (side: 0 | 1) => {
    const p = shown + side;
    const { items, starts } = layout;
    const exists = p < pageCount;
    const start = starts[p] ?? 0;
    const end = starts[p + 1] ?? items.length;
    const top = items[start]?.top ?? 0;
    // Clipped at the page's last whole line, so nothing half-shows at the foot.
    const height = exists && items.length > 0 ? items[end - 1].bottom - top : undefined;
    return (
      <section className="fs-page" aria-label={exists ? `Page ${p + 1} of ${pageCount}` : undefined}>
        <div className="fs-page-head" aria-hidden="true">
          {exists && (
            <>
              <span>
                Page {p + 1} of {pageCount}
              </span>
              {/* Said, so smaller text is not taken for the size setting going wrong. */}
              {side === 0 && readScale < scale && <span>· text {Math.round(readScale * 100)}% to fit</span>}
            </>
          )}
        </div>
        <div className="fs-page-body" ref={side === 0 ? measuredBody : undefined}>
          <div className="fs-page-clip" style={{ height, visibility: exists ? undefined : 'hidden' }}>
            {column(side === 0 ? 'page' : null, null, top)}
          </div>
          {flash > 0 && <span key={flash} className="fs-page-flash" />}
        </div>
      </section>
    );
  };

  return (
    <div className="fs">
      <div className="fs-top">
        <button type="button" className="icon-btn" onClick={onExit} aria-label="Back">
          <ArrowsInSimple size={20} />
        </button>
        <span className="fs-title">
          {kicker && <em className="fs-kicker">{kicker}</em>}
          <span>{song.title.trim() || 'Untitled'}</span>
        </span>
        {hasWords && (
          <button
            type="button"
            className="btn-ghost fs-chords-toggle"
            onClick={() => setChordsShown(!chordsShown)}
          >
            <MusicNotesSimple size={15} />
            {/* What a tap does, not a bare "Chords": a toggle only named was
                not read as one. */}
            <span>{chordsShown ? 'Hide chords' : 'Show chords'}</span>
          </button>
        )}
        <button
          type="button"
          className={`icon-btn fs-settings-btn${settingsOpen ? ' is-on' : ''}`}
          onClick={() => setSettingsOpen(!settingsOpen)}
          aria-expanded={settingsOpen}
          aria-controls="fs-settings"
          aria-label="Reading settings"
          title="Reading settings"
        >
          <GearSix size={19} />
        </button>
        {onEdit && (
          <button type="button" className="btn-ghost fs-edit" onClick={onEdit}>
            <PencilSimple size={15} />
            Edit
          </button>
        )}
      </div>

      {/* Set once and left: behind the gear, so the bar has room for the title.
          Chords stays in the bar — that one is flipped mid-song. Closed each time
          a song opens; it pushes the words down rather than covering them. */}
      {settingsOpen && (
        <div className="fs-settings" id="fs-settings">
          <span className="fs-settings-label">Text size</span>
          <TextSize />
          {fill.can && (
            <button type="button" className="btn-ghost fs-edit" onClick={fill.toggle}>
              {fill.on ? <ArrowsIn size={15} /> : <ArrowsOut size={15} />}
              {fill.on ? 'Stop filling the screen' : 'Fill the screen'}
            </button>
          )}
          {hasWords && twoFit && (
            <button
              type="button"
              className="btn-ghost fs-edit"
              onClick={() => setTwoPages(!twoPages)}
              title={twoPages ? 'One column that scrolls' : 'Two pages side by side'}
            >
              {twoPages ? <Rows size={15} /> : <Columns size={15} />}
              {twoPages ? 'One column' : 'Two pages'}
            </button>
          )}
          {paged && (
            <button
              type="button"
              className="btn-ghost fs-edit"
              onClick={() => setFitOn(!fitOn)}
              title={fitOn ? 'Keep the text size, and turn pages' : 'Shrink the text so the song fits two pages'}
            >
              {fitOn ? <TextAa size={15} /> : <ArrowsInLineVertical size={15} />}
              {fitOn ? 'Keep my text size' : 'Fit to two pages'}
            </button>
          )}
        </div>
      )}

      {/* The shapes, pinned: outside the scroller, so they are still there at the
          last verse. One row that scrolls sideways rather than wrapping — every
          row it wrapped onto would come straight out of the words, and the words
          are what the screen is for. Nothing to show, no strip. With no words the
          chords are the whole song, and get the page instead (below). */}
      {song.chords.length > 0 && hasWords && chordsShown && (
        <ul className={`fs-chords${isDesktop ? ' fs-chords-wide' : ''}`} aria-label="The chords">
          {song.chords.map((chord) => (
            <li key={chord.id}>
              <strong>{chord.spec.name.trim() || '—'}</strong>
              <ChordDiagram spec={chord.spec} />
            </li>
          ))}
        </ul>
      )}

      {paged ? (
        /* Two pages, a tap to turn, like a book: the right page goes on, the
           left goes back. */
        <div className="fs-pages" onClick={(e) => isTurnTap(e) && turnPages(tapOnLeft(e))}>
          {page(0)}
          {page(1)}
        </div>
      ) : (
        <div
          ref={scroller}
          className={`fs-words${isDesktop ? ' fs-wide' : ''}`}
          onClick={hasWords ? (e) => isTurnTap(e) && turnColumn(tapGoesBack(e)) : undefined}
        >
          {hasWords ? (
            column('scrolled', carried)
          ) : (
            <>
              {notesPanel}
              <ul className="fs-chords-only" aria-label="The chords">
                {song.chords.map((chord) => (
                  <li key={chord.id}>
                    <strong style={{ fontSize: sizes.word }}>{chord.spec.name.trim() || '—'}</strong>
                    <ChordDiagram spec={chord.spec} />
                  </li>
                ))}
              </ul>
              <p className="fs-no-words">
                {onEdit ? 'No words on this one yet. Edit to paste them in.' : 'No words on this one.'}
              </p>
            </>
          )}
        </div>
      )}

      {action && <div className="fs-action">{action}</div>}

      <div className="fs-bottom">
        <CapoChip capo={song.capo} variant="statement" />
        {song.key && (
          <>
            <i className="divider-dot" />
            <span>Key of {song.key}</span>
          </>
        )}
        <span className="spacer" />
        {/* Until this device has turned a page, the bar says how; after that it is
            known. A song that fits one spread has nothing to turn. */}
        {hasWords && !turned && !(paged && pageCount <= 2) ? (
          <span className="fs-hint">
            {paged ? 'Tap right to turn · left to go back' : 'Tap to turn · top to go back'}
          </span>
        ) : (
          <span className="fs-awake">
            <Sun size={15} />
            {awake ? 'Screen stays on' : 'Screen may sleep'}
          </span>
        )}
      </div>
    </div>
  );
}
