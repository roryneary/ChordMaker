import { useCallback, useState } from 'react';
import {
  ArrowRight,
  ArrowsClockwise,
  ArrowsOutSimple,
  CaretLeft,
  CopySimple,
  PaperPlaneTilt,
  PencilSimple,
  Plus,
  Printer,
  Swap,
  Trash,
  Warning,
} from '@phosphor-icons/react';
import CapoChip, { CAPO_FRETS, capoChosen, capoLabel } from '../components/CapoChip';
import ChordDiagram from '../components/ChordDiagram';
import DeleteSongSheet from '../components/DeleteSongSheet';
import SavedLine from '../components/SavedLine';
import LyricBlock from '../components/lyric/LyricBlock';
import { useIsDesktop } from '../components/shell/useBreakpoint';
import { ordinal } from '../lib/numerals';
import { lineCount, unchordedLineCount } from '../lib/lyric';
import type { Membership } from '../lib/playlists';
import {
  MAX_ARTIST_CHARS,
  MAX_TITLE_CHARS,
  changedSinceShared,
  senderLabel,
} from '../lib/sharedSong';
import type { SyncView } from '../lib/syncStatus';
import type { SharedSong } from '../types/sharedSong';
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
  /** Who plays it. Blank clears it — see the reducer's SET_ARTIST. */
  onArtist: (artist: string) => void;
  /** The sender's newer version of this song, when there is one to offer. */
  update: SharedSong | null;
  /** The two answers to it. There is no third, blended one: see lib/sharedSong.ts. */
  onReplaceMine: (update: SharedSong) => void;
  onKeepMine: (update: SharedSong) => void;
  /** For a song of the player's own that is shared and has changed since. */
  sharing: { busy: boolean; error: string | null; onShareChanges: () => void };
  /** Whether the song is really kept — said here, not only on the account chip. */
  sync: SyncView;
  /** The playlists this song is in — what the delete sheet says it will leave. */
  memberships: Membership[];
  /** Deletes the song, after its sheet has said what that reaches. */
  onDelete: () => void;
}

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
  onArtist,
  update,
  onReplaceMine,
  onKeepMine,
  sharing,
  sync,
  memberships,
  onDelete,
}: Props) {
  const isDesktop = useIsDesktop();
  const [picking, setPicking] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deciding, setDeciding] = useState(false);
  /**
   * Latched at the moment the check opens, not read live: choosing the capo
   * inside the sheet would otherwise pull the question out from under the
   * finger that just answered it.
   */
  const [checking, setChecking] = useState<{ capo: boolean; chords: boolean } | null>(null);

  const lines = lineCount(song.lyric);
  const toChord = unchordedLineCount(song.words, song.placements, lines);
  const meta = [song.key && `Key of ${song.key}`, song.feel].filter(Boolean).join(' · ');
  const hasLyric = song.lyric.trim().length > 0;
  /* A song with nothing in it yet has just been made, and the first thing it
     needs is a name. autoFocus only acts at mount, which is exactly then — and
     it is what lets a lesson go name, capo, Add without a wasted tap. */
  const fresh = !song.title.trim() && song.chords.length === 0 && !hasLyric;

  /**
   * "Looks right" is a claim about a finished song, so the two things it can be
   * wrong about get asked first. The capo is a hard stop — it has to be an
   * answer, not a default — while a song with no chords is only warned about,
   * because words on their own are a legitimate thing to print.
   */
  const finish = useCallback(() => {
    const capo = !capoChosen(song.capo);
    const chords = song.chords.length === 0;
    if (capo || chords) setChecking({ capo, chords });
    else onReady();
  }, [song.capo, song.chords.length, onReady]);

  const place = useCallback(
    (chordId: string | null) => {
      if (picking) onPlace(picking, chordId);
      setPicking(null);
    },
    [picking, onPlace],
  );

  /**
   * Who plays it, under the name in both layouts. It belongs with the title
   * rather than among the chips below, because it is part of naming a song —
   * and it is quieter than the title on purpose: most songs are reached for by
   * name, and an empty second box must not read as an unanswered question the
   * way the capo chip deliberately does.
   */
  const artistField = (
    <input
      className="artist-input"
      value={song.artist ?? ''}
      onChange={(e) => onArtist(e.target.value)}
      maxLength={MAX_ARTIST_CHARS}
      placeholder="Who plays it?"
      aria-label="Artist"
      autoComplete="off"
      spellCheck={false}
    />
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

  const footText = () =>
    toChord > 0
      ? `${Spell(toChord)} line${toChord === 1 ? '' : 's'} with no chords yet`
      : 'Every line has a chord';

  /* Every line, not a preview of the first few. This is the only screen where
     a chord is dropped on a word, so a line that is not drawn here is a line
     that can never be chorded. It used to stop after three and say "33 more
     lines below", of lines it had not rendered; `.song-body` scrolls, so there
     was never a reason to hold them back. */
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
            onWordClick={song.chords.length ? setPicking : undefined}
            selectedWordId={picking}
          />
          <p className="words-block-foot">
            <span>{footText()}</span>
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

  /**
   * One line about where this song stands with other people, and nothing at all
   * for a song that has never left: whose it was, whether they have changed
   * theirs since; or that it is shared, and whether the link is behind.
   *
   * The words are chosen to keep "version" out of it. Nobody thinks of a song
   * as having versions — it has been changed, or it has not.
   */
  const from = song.copiedFrom ? senderLabel(song.copiedFrom) : null;
  const status = (from || song.shared) && (
    <p className="song-status">
      {from && !update && <span>from {from}</span>}
      {from && update && (
        <>
          <ArrowsClockwise size={14} />
          <span>{from} has changed this song</span>
          <button type="button" className="btn-ghost" onClick={() => setDeciding(true)}>
            Get the new one
          </button>
        </>
      )}
      {song.shared && !changedSinceShared(song) && <span>Shared</span>}
      {song.shared && changedSinceShared(song) && (
        <>
          <ArrowsClockwise size={14} />
          <span>You&apos;ve changed this since you shared it</span>
          <button
            type="button"
            className="btn-ghost"
            disabled={sharing.busy}
            onClick={sharing.onShareChanges}
          >
            {sharing.busy ? 'Sharing…' : 'Share the changes'}
          </button>
        </>
      )}
      {sharing.error && <span className="is-error" role="alert">{sharing.error}</span>}
    </p>
  );

  /**
   * Always asked, never assumed — even for a copy that has not been touched.
   * There is no merge to offer: the two copies' words carry different ids
   * (`retokenise`), so it is theirs or mine, and only the player can say which.
   */
  const decide = deciding && update && (
    <>
      <button
        type="button"
        className="scrim"
        aria-label="Close"
        onClick={() => setDeciding(false)}
      />
      <div className="sheet" role="dialog" aria-label="The sender has changed this song">
        <i className="grab" />
        <h2>{from} has changed this song</h2>
        <button
          type="button"
          className="share-row"
          onClick={() => {
            setDeciding(false);
            onReplaceMine(update);
          }}
        >
          <Swap size={22} />
          <span>
            <strong>Replace mine</strong>
            <em>This song becomes their new one. Anything you changed in it is lost.</em>
          </span>
        </button>
        <button
          type="button"
          className="share-row"
          onClick={() => {
            setDeciding(false);
            onKeepMine(update);
          }}
        >
          <CopySimple size={22} />
          <span>
            <strong>Keep mine, and add the new one</strong>
            <em>Yours stays exactly as it is, and stops asking. Theirs arrives as a second song.</em>
          </span>
        </button>
        <button type="button" className="btn-ghost btn-block" onClick={() => setDeciding(false)}>
          Not now
        </button>
      </div>
    </>
  );

  /* Last thing on the screen, and quiet: it is the one action here with no
     undo, so it is out of the way of everything you come here to do. It was
     only on the Songs list, which is not where you are when you decide a song
     was a mistake. The sheet is the same one, and says what the delete reaches.
     It stays open until the song is gone — a shared song's delete can be
     refused, and then it has to say why. */
  const deleteRow = (
    <button type="button" className="btn-ghost song-delete" onClick={() => setDeleting(true)}>
      <Trash size={15} />
      Delete this song
    </button>
  );

  const deleteSheet = deleting && (
    <DeleteSongSheet
      song={song}
      memberships={memberships}
      busy={sharing.busy}
      error={sharing.error}
      onDelete={onDelete}
      onClose={() => setDeleting(false)}
    />
  );

  /**
   * The gate behind "Looks right". Capo choices are chips here rather than the
   * CapoChip's own menu: that menu is absolutely positioned, and inside a sheet
   * that scrolls its own overflow it would be clipped.
   */
  const check = checking && (
    <>
      <button
        type="button"
        className="scrim"
        aria-label="Close"
        onClick={() => setChecking(null)}
      />
      <div className="sheet" role="dialog" aria-label="Before you call it finished">
        <i className="grab" />
        <h2>{checking.capo && checking.chords ? 'Two things first' : 'One thing first'}</h2>

        {checking.chords && (
          <div className="check-row">
            <Warning size={20} />
            <span>
              <strong>No chords on this song yet</strong>
              <em>
                It will print as words on their own. That is allowed — this is only
                checking you meant it.
              </em>
            </span>
            <button type="button" className="btn-ghost" onClick={onAddChord}>
              Add one
            </button>
          </div>
        )}

        {checking.capo && (
          <div className="check-ask">
            <p className="check-ask-q">
              {capoChosen(song.capo) ? capoLabel(song.capo) : 'Is there a capo on?'}
            </p>
            <p className="check-ask-why">
              {capoChosen(song.capo)
                ? 'Change it here if that is not right.'
                : 'Nobody has said yet, and it moves every chord on the sheet.'}
            </p>
            <div className="chips">
              <button
                type="button"
                className={`chip${song.capo === null ? ' is-selected' : ''}`}
                onClick={() => onCapo(null)}
              >
                No capo
              </button>
              {CAPO_FRETS.map((fret) => (
                <button
                  key={fret}
                  type="button"
                  className={`chip${song.capo === fret ? ' is-selected' : ''}`}
                  onClick={() => onCapo(fret)}
                  aria-label={`Capo on the ${ordinal(fret)}`}
                >
                  {ordinal(fret)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="check-actions">
          <button
            type="button"
            className="btn-primary btn-block"
            disabled={!capoChosen(song.capo)}
            onClick={() => {
              setChecking(null);
              onReady();
            }}
          >
            {capoChosen(song.capo) ? 'Looks right' : 'Say about the capo first'}
            <ArrowRight size={16} />
          </button>
          <button
            type="button"
            className="btn-ghost btn-block"
            onClick={() => setChecking(null)}
          >
            Not yet
          </button>
        </div>
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
            <div className="song-head-titles">
              <input
                className="title-input display-md"
                value={song.title}
                onChange={(e) => onTitle(e.target.value)}
                autoFocus={fresh}
                maxLength={MAX_TITLE_CHARS}
                placeholder="Name this song"
                aria-label="Song title"
                autoComplete="off"
                spellCheck={false}
              />
              {artistField}
            </div>
            <div className="song-actions-d">
              <button type="button" className="btn-secondary" onClick={finish}>
                <Printer size={15} />
                Print for the stand
              </button>
              <button type="button" className="btn-primary" onClick={finish}>
                <PaperPlaneTilt size={15} />
                Send it to someone
              </button>
            </div>
          </div>
          <div className="song-meta">
            {meta && <span>{meta}</span>}
            <CapoChip capo={song.capo} onChange={onCapo} />
            <span className="spacer" />
            <SavedLine sync={sync} />
          </div>
          {status}
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
              className="btn-primary"
              onClick={onFullScreen}
              disabled={!hasLyric}
            >
              <ArrowsOutSimple size={15} />
              Play it
            </button>
          </div>
          {wordsBlock}
          {deleteRow}
        </div>
        {picker}
        {check}
        {decide}
        {deleteSheet}
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
            autoFocus={fresh}
            maxLength={MAX_TITLE_CHARS}
            placeholder="Name this song"
            aria-label="Song title"
            autoComplete="off"
            spellCheck={false}
          />
          {artistField}
          <span className="song-titles-sub">
            {meta && <em>{meta}</em>}
            {meta && <i className="divider-dot" />}
            <SavedLine sync={sync} />
          </span>
        </span>
      </header>

      <div className="song-body">
        <CapoChip capo={song.capo} onChange={onCapo} />
        {status}

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
        </div>
        {wordsBlock}
        {deleteRow}
      </div>

      {/* Both ways out of the builder, in words. Playing leads, because it is
          the one you come back for once the song is built; the other is the
          finishing step you take once. Full screen used to be an unlabelled
          expand icon halfway up the scroll, with "Looks right" the only thing
          named down here — so "how do I play this?" had no answer on the
          screen. With no words pasted there is nothing to read full screen, so
          the button is not offered rather than offered and refused. */}
      <div className="editor-action editor-actions">
        {hasLyric && (
          <button type="button" className="btn-primary btn-block song-play" onClick={onFullScreen}>
            <ArrowsOutSimple size={16} />
            Play it
          </button>
        )}
        <button
          type="button"
          className={`${hasLyric ? 'btn-secondary' : 'btn-primary'} btn-block`}
          onClick={finish}
        >
          Share or print
          {!hasLyric && <ArrowRight size={16} />}
        </button>
      </div>
      {picker}
      {check}
      {decide}
      {deleteSheet}
    </div>
  );
}
