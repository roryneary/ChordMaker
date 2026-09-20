import { Trash } from '@phosphor-icons/react';
import type { Membership } from '../lib/playlists';
import type { Song } from '../types/song';

interface Props {
  song: Song;
  /** The playlists it is in, which it will leave. */
  memberships: Membership[];
  /** A shared song's link is being taken down first, which needs the database. */
  busy: boolean;
  error: string | null;
  onDelete: () => void;
  onClose: () => void;
}

/** "Friday", "Friday and Wedding set", "Friday, Wedding set and Busking". */
function listOf(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * "Are you sure?", with the answer to "sure of what?" spelled out. A delete
 * here reaches further than the song: it leaves every playlist it is in
 * (`DELETE_SONG` sweeps them), and if it was shared its link dies with it. Each
 * of those is said before the button is pressed, by name, and only when true —
 * a song in no playlist, never shared, gets one plain sentence.
 *
 * There is no undo, so the sheet says that too, rather than implying a bin.
 */
export default function DeleteSongSheet({
  song,
  memberships,
  busy,
  error,
  onDelete,
  onClose,
}: Props) {
  const title = song.title.trim() || 'Untitled';
  // A song can be in one playlist twice; it is still one playlist it leaves.
  const playlists = [...new Set(memberships.map((m) => m.name))];

  return (
    <>
      <button type="button" className="scrim" aria-label="Close" onClick={onClose} />
      <div className="sheet" role="alertdialog" aria-label={`Delete ${title}`}>
        <i className="grab" />
        <h2>Delete “{title}”?</h2>

        <p className="field-note delete-note">
          It goes from this device and from your account. There is no getting it back.
        </p>

        {playlists.length > 0 && (
          <p className="field-note delete-note">
            It will leave {playlists.length === 1 ? 'the playlist' : 'the playlists'}{' '}
            <strong>{listOf(playlists)}</strong>.
          </p>
        )}

        {song.shared && (
          <p className="field-note delete-note">
            <strong>It is shared.</strong> Its link will stop working for everyone
            {song.shared.listed ? ', and it will leave Shared songs' : ''}. Copies people have
            already kept are theirs, and stay.
          </p>
        )}

        {error && (
          <p className="field-note is-error" role="alert">
            {error}
          </p>
        )}

        <div className="check-actions">
          <button type="button" className="btn-danger btn-block" disabled={busy} onClick={onDelete}>
            <Trash size={16} />
            {busy ? 'Deleting…' : 'Delete it'}
          </button>
          <button type="button" className="btn-ghost btn-block" onClick={onClose}>
            Keep it
          </button>
        </div>
      </div>
    </>
  );
}
