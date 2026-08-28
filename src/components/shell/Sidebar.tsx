import {
  BagSimple,
  GridFour,
  Guitar,
  PencilSimple,
  PlusCircle,
} from '@phosphor-icons/react';
import type { Route } from '../../app/routes';
import type { Song } from '../../types/song';
import { LIBRARY } from '../../data/chordLibrary';
import { lineCount, unchordedLineCount } from '../../lib/lyric';

interface Props {
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
export default function Sidebar({ route, songs, currentId, onGo, onStart }: Props) {
  const shown = songs.slice(0, SHOWN);
  const rest = songs.length - shown.length;

  return (
    <aside className="sidebar">
      <div className="brand">
        <Guitar size={20} weight="fill" />
        <span>Chord Creator</span>
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

      <div className="user-chip">
        <span className="avatar">D</span>
        <span className="user-meta">
          <strong>Dan</strong>
          <em>Busking since March</em>
        </span>
      </div>
    </aside>
  );
}
