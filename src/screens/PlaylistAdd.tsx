import { useMemo, useState } from 'react';
import { CaretLeft, MagnifyingGlass } from '@phosphor-icons/react';
import { matchesQuery } from '../lib/playlists';
import { songSubLine } from '../lib/songSummary';
import type { Playlist } from '../types/playlist';
import type { Song } from '../types/song';

interface Props {
  playlist: Playlist;
  songs: Song[];
  onAdd: (songIds: string[]) => void;
  onBack: () => void;
}

/**
 * Picking songs for a playlist, several at a time.
 *
 * A song already in the playlist is listed, ticked and locked, rather than
 * hidden: hiding it makes a long library look as if songs have gone missing,
 * and the tick answers "did I already add that?" without going back to look.
 * The model allows the same song twice (item ids exist for it); this screen
 * just does not offer it, because by far the likelier tap is a mistake.
 */
export default function PlaylistAdd({ playlist, songs, onAdd, onBack }: Props) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  const already = useMemo(() => new Set(playlist.items.map((i) => i.songId)), [playlist.items]);
  const matches = useMemo(() => songs.filter((s) => matchesQuery(s, query)), [songs, query]);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="songs has-footer">
      <div className="library-head">
        <button type="button" className="icon-btn accent" onClick={onBack} aria-label="Back">
          <CaretLeft size={20} />
        </button>
        <div>
          <h1 className="display-sm">Add songs</h1>
          <p className="library-sub">To “{playlist.name}”, in the order you tick them.</p>
        </div>
      </div>

      <div className="search">
        <MagnifyingGlass size={16} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a song"
          aria-label="Find a song"
        />
      </div>

      {songs.length === 0 ? (
        <p className="library-empty">No songs yet, so there is nothing to add.</p>
      ) : matches.length === 0 ? (
        <p className="library-empty">Nothing matches “{query.trim()}”.</p>
      ) : (
        <ul className="pick-list">
          {matches.map((song) => {
            const has = already.has(song.id);
            return (
              <li key={song.id}>
                <label className={`pick-row is-check${has ? ' is-locked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={has || picked.includes(song.id)}
                    disabled={has}
                    onChange={() => toggle(song.id)}
                  />
                  <span className="pick-row-name">
                    <strong>{song.title.trim() || 'Untitled'}</strong>
                    <em>{songSubLine(song)}</em>
                  </span>
                  {has && <span className="tag">In playlist</span>}
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <div className="pick-footer">
        <button
          type="button"
          className="btn-primary btn-block"
          disabled={picked.length === 0}
          onClick={() => onAdd(picked)}
        >
          {picked.length === 0
            ? 'Tick the songs to add'
            : `Add ${picked.length} song${picked.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  );
}
