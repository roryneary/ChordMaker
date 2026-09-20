import { useState } from 'react';
import { Check, Plus } from '@phosphor-icons/react';
import type { Playlist } from '../types/playlist';
import type { Song } from '../types/song';
import { cleanPlaylistName, playlistNameTaken } from '../lib/playlists';

interface Props {
  song: Song;
  playlists: Playlist[];
  onAdd: (playlistId: string) => void;
  /** Makes a playlist with this song already in it. */
  onCreate: (name: string) => void;
  onClose: () => void;
}

/**
 * Putting one song into a playlist, from the song's own row.
 *
 * A playlist the song is already in is shown ticked and cannot be tapped,
 * rather than being left off the list: leaving it off makes a sheet with two
 * of your three playlists look like a playlist has gone missing. Taking a song
 * *out* happens in the playlist, where you can see what you are removing.
 */
export default function AddToPlaylistSheet({ song, playlists, onAdd, onCreate, onClose }: Props) {
  const [name, setName] = useState('');
  const clean = cleanPlaylistName(name);
  const taken = clean.length > 0 && playlistNameTaken(playlists, clean);
  const title = song.title.trim() || 'Untitled';

  return (
    <>
      <button type="button" className="scrim" aria-label="Close" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={`Add ${title} to a playlist`}>
        <i className="grab" />
        <h2>Add “{title}” to…</h2>

        {playlists.length > 0 && (
          <ul className="pick-list">
            {playlists.map((p) => {
              const has = p.items.some((i) => i.songId === song.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className="pick-row"
                    disabled={has}
                    onClick={() => {
                      onAdd(p.id);
                      onClose();
                    }}
                  >
                    <span className="pick-row-name">{p.name}</span>
                    {has ? (
                      <span className="pick-row-note">
                        <Check size={14} weight="bold" /> Already in
                      </span>
                    ) : (
                      <span className="pick-row-note">
                        {p.items.length} song{p.items.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <form
          className="new-playlist"
          onSubmit={(e) => {
            e.preventDefault();
            if (!clean || taken) return;
            onCreate(clean);
            onClose();
          }}
        >
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={playlists.length ? 'Or a new playlist' : 'Name a new playlist'}
            aria-label="New playlist name"
            autoComplete="off"
          />
          <button type="submit" className="btn-primary" disabled={!clean || taken}>
            <Plus size={15} /> Create
          </button>
        </form>
        {taken && <p className="field-note">You already have a playlist called that.</p>}
      </div>
    </>
  );
}
