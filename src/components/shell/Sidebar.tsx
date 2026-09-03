import { BagSimple, GridFour, PencilSimple, PlusCircle, UserCircle } from '@phosphor-icons/react';
import type { Route } from '../../app/routes';
import type { Account } from '../../hooks/useAuth';
import { ChordCreatorLockup } from '../Brand';
import type { Song } from '../../types/song';
import { LIBRARY } from '../../data/chordLibrary';
import { lineCount, unchordedLineCount } from '../../lib/lyric';

interface Props {
  account: Account | null;
  onAccount: () => void;
  onSignOut: () => Promise<void>;
  route: Route;
  songs: Song[];
  currentId: string | null;
  onGo: (route: Route) => void;
  onStart: () => void;
}

const SHOWN = 4;

/**
 * The sidebar IS the song list, and the open song is selected in it. There is
 * deliberately no "Your songs" nav item: the list below makes it redundant, and
 * an active nav item claiming "list" while the main pane shows one song was a
 * real inconsistency in an earlier revision.
 */
export default function Sidebar({
  account,
  onAccount,
  onSignOut,
  route,
  songs,
  currentId,
  onGo,
  onStart,
}: Props) {
  const shown = songs.slice(0, SHOWN);
  const rest = songs.length - shown.length;

  return (
    <aside className="sidebar">
      <div className="brand">
        <ChordCreatorLockup size={28} />
      </div>

      <button type="button" className="nav-item" onClick={onStart}>
        <PlusCircle size={18} />
        <span>Start something</span>
      </button>
      <button
        type="button"
        className={`nav-item${route.name === 'library' ? ' is-active' : ''}`}
        onClick={() => onGo({ name: 'library' })}
      >
        <GridFour size={18} />
        <span>Chord library</span>
        <em className="nav-count">{LIBRARY.length}</em>
      </button>
      <button type="button" className="nav-item">
        <BagSimple size={18} />
        <span>Gig bag</span>
      </button>

      <hr className="nav-rule" />

      <div className="nav-section">
        <span>Your songs</span>
        <em>{songs.length}</em>
      </div>

      <ul className="song-list">
        {shown.map((song) => {
          const open = song.id === currentId;
          const toChord = unchordedLineCount(
            song.words,
            song.placements,
            lineCount(song.lyric),
          );
          return (
            <li key={song.id}>
              <button
                type="button"
                className={`song-row${open ? ' is-open' : ''}`}
                onClick={() => onGo({ name: 'song', songId: song.id })}
              >
                <span className="song-row-title">
                  {open && <PencilSimple size={13} weight="fill" />}
                  {song.title.trim() || 'Untitled'}
                </span>
                {open && (
                  <span className="song-row-sub">
                    open{toChord > 0 ? ` · ${toChord} lines to chord` : ''}
                  </span>
                )}
              </button>
            </li>
          );
        })}
        {rest > 0 && (
          <li>
            <button type="button" className="song-row is-more">
              See all {songs.length}
            </button>
          </li>
        )}
        {songs.length === 0 && <li className="song-empty">Nothing yet.</li>}
      </ul>

      {/* The handle, not the email: the sidebar is over someone's shoulder at
          a rehearsal as often as it is not. Signed out, the same slot is the
          way in — an invitation, never a wall. */}
      {account?.handle ? (
        <div className="user-chip">
          <span className="avatar">{(account.display ?? account.handle).charAt(0).toUpperCase()}</span>
          <span className="user-meta">
            <strong>@{account.handle}</strong>
            <em>Songs saved to your account</em>
          </span>
          <button type="button" className="btn-ghost" onClick={() => void onSignOut()}>
            Out
          </button>
        </div>
      ) : (
        <button type="button" className="user-chip is-action" onClick={onAccount}>
          <span className="avatar">
            <UserCircle size={20} />
          </span>
          <span className="user-meta">
            <strong>Sign in</strong>
            <em>Keep your songs on every device</em>
          </span>
        </button>
      )}
    </aside>
  );
}
