import { useCallback, useState } from 'react';
import {
  ArrowCounterClockwise,
  ArrowRight,
  CaretLeft,
  ClipboardText,
  Eraser,
  Info,
} from '@phosphor-icons/react';
import LyricBlock from '../components/lyric/LyricBlock';
import SavedLine from '../components/SavedLine';
import { useIsDesktop } from '../components/shell/useBreakpoint';
import { blankLineCount, lineCount, removeBlankLines } from '../lib/lyric';
import { MAX_TITLE_CHARS, tooBigToSave } from '../lib/sharedSong';
import type { SyncView } from '../lib/syncStatus';
import type { Song } from '../types/song';

interface Props {
  song: Song;
  onChange: (lyric: string) => void;
  onTitle: (title: string) => void;
  onDone: () => void;
  onBack: () => void;
  nameOf: (chordId: string) => string | null;
  /** Whether the words are really kept. The screen has no chrome on a phone,
      so without this there is nothing on it that says so. */
  sync: SyncView;
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
  sync,
}: Props) {
  const isDesktop = useIsDesktop();
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [beforeTidy, setBeforeTidy] = useState<string | null>(null);

  const lines = song.lyric.trim() ? lineCount(song.lyric) : 0;
  const lineLabel = `${lines} line${lines === 1 ? '' : 's'}`;

  // A song needs a name to be anything at all in the list. The words can wait —
  // you might be starting from a chord sequence and type the lyric later.
  const named = song.title.trim().length > 0;
  const blocked = !named;
  const blockedReason = 'Give the song a name to carry on.';
  /* Said here, while the words are in front of them, rather than later as a
     refused save. It does not block: the song still works on this device, it is
     the account that will not take it (`firestore.rules` holds the same limit). */
  const problem = pasteError ?? tooBigToSave(song);

  /* Setting a textarea's value from code empties the browser's own undo, so the
     tidy keeps the one step back itself. Any edit after it lets go of it: putting
     the old text back then would throw that edit away. */
  const blanks = blankLineCount(song.lyric);
  const tidy = () => {
    // A second press takes the verse breaks too; one step back undoes both.
    setBeforeTidy((kept) => kept ?? song.lyric);
    onChange(removeBlankLines(song.lyric));
  };
  const untidy = () => {
    if (beforeTidy !== null) onChange(beforeTidy);
    setBeforeTidy(null);
  };
  const edit = (lyric: string) => {
    setBeforeTidy(null);
    onChange(lyric);
  };

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setBeforeTidy(null);
        onChange(text);
      }
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
        maxLength={MAX_TITLE_CHARS}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );

  const textarea = (
    <textarea
      className="input lyric-input"
      value={song.lyric}
      onChange={(e) => edit(e.target.value)}
      placeholder={'The harbour lights are on\n\nand the last boat leaves at nine'}
      aria-label="The words"
      spellCheck={false}
    />
  );

  /* Only there when it has something to do. A paste from a lyrics site is often
     double-spaced, and deleting forty gaps by hand on a phone is nobody's idea of
     a good time; `removeBlankLines` says what it keeps. */
  const tidyRow = (blanks > 0 || beforeTidy !== null) && (
    <div className="words-tidy">
      {blanks > 0 && (
        <>
          <span>{`${blanks} blank line${blanks === 1 ? '' : 's'}`}</span>
          <button type="button" className="btn-ghost" onClick={tidy}>
            <Eraser size={15} />
            Remove blank lines
          </button>
        </>
      )}
      {beforeTidy !== null && (
        <button type="button" className="btn-ghost" onClick={untidy}>
          <ArrowCounterClockwise size={15} />
          Put them back
        </button>
      )}
    </div>
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
          <SavedLine sync={sync} />
          <span className="spacer" />
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
            {/* What you do to the words sits on the words' own heading, not in
                the bar: up there it read as acting on the page, a pane's width
                from the box it changes. The tidy pair is repeated under the box
                because a long lyric puts that row a scroll away. */}
            <div className="words-tools">
              <p className="micro-label">Paste them all at once</p>
              <span className="spacer" />
              {beforeTidy !== null && (
                <button type="button" className="btn-secondary" onClick={untidy}>
                  <ArrowCounterClockwise size={15} />
                  Put them back
                </button>
              )}
              {blanks > 0 && (
                <button type="button" className="btn-secondary" onClick={tidy}>
                  <Eraser size={15} />
                  Remove blank lines
                </button>
              )}
              <button type="button" className="btn-secondary" onClick={pasteFromClipboard}>
                <ClipboardText size={15} />
                Paste from clipboard
              </button>
            </div>
            {textarea}
            {tidyRow}
            <p className="words-foot">
              <span>{lineLabel}</span>
              <i className="divider-dot" />
              <span>{NOTE}</span>
            </p>
            {problem && <p className="words-error">{problem}</p>}
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
        <span className="spacer" />
        <SavedLine sync={sync} />
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

        {/* Above as well as below: the box fills the screen on a phone, and the
            row under it is behind the keyboard while you are in it. */}
        {tidyRow}
        {textarea}
        {tidyRow}
        {problem &&<p className="words-error">{problem}</p>}

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
