import { useMemo, useState } from 'react';
import { CaretRight, Plus } from '@phosphor-icons/react';
import { cleanPlaylistName, playlistNameTaken, resolveItems } from '../lib/playlists';
import type { Playlist } from '../types/playlist';
import type { Song } from '../types/song';

interface Props {
  playlists: Playlist[];
  songs: Song[];
  onOpen: (playlistId: string) => void;
  /** Makes the playlist and goes into it. */
  onCreate: (name: string) => void;
}

/** "Wonderwall, Harbour Lights and 3 more" — enough to tell two sets apart. */
function preview(titles: string[]): string {
  if (!titles.length) return 'Nothing in it yet';
  const shown = titles.slice(0, 2).join(', ');
  const rest = titles.length - 2;
  return rest > 0 ? `${shown} and ${rest} more` : shown;
}

/**
 * Every playlist. A playlist is an ordered list of songs you already have — a
 * set for Saturday, the ones you are still learning — and a song can be in as
 * many as you like, or the same one twice.
 */
export default function Playlists({ playlists, songs, onOpen, onCreate }: Props) {
  const [name, setName] = useState('');
  const clean = cleanPlaylistName(name);
  const taken = clean.length > 0 && playlistNameTaken(playlists, clean);
  const n = playlists.length;

  const rows = useMemo(
    () =>
      playlists.map((p) => {
        const titles = resolveItems(p, songs).map(({ song }) => song.title.trim() || 'Untitled');
        return { playlist: p, count: titles.length, preview: preview(titles) };
      }),
    [playlists, songs],
  );

  return (
    <div className="songs">
      <h1 className="display-sm">Playlists</h1>
      <p className="library-sub">
        {n === 0
          ? 'Put songs in the order you play them: a set, a lesson, the ones still to learn.'
          : `${n} playlist${n === 1 ? '' : 's'}, on this device. No signal needed.`}
      </p>

      <form
        className="new-playlist"
        onSubmit={(e) => {
          e.preventDefault();
          if (!clean || taken) return;
          onCreate(clean);
          setName('');
        }}
      >
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name a new playlist"
          aria-label="New playlist name"
          autoComplete="off"
        />
        <button type="submit" className="btn-primary" disabled={!clean || taken}>
          <Plus size={15} /> Create
        </button>
      </form>
      {taken && <p className="field-note">You already have a playlist called that.</p>}

      {n > 0 && (
        <ul className="songs-list">
          {rows.map(({ playlist, count, preview: line }) => (
            <li key={playlist.id}>
              <button
                type="button"
                className="card playlist-card"
                onClick={() => onOpen(playlist.id)}
              >
                <span className="resume-titles">
                  <strong>{playlist.name}</strong>
                  <em>{line}</em>
                </span>
                <span className="tag">
                  {count} song{count === 1 ? '' : 's'}
                </span>
                <CaretRight size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
