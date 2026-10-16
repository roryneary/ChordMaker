import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowsClockwise,
  ArrowsOutSimple,
  CaretLeft,
  CopySimple,
  PencilSimple,
  Plus,
  ShareNetwork,
  Swap,
  Trash,
} from '@phosphor-icons/react';
import CapoChip from '../components/CapoChip';
import ChordDiagram from '../components/ChordDiagram';
import DeleteSongSheet from '../components/DeleteSongSheet';
import MissingDetailsSheet from '../components/MissingDetailsSheet';
import SavedLine from '../components/SavedLine';
import SongNotes, { NoteDraft, NoteField, type NoteHandlers } from '../components/SongNotes';
import SongVideos, { type VideoHandlers } from '../components/SongVideos';
import LyricBlock from '../components/lyric/LyricBlock';
import { useIsDesktop } from '../components/shell/useBreakpoint';
import { detailsToAsk } from '../lib/details';
import { newId } from '../lib/id';
import { notesByWord } from '../lib/notes';
import type { Membership } from '../lib/playlists';
import {
  MAX_ARTIST_CHARS,
  MAX_TITLE_CHARS,
  changedSinceShared,
  senderLabel,
} from '../lib/sharedSong';
import type { SyncView } from '../lib/syncStatus';
import type { SharedSong } from '../types/sharedSong';
import type { SavedChord, Song, SongDetail } from '../types/song';

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
  /** Moves a chord along the row: the order the reading view pins them in. */
  onMoveChord: (chordId: string, to: number) => void;
  /** "Order as played": by the first word each chord is dropped on. */
  onOrderAsPlayed: () => void;
  /** How to play it: song-wide notes, patterns, and notes on words. */
  notesOn: NoteHandlers;
  /** Videos of it being played: added, labelled, removed. */
  videosOn: VideoHandlers;
  onTitle: (title: string) => void;
  /** Who plays it. Blank clears it — see the reducer's SET_ARTIST. */
  onArtist: (artist: string) => void;
  /** "Not needed for this song", from the missing-details sheet. */
  onNotNeeded: (detail: SongDetail, notNeeded: boolean) => void;
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

/* Songs made before this moment are ones being come back to, and a song is
   asked about what it is missing once a session — not again every time the
   screen is left for the words editor and returned to. */
