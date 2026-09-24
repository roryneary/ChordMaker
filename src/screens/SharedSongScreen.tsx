import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CaretLeft } from '@phosphor-icons/react';
import CapoChip from '../components/CapoChip';
import ChordDiagram from '../components/ChordDiagram';
import LyricBlock from '../components/lyric/LyricBlock';
import { firebaseEnabled } from '../lib/firebase';
import { fetchShared } from '../lib/sharedSongSync';
import { copyOf, senderLabel } from '../lib/sharedSong';
import type { SharedSong } from '../types/sharedSong';
import type { Song } from '../types/song';

interface Props {
  shareId: string;
  /** This library, to tell whether the song is already here — kept, or the owner's own. */
  songs: Song[];
  onKeep: (shared: SharedSong) => void;
  onOpenSong: (songId: string) => void;
  onBack: () => void;
}

type Loaded =
  | { status: 'loading' }
  | { status: 'ready'; shared: SharedSong }
  /** No such shared song: the owner stopped sharing it, or the link is mangled. */
  | { status: 'gone' }
  | { status: 'failed' };

/**
 * Where a link sent to the band lands, and what a row in Shared songs opens.
 *
 * It asks nothing of whoever arrives: no account, no sign-in, the song straight
 * away. That is the whole reason a shared song is a document anyone holding its
 * id can read. Keeping it makes a song of their own on this device, exactly as
 * if they had typed it; signing in later backs it up like any other.
 *
 * Read-only, and deliberately not the song screen with the controls disabled:
 * this is someone else's song until it is kept, and there is one thing to do.
 */
export default function SharedSongScreen({ shareId, songs, onKeep, onOpenSong, onBack }: Props) {
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!firebaseEnabled) return;
    let cancelled = false;
    fetchShared(shareId).then(
      (shared) => {
        if (!cancelled) setLoaded(shared ? { status: 'ready', shared } : { status: 'gone' });
      },
      (err: unknown) => {
        console.error('Could not open the shared song', err);
        if (!cancelled) setLoaded({ status: 'failed' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [shareId, attempt]);

  /* "Loading" is set by whatever asks for a load — here, and the initial state —
     and not by the effect. The screen is keyed by share id (App.tsx), so a
     different song is a fresh mount that starts out loading anyway. */
  const retry = useCallback(() => {
    setLoaded({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  const bar = (
    <div className="editor-bar">
      <button type="button" className="icon-btn accent" onClick={onBack} aria-label="Back">
        <CaretLeft size={20} />
      </button>
    </div>
  );

  const message = (heading: string, detail: string, action?: { label: string; run: () => void }) => (
    <div className="ready">
      {bar}
      <div className="ready-body">
        <h1 className="display-sm">{heading}</h1>
        <p className="library-sub">{detail}</p>
        {action && (
          <div className="songs-empty">
            <button type="button" className="btn-secondary btn-block" onClick={action.run}>
              {action.label}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (!firebaseEnabled) {
    return message('Nothing to open', 'This build has no database, so it cannot open shared songs.');
  }
  if (loaded.status === 'loading') return message('Opening the song…', 'One moment.');
  if (loaded.status === 'gone') {
    return message(
      'This song is no longer shared',
      'Whoever sent it has stopped sharing it, or the link lost a piece on the way. Ask them to send it again.',
    );
  }
  if (loaded.status === 'failed') {
    return message('Could not open the song', 'A shared song needs a signal the first time.', {
      label: 'Try again',
      run: retry,
    });
  }

  const { shared } = loaded;
  const song = shared.song;
  const own = songs.find((s) => s.shared?.shareId === shared.id) ?? null;
  const mine = copyOf(songs, shared.id);
  const nameOf = (chordId: string) =>
    song.chords.find((c) => c.id === chordId)?.spec.name.trim() || null;
  const meta = [
    song.artist?.trim() || null,
    song.chords.length ? `${song.chords.length} chords` : null,
    song.key ? `key of ${song.key}` : null,
    song.feel || null,
  ]
    .filter(Boolean)
    .join(' · ');

  const action = own
    ? { label: 'This is your song — open it', run: () => onOpenSong(own.id), note: null }
    : mine
      ? {
          label: 'Open my copy',
          run: () => onOpenSong(mine.id),
          note: 'You have already kept this one.',
        }
      : {
          label: 'Keep this song',
          run: () => onKeep(shared),
          note: 'It becomes yours: on this device, to change however you like.',
        };

  return (
    <div className="ready">
      {bar}
      <div className="ready-body">
        <p className="kicker">from {senderLabel(shared)}</p>
        <h1 className="display-lg">{song.title.trim() || 'Untitled'}</h1>
        {meta && <p className="ready-meta">{meta}</p>}

        <CapoChip capo={song.capo} variant="statement" />

        {song.chords.length > 0 && (
          <ul className="ready-chords">
            {song.chords.map((c) => (
              <li key={c.id}>
                <strong>{c.spec.name.trim() || '—'}</strong>
                <ChordDiagram spec={c.spec} width={56} />
              </li>
            ))}
          </ul>
        )}

        {song.lyric.trim() && (
          <>
            <hr className="rule" />
            <LyricBlock
              lyric={song.lyric}
              words={song.words}
              placements={song.placements}
              nameOf={nameOf}
              sizes={{ word: 18, chord: 12.5 }}
            />
          </>
        )}
      </div>

      <div className="editor-action">
        {action.note && <p className="field-note shared-note">{action.note}</p>}
        <button type="button" className="btn-primary btn-block" onClick={action.run}>
          {action.label}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
