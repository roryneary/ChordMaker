import {
  GridFour,
  MusicNotes,
  PencilSimple,
  Playlist,
  PlusCircle,
  SlidersHorizontal,
  UserCircle,
  UsersThree,
} from '@phosphor-icons/react';
import type { Route } from '../../app/routes';
import type { Account } from '../../hooks/useAuth';
import type { SyncView } from '../../lib/syncStatus';
import VersionLine from '../VersionLine';
import { ChordCreatorLockup } from '../Brand';
import type { Song } from '../../types/song';
import { LIBRARY } from '../../data/chordLibrary';
import { lineCount, unchordedLineCount } from '../../lib/lyric';

interface Props {
  account: Account | null;
  /** Whether the account really has the songs. Never assumed — see lib/syncStatus.ts. */
  sync: SyncView;
  onAccount: () => void;
  onSignOut: () => Promise<void>;
  route: Route;
  songs: Song[];
  /** The few opened last, already cut to length — the same list the home screen shows. */
  recent: Song[];
  playlistCount: number;
  /** Added to the built-in shapes for the library's count: it holds both now. */
  myChordCount: number;
  currentId: string | null;
  onGo: (route: Route) => void;
  onOpenSong: (songId: string) => void;
  onStart: () => void;
}

/**
 * The line under the handle. It used to be the fixed words "Songs saved to
 * your account", printed over writes nobody checked; now it is whatever is
 * true, and when that is a failure it carries the way to try again.
 */
export function SyncLine({ sync }: { sync: SyncView }) {
  const failed = sync.phase === 'error';
  return (
    <>
      <em className={failed ? 'is-error' : undefined} role="status">
        {sync.label}
      </em>
      {failed && (
        <button type="button" className="sync-retry" onClick={sync.retry}>
          Try again
        </button>
      )}
    </>
  );
}

/**
 * The nav, and under it the few songs you opened last, with the open one
 * selected — a way straight back into the song you were in, which is not what
 * a nav item does.
 *
 * That list is headed "Recent", not "Your songs". It sat under the latter with
 * the same count as the Songs nav item beside it, so the sidebar appeared to
 * hold two song lists and to disagree with itself about which was which. Songs
 * is all of them and carries the count; this is the last few and carries none.
 */
export default function Sidebar({
  account,
  sync,
  onAccount,
  onSignOut,
  route,
  songs,
  recent,
  playlistCount,
  myChordCount,
  currentId,
  onGo,
  onOpenSong,
  onStart,
}: Props) {
  const inPlaylists =
    route.name === 'playlists' || route.name === 'playlist' || route.name === 'playlistAdd';
  const inShared = route.name === 'shared' || route.name === 'sharedSong';
  const shown = recent;
  const rest = songs.length - shown.length;

  return (
    <aside className="sidebar">
      <div className="brand">
        <ChordCreatorLockup size={28} />
      </div>

      <button type="button" className="nav-item" onClick={onStart}>
        <PlusCircle size={18} />
        <span>Start a song</span>
      </button>
      <button
        type="button"
        className={`nav-item${route.name === 'library' || route.name === 'myChord' ? ' is-active' : ''}`}
        onClick={() => onGo({ name: 'library' })}
      >
        <GridFour size={18} />
        <span>Chord library</span>
        <em className="nav-count">{LIBRARY.length + myChordCount}</em>
      </button>
      <button
        type="button"
        className={`nav-item${route.name === 'songs' ? ' is-active' : ''}`}
        onClick={() => onGo({ name: 'songs' })}
      >
        <MusicNotes size={18} />
        <span>Songs</span>
        <em className="nav-count">{songs.length}</em>
      </button>
      <button
        type="button"
        className={`nav-item${inPlaylists ? ' is-active' : ''}`}
        onClick={() => onGo({ name: 'playlists' })}
      >
        <Playlist size={18} />
        <span>Playlists</span>
        <em className="nav-count">{playlistCount}</em>
      </button>
      {/* No count: it is other people's, and knowing it would cost a query
          on every page load for a number nobody needs. */}
      <button
        type="button"
        className={`nav-item${inShared ? ' is-active' : ''}`}
        onClick={() => onGo({ name: 'shared' })}
      >
        <UsersThree size={18} />
        <span>Shared songs</span>
      </button>
      {/* Here as well as on the phone's account screen: signed in, the desktop
          never opens that screen, and these are the player's, not the account's. */}
      <button
        type="button"
        className={`nav-item${route.name === 'settings' ? ' is-active' : ''}`}
        onClick={() => onGo({ name: 'settings' })}
      >
        <SlidersHorizontal size={18} />
        <span>How you play</span>
      </button>

      <hr className="nav-rule" />

      <div className="nav-section">
        <span>Recent</span>
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
                onClick={() => onOpenSong(song.id)}
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
            <button
              type="button"
              className="song-row is-more"
              onClick={() => onGo({ name: 'songs' })}
            >
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
            <SyncLine sync={sync} />
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
            {/* A build with no database cannot keep that promise, so it does
                not make it. */}
            <em>{sync.phase === 'off' ? sync.label : 'Keep your songs on every device'}</em>
          </span>
        </button>
      )}

      {/* Signed in, the desktop never opens the account screen — the chip above
          carries its own Out button — so the build has to be readable here too,
          or half the users could not tell you which one they were on. */}
      <VersionLine />
    </aside>
  );
}
