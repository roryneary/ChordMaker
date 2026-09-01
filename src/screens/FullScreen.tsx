import { useEffect, useRef, useState } from 'react';
import { ArrowsInSimple, Sun } from '@phosphor-icons/react';
import CapoChip from '../components/CapoChip';
import LyricBlock from '../components/lyric/LyricBlock';
import { useIsDesktop } from '../components/shell/useBreakpoint';
import { groupByLine, lineCount } from '../lib/lyric';
import type { Song } from '../types/song';

interface Props {
  song: Song;
  nameOf: (chordId: string) => string | null;
  onExit: () => void;
}

/** Two steps, not a slider: you adjust this with a guitar on your knee. */
const SCALES = [1, 1.25] as const;

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
  const [scale, setScale] = useState<number>(SCALES[0]);
  const awake = useWakeLock(true);

  const base = isDesktop ? { word: 27, chord: 15 } : { word: 23, chord: 14 };
  // The chord scales with the words, holding the ~0.55 ratio.
  const sizes = { word: base.word * scale, chord: base.chord * scale };

  const lines = lineCount(song.lyric);
  const grouped = groupByLine(song.words, lines);
  const half = Math.ceil(grouped.length / 2);

  const block = (from: number, to: number) => (
    <div className="fs-col">
      {grouped.slice(from, to).map((lineWords, i) =>
        lineWords.length === 0 ? (
          <div key={`g${from + i}`} className="lyric-gap" aria-hidden="true" />
        ) : (
          <LyricBlock
            key={`l${from + i}`}
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
          <button
            type="button"
            className={scale === SCALES[0] ? 'is-on' : undefined}
            onClick={() => setScale(SCALES[0])}
            aria-pressed={scale === SCALES[0]}
          >
            A&minus;
          </button>
          <button
            type="button"
            className={scale === SCALES[1] ? 'is-on' : undefined}
            onClick={() => setScale(SCALES[1])}
            aria-pressed={scale === SCALES[1]}
          >
            A+
          </button>
        </div>
      </div>

      <div className={`fs-words${isDesktop ? ' fs-two-col' : ''}`}>
        {isDesktop ? (
          <>
            {block(0, half)}
            {block(half, grouped.length)}
          </>
        ) : (
          block(0, grouped.length)
        )}
      </div>

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