const SESSION_START = Date.now();
const askedThisSession = new Set<string>();

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const spell = (n: number) => COUNT_WORDS[n] ?? String(n);

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
  onMoveChord,
  onOrderAsPlayed,
  notesOn,
  videosOn,
  onTitle,
  onArtist,
  onNotNeeded,
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
  /* Writing a note on the word being picked: opened from the word's sheet. */
  const [noting, setNoting] = useState(false);
  const byWord = notesByWord(song.notes);
  const pick = (wordId: string | null) => {
    setPicking(wordId);
    setNoting(false);
  };
  const [deleting, setDeleting] = useState(false);
  const [deciding, setDeciding] = useState(false);
  /* What was missing as the screen opened, held fixed while the sheet is up. */
  const [asking, setAsking] = useState<SongDetail[]>(() =>
    askedThisSession.has(song.id) ? [] : detailsToAsk(song, SESSION_START),
  );
  useEffect(() => {
    askedThisSession.add(song.id);
  }, [song.id]);
  const notesRef = useRef<HTMLDivElement>(null);
  /* Arranging: the tiles become ← / → instead of opening the editor. The one
     just moved is picked out, as a moved playlist row is, so a run of taps
     never loses track of which chord is travelling. */
  const [arranging, setArranging] = useState(false);
  const [movedId, setMovedId] = useState<string | null>(null);

  const meta = [song.key && `Key of ${song.key}`, song.feel].filter(Boolean).join(' · ');
  const hasLyric = song.lyric.trim().length > 0;
  /* The reading view shows chords on their own too, so there is something to
     play as soon as there is either. */
  const playable = hasLyric || song.chords.length > 0;
  /* A song with nothing in it yet has just been made, and the first thing it
     needs is a name. autoFocus only acts at mount, which is exactly then — and
     it is what lets a lesson go name, capo, Add without a wasted tap. */
  const fresh = !song.title.trim() && song.chords.length === 0 && !hasLyric;

  const place = useCallback(
    (chordId: string | null) => {
      if (picking) onPlace(picking, chordId);
      pick(null);
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

  const move = (chordId: string, to: number) => {
    setMovedId(chordId);
    onMoveChord(chordId, to);
  };

  const chordCell = (chord: SavedChord, big: boolean, i: number) => {
    const name = chord.spec.name.trim() || '—';
    if (!arranging) {
      return (
        <li key={chord.id}>
          <button type="button" className="card chord-tile" onClick={() => onEditChord(chord.id)}>
            <strong style={{ fontSize: big ? 22 : 18 }}>{name}</strong>
            <ChordDiagram spec={chord.spec} />
          </button>
        </li>
      );
    }
    const last = song.chords.length - 1;
    return (
      <li key={chord.id}>
        <div className={`card chord-tile is-arranging${movedId === chord.id ? ' is-moved' : ''}`}>
          <strong style={{ fontSize: big ? 22 : 18 }}>{name}</strong>
          <ChordDiagram spec={chord.spec} />
          <span className="chord-move">
            <button
              type="button"
              className="icon-btn"
              disabled={i === 0}
              onClick={() => move(chord.id, i - 1)}
              aria-label={`Move ${name} earlier`}
            >
              <ArrowLeft size={16} />
            </button>
            <button
              type="button"
              className="icon-btn"
              disabled={i === last}
              onClick={() => move(chord.id, i + 1)}
              aria-label={`Move ${name} later`}
            >
              <ArrowRight size={16} />
            </button>
          </span>
        </div>
      </li>
    );
  };

  /* Only worth offering when there is an order to arrange. "As played" only
     when there are chords on the words to read the order from. */
  const placedAny = Object.keys(song.placements).length > 0;
  const arrangeTools = song.chords.length > 1 && (
    <span className="arrange-tools">
      {arranging && placedAny && (
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            setMovedId(null);
            onOrderAsPlayed();
          }}
        >
          Order as played
        </button>
      )}
      <button
        type="button"
        className={arranging ? 'btn-secondary' : 'btn-ghost'}
        aria-pressed={arranging}
        onClick={() => {
          setArranging((on) => !on);
          setMovedId(null);
        }}
      >
        {arranging ? 'Done' : 'Arrange'}
      </button>
    </span>
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

  const notesHead = (
    <div className="label-row" ref={notesRef}>
      <h2>Notes</h2>
      <span>how to play it — strumming, picking, anything</span>
    </div>
  );
  const notesBlock = <SongNotes notes={song.notes} words={song.words} on={notesOn} newId={newId} />;

  /* Beside the notes, because it answers the same question — how does this go —
     by showing rather than telling. */
  const videosBlock = (
    <>
      <div className="label-row label-row-videos">
        <h2>Videos</h2>
        <span>see how it is played</span>
      </div>
      <SongVideos videos={song.videos} on={videosOn} />
    </>
  );

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
            /* Always tappable: a word takes a note even before there are chords. */
            onWordClick={pick}
            selectedWordId={picking}
            notes={byWord}
          />
          {!isDesktop && (
            <p className="words-block-foot">
              <button type="button" className="btn-ghost" onClick={onEditWords}>
                Edit the words
              </button>
            </p>
          )}
        </>
      ) : (
        <button type="button" className="words-empty" onClick={onEditWords}>
          Paste the words in — you&apos;ll drop the chords on afterwards.
        </button>
      )}
    </div>
  );

  const pickedWord = picking ? song.words.find((w) => w.id === picking) : undefined;
  const wordNotes = picking ? (byWord.get(picking) ?? []) : [];
  const picker = picking && (
    <>
      <button type="button" className="scrim" aria-label="Close" onClick={() => pick(null)} />
      <div className="sheet" role="dialog" aria-label={`“${pickedWord?.text ?? ''}”`}>
        <i className="grab" />
        <h2>
          {song.chords.length ? 'Which chord lands here?' : `“${pickedWord?.text ?? ''}”`}
        </h2>
        {song.chords.length === 0 && (
          <p className="note-hint">Add a chord to the song to drop one here. A note can go on it now.</p>
        )}
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
        {/* Notes on this word: the way to say how one part of the song goes. */}
        <div className="sheet-notes">
          {wordNotes.map((note) => (
            <NoteField key={`${note.id}:${note.text}`} note={note} on={notesOn} />
          ))}
          {noting ? (
            <NoteDraft
              kind="general"
              wordId={picking}
              onAdd={notesOn.onAdd}
              onDone={() => setNoting(false)}
              newId={newId}
            />
          ) : (
            <button type="button" className="btn-ghost" onClick={() => setNoting(true)}>
              {wordNotes.length ? 'Add another note here' : 'Add a note here'}
            </button>
          )}
        </div>
        <button type="button" className="btn-secondary btn-block" onClick={() => pick(null)}>
          {song.chords.length && !noting ? 'Not yet' : 'Done'}
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

  const detailsSheet = asking.length > 0 && (
    <MissingDetailsSheet
      song={song}
      asking={asking}
      onArtist={onArtist}
      onNotNeeded={onNotNeeded}
      onWriteNote={() => {
        setAsking([]);
        notesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }}
      onClose={() => setAsking([])}
    />
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
            {/* One way out to everywhere a song goes — link, picture, page,
                Shared songs — and the same sheet a song's row on Songs opens.
                "Print for the stand" beside it went to that sheet too, so it
                was a second name for one door. The capo is asked there. */}
            <div className="song-actions-d">
              <button type="button" className="btn-primary" onClick={onReady}>
                <ShareNetwork size={15} />
                Share song
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
            <span className="spacer" />
            {arrangeTools}
          </div>
          <ul className="chord-tiles chord-tiles-d">
            {song.chords.map((c, i) => chordCell(c, true, i))}
            {!arranging && addCell('Next chord', true)}
          </ul>

          {notesHead}
          {notesBlock}
          {videosBlock}

          <div className="label-row label-row-words">
            <h2>The words</h2>
            <span>
              {hasLyric ? 'drop a chord, or a note, on the word it lands on' : 'not pasted yet'}
            </span>
            <span className="spacer" />
            <button type="button" className="btn-ghost" onClick={onEditWords}>
              <PencilSimple size={15} />
              Edit the words
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={onFullScreen}
              disabled={!playable}
            >
              <ArrowsOutSimple size={15} />
              Play it
            </button>
          </div>
          {wordsBlock}
          {deleteRow}
        </div>
        {picker}
        {decide}
        {deleteSheet}
        {detailsSheet}
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
          <span className="spacer" />
          {arrangeTools}
        </div>
        <ul className="chord-tiles">
          {song.chords.map((c, i) => chordCell(c, false, i))}
          {!arranging && addCell('Add', false)}
        </ul>

        {notesHead}
        {notesBlock}
        {videosBlock}

        <div className="label-row">
          <h2>The words</h2>
          <span>{hasLyric ? 'tap a word for a chord or a note' : 'not pasted yet'}</span>
        </div>
        {wordsBlock}
        {deleteRow}
      </div>

      {/* Both ways out of the builder, in words. Playing leads, because it is
          the one you come back for once the song is built; the other is the
          finishing step you take once. Full screen used to be an unlabelled
          expand icon halfway up the scroll, with "Looks right" the only thing
          named down here — so "how do I play this?" had no answer on the
          screen. With nothing on the song yet there is nothing to read, so the
          button is not offered rather than offered and refused. */}
      <div className="editor-action editor-actions">
        {playable && (
          <button type="button" className="btn-primary btn-block song-play" onClick={onFullScreen}>
            <ArrowsOutSimple size={16} />
            Play it
          </button>
        )}
        <button
          type="button"
          className={`${playable ? 'btn-secondary' : 'btn-primary'} btn-block`}
          onClick={onReady}
        >
          Share song
          {!playable && <ArrowRight size={16} />}
        </button>
      </div>
      {picker}
      {decide}
      {deleteSheet}
      {detailsSheet}
    </div>
  );
}
