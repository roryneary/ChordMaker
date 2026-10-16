import { useMemo, useState } from 'react';
import { Plus, SlidersHorizontal, UsersThree } from '@phosphor-icons/react';
import ChordOrientation from '../components/ChordOrientation';
import SongCard from '../components/SongCard';
import AddToPlaylistSheet from '../components/AddToPlaylistSheet';
import DeleteSongSheet from '../components/DeleteSongSheet';
import SongOpenSheet from '../components/SongOpenSheet';
import { type Membership, membershipBySong } from '../lib/playlists';
import { type SharingBlocked, globalAction, globalOffered } from '../lib/sharedSong';
import type { Playlist } from '../types/playlist';
import type { SharedSong } from '../types/sharedSong';
import type { Song } from '../types/song';

interface Props {
  songs: Song[];
  playlists: Playlist[];
  /* A tap on a song asks which of these three (`SongOpenSheet`). */
  onPlay: (songId: string) => void;
  onShare: (songId: string) => void;
  onEdit: (songId: string) => void;
  onOpenPlaylist: (membership: Membership) => void;
  onAddToPlaylist: (playlistId: string, songId: string) => void;
  onCreatePlaylist: (name: string, songId: string) => void;
  /** A new song, from here as from the home screen. */
  onStart: () => void;
  /** To the songs other people have shared. Here, not in the tab bar: that is full. */
  onFindShared: () => void;
  /** The sender's newer version of a song taken from them, if there is one. */
  updateFor: (song: Song) => SharedSong | null;
  /** Sharing, for one song: what the "Make available globally" box on its row drives. */
  sharingFor: (song: Song) => {
    blocked: SharingBlocked;
    busy: boolean;
    error: string | null;
    onShare: (listed: boolean) => void;
    onSetListed: (listed: boolean) => void;
    /** Deletes the song — after taking its link down, if it has one. */
    onDelete: () => void;
  };
  onSignIn: () => void;
  /** Everything the sideways toggle here is one of. */
  onSettings: () => void;
}

/**
 * Every song you have, most recently touched first.
 *
 * This was "the gig bag": the song list under a name that had to be explained,
 * built as a page of sections so playlists could move in above the songs. They
 * got a screen of their own instead (`Playlists`), and this one is called what
 * it is. The sidebar shows the last four songs and the tab bar shows none, so
 * this is the only way to reach an older song on a phone at all.
 *
 * Tapping a song asks what it is for: play it, share it or edit it. Elsewhere
 * a tap plays; here, the list you come to for a song to do something with.
 *
 * Each row says which playlists the song is in. Tapping one goes to that
 * playlist with the song picked out, which is what ties the two screens
 * together — from here you can see what is in a set, and what is in none.
 */
