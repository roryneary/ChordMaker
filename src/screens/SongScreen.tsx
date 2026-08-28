import { useCallback, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowsOutSimple,
  CaretLeft,
  Lightbulb,
  PaperPlaneTilt,
  PencilSimple,
  Plus,
  Printer,
} from '@phosphor-icons/react';
import CapoChip from '../components/CapoChip';
import ChordDiagram from '../components/ChordDiagram';
import LyricBlock from '../components/lyric/LyricBlock';
import { useIsDesktop } from '../components/shell/useBreakpoint';
import { groupByLine, lineCount, unchordedLineCount } from '../lib/lyric';
import type { SavedChord, Song } from '../types/song';

interface Props {
  song: Song;
  nameOf: (chordId: string) => string | null;
  onBack: () => void;
  onAddChord: () => void;
  onEditChord: (chordId: string) => void;
  onEditWords: () => void;
  onFullScreen: () => void;
  onReady: () => void;
  onCapo: (capo: number | null) => void;
  onPlace: (wordId: string, chordId: string | null) => void;
  onTitle: (title: string) => void;
}

const SHOWN_LINES = 3;

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const spell = (n: number) => COUNT_WORDS[n] ?? String(n);
const Spell = (n: number) => {
  const word = spell(n);
  return word.charAt(0).toUpperCase() + word.slice(1);
};

