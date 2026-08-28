import { useCallback, useState } from 'react';
import { ArrowRight, CaretLeft, ClipboardText, Info } from '@phosphor-icons/react';
import LyricBlock from '../components/lyric/LyricBlock';
import { useIsDesktop } from '../components/shell/useBreakpoint';
import { lineCount } from '../lib/lyric';
import type { Song } from '../types/song';

interface Props {
  song: Song;
  onChange: (lyric: string) => void;
  onTitle: (title: string) => void;
  onDone: () => void;
  onBack: () => void;
  nameOf: (chordId: string) => string | null;
}

const NOTE = 'Your line breaks stay as they are. A blank line becomes a gap on the sheet.';

/**
 * M03 / D2. You paste the whole lyric at once and place chords afterwards —
 * the line-by-line entry this replaces is not how anyone works.
 */
export default function WordsEditor({
  song,
  onChange,
  onTitle,
  onDone,
  onBack,
  nameOf,
}: Props) {
  const isDesktop = useIsDesktop();
  const [pasteError, setPasteError] = useState<string | null>(null);

  const lines = song.lyric.trim() ? lineCount(song.lyric) : 0;
  const lineLabel = `${lines} line${lines === 1 ? '' : 's'}`;

  // A song needs a name to be anything at all in the list. The words can wait —
  // you might be starting from a chord sequence and type the lyric later.
  const named = song.title.trim().length > 0;
  const blocked = !named;
  const blockedReason = 'Give the song a name to carry on.';

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) onChange(text);
      setPasteError(null);
    } catch {
      // Permission denied, or a browser with no clipboard read at all.
      setPasteError('Your browser did not allow that — paste into the box instead.');
    }
  }, [onChange]);

  const nameField = (
    <div className="name-field">
      <label className="micro-label" htmlFor="song-name">
        Song name
      </label>
      <input
        id="song-name"
        className="title-input display-sm"
        value={song.title}
        onChange={(e) => onTitle(e.target.value)}
        placeholder="Name this song"
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );

  const textarea = (
    <textarea
      className="input lyric-input"
      value={song.lyric}
      onChange={(e) => onChange(e.target.value)}
      placeholder={'The harbour lights are on\n\nand the last boat leaves at nine'}
      aria-label="The words"
      spellCheck={false}
    />
  );

  const preview = (
    <div className="preview">
      <LyricBlock
        lyric={song.lyric}
        words={song.words}
        placements={song.placements}
        nameOf={nameOf}
        sizes={{ word: 17, chord: 12.5 }}
      />
      {!song.lyric.trim() && <p className="preview-empty">Nothing pasted yet.</p>}
      <p className="preview-note">
        <Info size={15} />
        Chords you've already placed stay put when you edit the words.
      </p>
    </div>
  );

  if (isDesktop) {
    return (
      <div className="words words-desktop">
        <div className="words-bar">
          <button type="button" className="icon-btn accent" onClick={onBack} aria-label="Back">
            <CaretLeft size={19} />
          </button>
          <strong className="words-bar-title">
            {song.title.trim() || 'Untitled'}
          </strong>
          <span className="words-sub">the words</span>
          <span className="spacer" />
          <button type="button" className="btn-secondary" onClick={pasteFromClipboard}>
            <ClipboardText size={15} />
            Paste from clipboard
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={onDone}
            disabled={blocked}
            title={blocked ? blockedReason : undefined}
          >
            Done
          </button>
        </div>

        <div className="words-split">
          <section className="words-pane">
            {nameField}
            <p className="micro-label">Paste them all at once</p>
            {textarea}
            <p className="words-foot">
              <span>{lineLabel}</span>
              <i className="divider-dot" />
              <span>{NOTE}</span>
            </p>
            {pasteError && <p className="words-error">{pasteError}</p>}
          </section>

          <section className="words-pane">
            <p className="micro-label">How it'll read</p>
            {preview}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="words">
      <div className="editor-bar">
        <button type="button" className="icon-btn accent" onClick={onBack} aria-label="Back">
          <CaretLeft size={20} />
        </button>
        {/* The name lives in the body now, so the bar just says where you are. */}
        <h1 className="editor-context">
          {song.title.trim() || 'New song'}
        </h1>
      </div>

      {/* Two asks, put the way every other section in the app is put: a section
          heading with its aside on the same line. Display type made each one a
          screen of its own on a phone — the whole editor has to fit without
          scrolling past the field you are meant to fill in. */}
      <div className="editor-body words-body">
        <div className="label-row label-row-lead">
          <h2>
            <label htmlFor="song-name">Name the song</label>
          </h2>
          <span>you need this one</span>
        </div>
        <input
          id="song-name"
          className="input name-input"
          value={song.title}
          onChange={(e) => onTitle(e.target.value)}
          placeholder="The harbour lights"
          autoComplete="off"
          spellCheck={false}
        />

        <div className="label-row">
          <h2>Paste the words</h2>
          <span>{lines ? lineLabel : 'optional, add them later'}</span>
          <span className="spacer" />
          <button type="button" className="btn-ghost" onClick={pasteFromClipboard}>
            <ClipboardText size={15} />
            Paste
          </button>
        </div>

        {textarea}
        {pasteError && <p className="words-error">{pasteError}</p>}

        <p className="words-note">{NOTE}</p>
      </div>

      <div className="editor-action">
        {blocked && (
          <p className="action-hint" role="status">
            {blockedReason}
          </p>
        )}
        <button
          type="button"
          className="btn-primary btn-block"
          disabled={blocked}
          onClick={onDone}
        >
          Now add the chords
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
