import { useEffect, useState } from 'react';
import ChordDiagram from '../components/ChordDiagram';
import { firebaseEnabled } from '../lib/firebase';
import { copyOf, senderLabel } from '../lib/sharedSong';
import { LIBRARY_PAGE, fetchListed, searchListed } from '../lib/sharedSongSync';
import { errorCode, syncErrorReason } from '../lib/syncStatus';
import type { SharedCard } from '../types/sharedSong';
import type { Song } from '../types/song';

interface Props {
  /** Signed in with a handle. The library is for people on the platform. */
  signedIn: boolean;
  /** This library, to mark what has already been kept, or is the player's own. */
  songs: Song[];
  onOpen: (shareId: string) => void;
  onSignIn: () => void;
}

const SEARCH_DELAY_MS = 300;

/**
 * Songs other people have chosen to show. Only those: a song shared by link
 * alone never appears here, and there is no way to make it (`firestore.rules`
 * closes `list` on the songs themselves; this reads their owners' cards).
 *
 * It is the one screen that is no use without a signal, and says so rather
 * than showing a stale list — what is here is other people's to change or take
 * away. Everything *kept* from it is a song like any other, on this device.
 *
 * Search is by the start of the title, because that is the text search the
 * database can do unaided. It is honest about it in the placeholder.
 */
export default function SharedLibrary({ signedIn, songs, onOpen, onSignIn }: Props) {
  const [text, setText] = useState('');
  const [cards, setCards] = useState<SharedCard[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [reason, setReason] = useState('');
  const [more, setMore] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const query = text.trim();
  const available = firebaseEnabled && signedIn;

  useEffect(() => {
    if (!available) return;
    let cancelled = false;
    // Typing waits a beat; the first load and a cleared box do not.
    const timer = window.setTimeout(
      () => {
        (query ? searchListed(query) : fetchListed()).then(
          (found) => {
            if (cancelled) return;
            setCards(found);
            // A search shows its first page only: narrow it by typing more.
            setMore(!query && found.length === LIBRARY_PAGE);
            setState('ready');
          },
          (err: unknown) => {
            if (cancelled) return;
            console.error('Could not load the shared songs', err);
            setReason(syncErrorReason(errorCode(err)));
            setState('failed');
          },
        );
      },
      query ? SEARCH_DELAY_MS : 0,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [available, query, attempt]);

  const loadMore = () => {
    const last = cards[cards.length - 1];
    if (!last) return;
    setMore(false);
    fetchListed(last).then(
      (next) => {
        setCards((have) => [...have, ...next.filter((c) => !have.some((h) => h.id === c.id))]);
        setMore(next.length === LIBRARY_PAGE);
      },
      () => setMore(true),
    );
  };

  const heading = (
    <>
      <h1 className="display-sm">Shared songs</h1>
      <p className="library-sub">
        Songs people have chosen to show. Keep one and it is yours, to change however you like.
      </p>
    </>
  );

  if (!firebaseEnabled) {
    return (
      <div className="songs">
        {heading}
        <div className="songs-empty">
          <p>This build has no database, so there is nothing to browse.</p>
        </div>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="songs">
        {heading}
        <div className="songs-empty">
          <p>
            Browsing is for people signed in. A link someone sends you opens without an account.
          </p>
          <button type="button" className="btn-primary btn-block" onClick={onSignIn}>
            Sign in
          </button>
        </div>
      </div>
    );
  }

  const noteFor = (card: SharedCard): string | null => {
    if (songs.some((s) => s.shared?.shareId === card.id)) return 'Yours';
    return copyOf(songs, card.id) ? 'Kept' : null;
  };

  return (
    <div className="songs">
      {heading}
      <input
        className="input shared-search"
        type="search"
        value={text}
        onChange={(e) => {
          // "Looking" is said by what asks for a look, not by the effect that does it.
          if (e.target.value.trim() !== query) setState('loading');
          setText(e.target.value);
        }}
        placeholder="Find a song by the start of its title"
        aria-label="Find a shared song by the start of its title"
        autoComplete="off"
      />

      {state === 'failed' && (
        <div className="songs-empty">
          <p>Could not load the shared songs: {reason}.</p>
          <button
            type="button"
            className="btn-secondary btn-block"
            onClick={() => {
              setState('loading');
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </button>
        </div>
      )}

      {state === 'loading' && cards.length === 0 && <p className="field-note">Looking…</p>}

      {state === 'ready' && cards.length === 0 && (
        <div className="songs-empty">
          <p>
            {query
              ? `Nothing shared starts with “${query}”.`
              : 'Nobody has shown a song here yet. Yours could be the first: tick “Make available globally” on one of your songs.'}
          </p>
        </div>
      )}

      {state !== 'failed' && cards.length > 0 && (
        <ul className="songs-list">
          {cards.map((card) => {
            const note = noteFor(card);
            return (
              <li key={card.id}>
                <div className="card song-card">
                  <button type="button" className="song-card-open" onClick={() => onOpen(card.id)}>
                    <span className="resume-head">
                      <span className="resume-titles">
                        <strong>{card.title.trim() || 'Untitled'}</strong>
                        <em>
                          {senderLabel(card)} · {card.chordCount} chord
                          {card.chordCount === 1 ? '' : 's'}
                        </em>
                      </span>
                      {note && <span className="tag">{note}</span>}
                    </span>
                    {card.firstChords.length > 0 && (
                      <span className="resume-chords">
                        {card.firstChords.map((spec, i) => (
                          <ChordDiagram key={i} spec={spec} width={44} />
                        ))}
                      </span>
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {more && state === 'ready' && (
        <button type="button" className="btn-secondary shared-more" onClick={loadMore}>
          Show more
        </button>
      )}
    </div>
  );
}