export default function Songs({
  songs,
  playlists,
  onPlay,
  onShare,
  onEdit,
  onOpenPlaylist,
  onAddToPlaylist,
  onCreatePlaylist,
  onStart,
  onFindShared,
  updateFor,
  sharingFor,
  onSignIn,
  onSettings,
}: Props) {
  const n = songs.length;
  const memberships = useMemo(() => membershipBySong(playlists), [playlists]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const adding = songs.find((s) => s.id === addingId) ?? null;
  const [openingId, setOpeningId] = useState<string | null>(null);
  const opening = songs.find((s) => s.id === openingId) ?? null;
  /* Held by id, and looked up each render: when the delete lands the song is
     no longer in `songs`, `deleting` is null, and the sheet closes itself. A
     shared song's delete waits on the database, so it cannot simply close on
     the tap — and if that fails it has to stay open to say why. */
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleting = songs.find((s) => s.id === deletingId) ?? null;

  /**
   * The box on each row, and the same box in the song's share sheet. What a
   * tick does is `globalAction`: shares a never-shared song straight into
   * Shared songs, lists one shared by link, and unticked takes it out of Shared
   * songs and only that — a link sent to someone still opens, and the row goes
   * on saying "Shared by link".
   */
  const globalFor = (song: Song) => {
    const sharing = sharingFor(song);
    if (!globalOffered(sharing.blocked)) return undefined;
    return {
      checked: song.shared?.listed === true,
      busy: sharing.busy,
      error: sharing.error,
      onChange: (next: boolean) => {
        const action = globalAction(song, sharing.blocked, next);
        if (action === 'signIn') onSignIn();
        else if (action === 'share') sharing.onShare(true);
        else if (action) sharing.onSetListed(next);
      },
    };
  };

  return (
    <div className="songs">
      {/* Always here, not only on an empty list: the tab bar has no "Start",
          so without it a phone with one song could only start a second from
          the home screen. */}
      <div className="songs-head">
        <h1 className="display-sm">Songs</h1>
        {n > 0 && (
          <button type="button" className="btn-primary songs-new" onClick={onStart}>
            <Plus size={14} weight="bold" />
            New song
          </button>
        )}
      </div>
      <p className="library-sub">
        {n === 0
          ? 'Every song you make is kept here, on this device. No signal needed.'
          : `${n} song${n === 1 ? '' : 's'}, on this device. No signal needed.`}
      </p>
      <div className="songs-tools">
        {/* Empty, the list's own "Find a shared song" says it louder. */}
        {n > 0 && (
          <button type="button" className="btn-ghost songs-find-shared" onClick={onFindShared}>
            <UsersThree size={15} />
            Find songs other people have shared
          </button>
        )}
        {/* The one pref worth a switch where the chords are: it changes every
            diagram on the page at once, so you see what it does. The rest are
            one tap further, under Settings. */}
        <span className="songs-view">
          <span className="songs-view-label">Chord orientation</span>
          <ChordOrientation />
          <button
            type="button"
            className="icon-btn"
            onClick={onSettings}
            aria-label="Settings"
            title="Settings"
          >
            <SlidersHorizontal size={17} />
          </button>
        </span>
      </div>

      {n === 0 ? (
        // Shared first: a finished song to play is a better first minute than
        // a blank one to fill, and you can make it your own from there.
        <div className="songs-empty">
          <p>No songs yet. Start with one someone has already shared.</p>
          <button type="button" className="btn-primary btn-block" onClick={onFindShared}>
            <UsersThree size={16} />
            Find a shared song
          </button>
          <button type="button" className="btn-secondary btn-block" onClick={onStart}>
            New song
          </button>
        </div>
      ) : (
        <ul className="songs-list">
          {songs.map((song) => (
            <li key={song.id}>
              <SongCard
                song={song}
                onOpen={setOpeningId}
                memberships={memberships.get(song.id)}
                onOpenPlaylist={onOpenPlaylist}
                onAddToPlaylist={setAddingId}
                changed={updateFor(song) !== null}
                global={globalFor(song)}
                onDelete={setDeletingId}
              />
            </li>
          ))}
        </ul>
      )}

      {opening && (
        <SongOpenSheet
          song={opening}
          onPlay={() => onPlay(opening.id)}
          onShare={() => onShare(opening.id)}
          onEdit={() => onEdit(opening.id)}
          onClose={() => setOpeningId(null)}
        />
      )}

      {deleting && (
        <DeleteSongSheet
          song={deleting}
          memberships={memberships.get(deleting.id) ?? []}
          busy={sharingFor(deleting).busy}
          error={sharingFor(deleting).error}
          onDelete={sharingFor(deleting).onDelete}
          onClose={() => setDeletingId(null)}
        />
      )}

      {adding && (
        <AddToPlaylistSheet
          song={adding}
          playlists={playlists}
          onAdd={(playlistId) => onAddToPlaylist(playlistId, adding.id)}
          onCreate={(name) => onCreatePlaylist(name, adding.id)}
          onClose={() => setAddingId(null)}
        />
      )}
    </div>
  );
}