/** M04 / D1. The working screen: chords assembled, words pasted, chords placed. */
export default function SongScreen({
  song,
  nameOf,
  onBack,
  onAddChord,
  onEditChord,
  onEditWords,
  onFullScreen,
  onReady,
  onCapo,
  onPlace,
  onTitle,
}: Props) {
  const isDesktop = useIsDesktop();
  const [picking, setPicking] = useState<string | null>(null);

  const lines = lineCount(song.lyric);
  const grouped = useMemo(() => groupByLine(song.words, lines), [song.words, lines]);
  const remaining = Math.max(0, grouped.filter((l) => l.length > 0).length - SHOWN_LINES);
  const toChord = unchordedLineCount(song.words, song.placements, lines);
  const meta = [song.key && `Key of ${song.key}`, song.feel].filter(Boolean).join(' · ');
  const hasLyric = song.lyric.trim().length > 0;

  const place = useCallback(
    (chordId: string | null) => {
      if (picking) onPlace(picking, chordId);
      setPicking(null);
    },
    [picking, onPlace],
  );

  const chordCell = (chord: SavedChord, big: boolean) => (
    <li key={chord.id}>
      <button type="button" className="card chord-tile" onClick={() => onEditChord(chord.id)}>
        <strong style={{ fontSize: big ? 22 : 18 }}>{chord.spec.name.trim() || '—'}</strong>
        <ChordDiagram spec={chord.spec} />
      </button>
    </li>
  );

  const addCell = (label: string, big: boolean) => (
    <li>
      <button
        type="button"
        className="chord-add"
        style={{ minHeight: big ? 201 : 97 }}
        onClick={onAddChord}
      >
        <Plus size={big ? 22 : 20} />
        <span>{label}</span>
      </button>
    </li>
  );

  const footText = () => {
    if (remaining > 0) return `${Spell(remaining)} more line${remaining === 1 ? '' : 's'} below`;
    if (toChord > 0) return `${Spell(toChord)} line${toChord === 1 ? '' : 's'} with no chords yet`;
    return 'Every line has a chord';
  };

  const wordsBlock = (
    <div className="words-block">
      {hasLyric ? (
        <>
          <LyricBlock
            lyric={song.lyric}
            words={song.words}
            placements={song.placements}
            nameOf={nameOf}
            sizes={isDesktop ? { word: 17, chord: 12.5 } : { word: 16, chord: 11.5 }}
            maxLines={SHOWN_LINES}
            onWordClick={song.chords.length ? setPicking : undefined}
            selectedWordId={picking}
          />
          <p className="words-block-foot">
            <span>
              {isDesktop && <ArrowDown size={14} />}
              {footText()}
            </span>
            {!isDesktop && (
              <button type="button" className="btn-ghost" onClick={onEditWords}>
                Edit the words
              </button>
            )}
          </p>
        </>
      ) : (
        <button type="button" className="words-empty" onClick={onEditWords}>
          Paste the words in — you&apos;ll drop the chords on afterwards.
        </button>
      )}
    </div>
  );

  const picker = picking && (
    <>
      <button
        type="button"
        className="scrim"
        aria-label="Close"
        onClick={() => setPicking(null)}
      />
      <div className="sheet" role="dialog" aria-label="Choose a chord">
        <i className="grab" />
        <h2>Which chord lands here?</h2>
        <div className="chips">
          {song.chords.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`chip${song.placements[picking] === c.id ? ' is-selected' : ''}`}
              onClick={() => place(c.id)}
            >
              {c.spec.name.trim() || '—'}
            </button>
          ))}
        </div>
        {song.placements[picking] && (
          <button type="button" className="btn-ghost sheet-remove" onClick={() => place(null)}>
            Take the chord off this word
          </button>
        )}
        <button type="button" className="btn-secondary btn-block" onClick={() => setPicking(null)}>
          Not yet
        </button>
      </div>
    </>
  );

  if (isDesktop) {
    return (
      <div className="song song-desktop">
        {/* Header pinned, body scrolling: letting the whole pane scroll (or
            worse, clipping it with overflow:hidden) sliced the lyric mid-line. */}
        <header className="song-head">
          <p className="kicker">You&apos;re building</p>
          <div className="song-head-row">
            <input
              className="title-input display-md"
              value={song.title}
              onChange={(e) => onTitle(e.target.value)}
              placeholder="Name this song"
              aria-label="Song title"
              autoComplete="off"
              spellCheck={false}
            />
            <div className="song-actions-d">
              <button type="button" className="btn-secondary" onClick={onReady}>
                <Printer size={15} />
                Print for the case
              </button>
              <button type="button" className="btn-primary" onClick={onReady}>
                <PaperPlaneTilt size={15} />
                Send to the band
              </button>
            </div>
          </div>
          <div className="song-meta">
            {meta && <span>{meta}</span>}
            <CapoChip capo={song.capo} onChange={onCapo} />
          </div>
          <hr className="rule rule-flush" />
        </header>

        <div className="song-body">
          <div className="label-row">
            <h2>The chords</h2>
            <span>{spell(song.chords.length)}, in the order you play them</span>
          </div>
          <ul className="chord-tiles chord-tiles-d">
            {song.chords.map((c) => chordCell(c, true))}
            {addCell('Next chord', true)}
          </ul>

          <div className="label-row label-row-words">
            <h2>The words</h2>
            <span>{hasLyric ? 'drop a chord on the word it lands on' : 'not pasted yet'}</span>
            <span className="spacer" />
            <button type="button" className="btn-ghost" onClick={onEditWords}>
              <PencilSimple size={15} />
              Edit the words
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={onFullScreen}
              disabled={!hasLyric}
            >
              <ArrowsOutSimple size={15} />
              Full screen
            </button>
          </div>
          {wordsBlock}

          {/* The direction's signature: an opinionated line that teaches when
              you stall. Desktop only — mobile gave the space to the words. */}
          {song.chords.length >= 4 && song.chords.length < 6 && (
            <div className="nudge">
              <Lightbulb size={18} />
              <p>
                {Spell(song.chords.length)} chords — that&apos;s a whole song. Add another if
                you want a turnaround at the end.
              </p>
              <button type="button" className="btn-ghost" onClick={onAddChord}>
                Add one
              </button>
            </div>
          )}
        </div>
        {picker}
      </div>
    );
  }

  return (
    <div className="song">
      <header className="song-head-m">
        <button type="button" className="icon-btn accent" onClick={onBack} aria-label="Back">
          <CaretLeft size={20} />
        </button>
        <span className="song-titles">
          <input
            className="title-input"
            value={song.title}
            onChange={(e) => onTitle(e.target.value)}
            placeholder="Name this song"
            aria-label="Song title"
            autoComplete="off"
            spellCheck={false}
          />
          {meta && <em>{meta}</em>}
        </span>
      </header>

      <div className="song-body">
        <CapoChip capo={song.capo} onChange={onCapo} />

        <div className="label-row">
          <h2>The chords</h2>
          <span>in the order you play them</span>
        </div>
        <ul className="chord-tiles">
          {song.chords.map((c) => chordCell(c, false))}
          {addCell('Add', false)}
        </ul>

        <div className="label-row">
          <h2>The words</h2>
          <span>{hasLyric ? 'tap a word to drop a chord' : 'not pasted yet'}</span>
          <span className="spacer" />
          <button
            type="button"
            className="icon-btn sm"
            onClick={onFullScreen}
            aria-label="Full screen"
            disabled={!hasLyric}
          >
            <ArrowsOutSimple size={16} />
          </button>
        </div>
        {wordsBlock}
      </div>

      <div className="editor-action">
        <button type="button" className="btn-primary btn-block" onClick={onReady}>
          Looks right
          <ArrowRight size={16} />
        </button>
      </div>
      {picker}
    </div>
  );
}
