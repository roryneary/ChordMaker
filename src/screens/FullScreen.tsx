import { useEffect, useRef, useState } from 'react';
import { ArrowsInSimple, Sun } from '@phosphor-icons/react';
import CapoChip from '../components/CapoChip';
import ChordDiagram from '../components/ChordDiagram';
import LyricBlock from '../components/lyric/LyricBlock';
import { useIsDesktop } from '../components/shell/useBreakpoint';
import { groupByLine, lineCount } from '../lib/lyric';
import type { Song } from '../types/song';

interface Props {
  song: Song;
  nameOf: (chordId: string) => string | null;
  onExit: () => void;
}

/**
 * Steps, not a slider: you adjust this with a guitar on your knee. The middle
 * one is the default and the size the screen was drawn at. The step below it is
 * for the times you want the next verse on the screen rather than bigger words
 * — a page you can see the shape of beats a page you have to scroll.
 */
const SCALES = [0.78, 1, 1.25] as const;
const DEFAULT_SCALE = SCALES[1];

/** Drawn at their own size by `.seg`, so the buttons look like what they do. */
const SCALE_LABELS = ['A−', 'A', 'A+'] as const;

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

/** M05 / D3. Read the song while playing. No chrome. */
export default function FullScreen({ song, nameOf, onExit }: Props) {
  const isDesktop = useIsDesktop();
  const [scale, setScale] = useState<number>(DEFAULT_SCALE);
  const awake = useWakeLock(true);

  const base = isDesktop ? { word: 27, chord: 15 } : { word: 23, chord: 14 };
  // The chord scales with the words, holding the ~0.55 ratio.
  const sizes = { word: base.word * scale, chord: base.chord * scale };

  const lines = lineCount(song.lyric);
  const grouped = groupByLine(song.words, lines);

  // One column at every width: a song reads top to bottom, and a second column
  // beside the first looks like a different part of the song.
  const block = (
    <div className="fs-col">
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
          />
        ),
      )}
    </div>
  );

  return (
    <div className="fs">
      <div className="fs-top">
        <button type="button" className="icon-btn" onClick={onExit} aria-label="Leave full screen">
          <ArrowsInSimple size={20} />
        </button>
        <span className="fs-title">{song.title.trim() || 'Untitled'}</span>
        <div className="seg" role="group" aria-label="Text size">
          {SCALES.map((step, i) => (
            <button
              key={step}
              type="button"
              className={scale === step ? 'is-on' : undefined}
              onClick={() => setScale(step)}
              aria-pressed={scale === step}
            >
              {SCALE_LABELS[i]}
            </button>
          ))}
        </div>
      </div>

      {/* The shapes, pinned: outside the scroller, so they are still there at the
          last verse. One row that scrolls sideways rather than wrapping — every
          row it wrapped onto would come straight out of the words, and the words
          are what the screen is for. Nothing to show, no strip. */}
      {song.chords.length > 0 && (
        <ul className={`fs-chords${isDesktop ? ' fs-chords-wide' : ''}`} aria-label="The chords">
          {song.chords.map((chord) => (
            <li key={chord.id}>
              <strong>{chord.spec.name.trim() || '—'}</strong>
              <ChordDiagram spec={chord.spec} />
            </li>
          ))}
        </ul>
      )}

      <div className={`fs-words${isDesktop ? ' fs-wide' : ''}`}>{block}</div>

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
