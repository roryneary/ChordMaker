import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowsIn, ArrowsInSimple, ArrowsOut, PencilSimple, Sun } from '@phosphor-icons/react';
import CapoChip from '../components/CapoChip';
import ChordDiagram from '../components/ChordDiagram';
import TextSize from '../components/TextSize';
import LyricBlock from '../components/lyric/LyricBlock';
import { useIsDesktop } from '../components/shell/useBreakpoint';
import { usePrefs } from '../hooks/usePrefs';
import { groupByLine, lineCount } from '../lib/lyric';
import { NOTE_KIND_LABEL, notesByWord, songWideNotes } from '../lib/notes';
import type { Song } from '../types/song';

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

/** Whether the notes panel is open: this device's habit, not the song's. Open until closed. */
function useNotesOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(() => {
    try {
      return window.localStorage.getItem(NOTES_OPEN_KEY) !== 'no';
    } catch {
      return true;
    }
  });
  const remember = useCallback((next: boolean) => {
    setOpen(next);
    try {
      window.localStorage.setItem(NOTES_OPEN_KEY, next ? 'yes' : 'no');
    } catch {
      // Private mode: it is open again next time.
    }
  }, []);
  return [open, remember];
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
 * M05 / D3. Read the song while playing. No chrome.
 *
 * This is where a song opens — from Songs, Home, a playlist, a shared link.
 * A song is opened to play far more often than to change, so the song screen
 * is one tap further on, behind Edit.
 */
export default function FullScreen({ song, nameOf, onExit, onEdit, kicker, action }: Props) {
  const isDesktop = useIsDesktop();
  const scale = usePrefs().prefs.textScale;
  const awake = useWakeLock(true);
  const fill = useFillScreen();
  const hasWords = song.words.length > 0;
  const [notesOpen, setNotesOpen] = useNotesOpen();
  const byWord = notesByWord(song.notes);
  const wide = songWideNotes(song.notes);

  const base = isDesktop ? { word: 27, chord: 15 } : { word: 23, chord: 14 };
  // The chord scales with the words, holding the ~0.55 ratio —
  // but never below 10px, so at the smallest steps a name is still read at a glance.
  const sizes = { word: base.word * scale, chord: Math.max(10, base.chord * scale) };

  const lines = lineCount(song.lyric);
  const grouped = groupByLine(song.words, lines);

  // One column at every width: a song reads top to bottom, and a second column
  // beside the first looks like a different part of the song.
  const block = (
    /* The space between lines shrinks with the words: at the small sizes the
       point is more of the song on the screen, and fixed gaps would spend it. */
    <div className="fs-col" style={{ gap: Math.round((isDesktop ? 24 : 20) * scale) }}>
      {grouped.map((lineWords, i) =>
        lineWords.length === 0 ? (
          <div key={`g${i}`} className="lyric-gap" aria-hidden="true" />
        ) : (
          <LyricBlock
            key={`l${i}`}
            lyric={lineWords.map((w) => w.text).join(' ')}
            words={lineWords.map((w) => ({ ...w, line: 0 }))}
            placements={song.placements}
            nameOf={nameOf}
            sizes={sizes}
            notes={byWord}
            notesInline
          />
        ),
      )}
    </div>
  );

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
        <TextSize />
        {fill.can && (
          <button
            type="button"
            className="icon-btn"
            onClick={fill.toggle}
            aria-label={fill.on ? 'Stop filling the screen' : 'Fill the screen'}
            title={fill.on ? 'Stop filling the screen' : 'Fill the screen'}
          >
            {fill.on ? <ArrowsIn size={19} /> : <ArrowsOut size={19} />}
          </button>
        )}
        {onEdit && (
          <button type="button" className="btn-ghost fs-edit" onClick={onEdit}>
            <PencilSimple size={15} />
            Edit
          </button>
        )}
      </div>

      {/* The shapes, pinned: outside the scroller, so they are still there at the
          last verse. One row that scrolls sideways rather than wrapping — every
          row it wrapped onto would come straight out of the words, and the words
          are what the screen is for. Nothing to show, no strip. With no words the
          chords are the whole song, and get the page instead (below). */}
      {song.chords.length > 0 && hasWords && (
        <ul className={`fs-chords${isDesktop ? ' fs-chords-wide' : ''}`} aria-label="The chords">
          {song.chords.map((chord) => (
            <li key={chord.id}>
              <strong>{chord.spec.name.trim() || '—'}</strong>
              <ChordDiagram spec={chord.spec} />
            </li>
          ))}
        </ul>
      )}

      <div className={`fs-words${isDesktop ? ' fs-wide' : ''}`}>
        {/* At the top of the scroller rather than pinned: read before playing,
            then scrolled past. Closed, it is one line; that is remembered. */}
        {wide.length > 0 && (
          <details
            className="fs-notes"
            open={notesOpen}
            onToggle={(e) => setNotesOpen(e.currentTarget.open)}
          >
            <summary>
              Notes <em>{wide.length}</em>
            </summary>
            {wide.map((note) => (
              <div key={note.id} className={`fs-note note-${note.kind}`}>
                {note.kind !== 'general' && <span>{NOTE_KIND_LABEL[note.kind]}</span>}
                <p style={{ fontSize: Math.max(12, sizes.word * 0.7) }}>{note.text}</p>
              </div>
            ))}
          </details>
        )}
        {hasWords ? (
          block
        ) : (
          <>
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
        <span className="fs-awake">
          <Sun size={15} />
          {awake ? 'Screen stays on' : 'Screen may sleep'}
        </span>
      </div>
    </div>
  );
}
