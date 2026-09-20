import { useMemo, useState } from 'react';
import { UsersThree } from '@phosphor-icons/react';
import SongCard from '../components/SongCard';
import AddToPlaylistSheet from '../components/AddToPlaylistSheet';
import DeleteSongSheet from '../components/DeleteSongSheet';
import { type Membership, membershipBySong } from '../lib/playlists';
import type { SharingBlocked } from '../components/ShareLinkSheet';
import type { Playlist } from '../types/playlist';
import type { SharedSong } from '../types/sharedSong';
import type { Song } from '../types/song';

interface Props {
  songs: Song[];
  playlists: Playlist[];
  onOpen: (songId: string) => void;
  onOpenPlaylist: (membership: Membership) => void;
  onAddToPlaylist: (playlistId: string, songId: string) => void;
  onCreatePlaylist: (name: string, songId: string) => void;
  onNewSong: () => void;
  onJustChords: () => void;
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
 * Each row says which playlists the song is in. Tapping one goes to that
 * playlist with the song picked out, which is what ties the two screens
 * together — from here you can see what is in a set, and what is in none.
 */
export default function Songs({
  songs,
  playlists,
  onOpen,
  onOpenPlaylist,
  onAddToPlaylist,
  onCreatePlaylist,
  onNewSong,
  onJustChords,
  onFindShared,
  updateFor,
  sharingFor,
  onSignIn,
}: Props) {
  const n = songs.length;
  const memberships = useMemo(() => membershipBySong(playlists), [playlists]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const adding = songs.find((s) => s.id === addingId) ?? null;
  /* Held by id, and looked up each render: when the delete lands the song is
     no longer in `songs`, `deleting` is null, and the sheet closes itself. A
     shared song's delete waits on the database, so it cannot simply close on
     the tap — and if that fails it has to stay open to say why. */
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleting = songs.find((s) => s.id === deletingId) ?? null;

  /**
   * The box on each row. Ticking it is the whole of "share this with everyone":
   * a song that has never been shared is shared, straight into Shared songs;
   * one already shared by link is added to it. Unticking takes it back out —
   * and only that. The link, if there is one, still opens, because it may have
   * been sent to someone; the row says "Shared by link", and stopping altogether
   * is in the song's own share sheet.
   *
   * Signed out, the box is still there and leads to sign-in: a shared song
   * carries a name, and hiding the box would hide that sharing exists at all.
   * With no database, or no way to make a safe link, there is nothing it could
   * do, so it is not drawn.
   */
  const globalFor = (song: Song) => {
    const sharing = sharingFor(song);
    if (sharing.blocked === 'noDatabase' || sharing.blocked === 'noCrypto') return undefined;
    return {
      checked: song.shared?.listed === true,
      busy: sharing.busy,
      error: sharing.error,
      onChange: (next: boolean) => {
        if (sharing.blocked === 'signedOut') onSignIn();
        else if (song.shared) sharing.onSetListed(next);
        else if (next) sharing.onShare(true);
      },
    };
  };

  return (
    <div className="songs">
      <h1 className="display-sm">Songs</h1>
      <p className="library-sub">
        {n === 0
          ? 'Every song you make is kept here, on this device. No signal needed.'
          : `${n} song${n === 1 ? '' : 's'}, on this device. No signal needed.`}
      </p>
      <button type="button" className="btn-ghost songs-find-shared" onClick={onFindShared}>
        <UsersThree size={15} />
        Find songs other people have shared
      </button>

      {n === 0 ? (
        <div className="songs-empty">
          <p>No songs yet.</p>
          <button type="button" className="btn-primary btn-block" onClick={onJustChords}>
            Start with just the chords
          </button>
          <button type="button" className="btn-secondary btn-block" onClick={onNewSong}>
            Start with the words
          </button>
        </div>
      ) : (
        <ul className="songs-list">
          {songs.map((song) => (
            <li key={song.id}>
              <SongCard
                song={song}
                onOpen={onOpen}
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
