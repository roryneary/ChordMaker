import { Plus, Trash } from '@phosphor-icons/react';
import type { Song } from '../types/song';
import type { Membership } from '../lib/playlists';
import ChordDiagram from './ChordDiagram';
import { songSubLine } from '../lib/songSummary';

/**
 * How many diagrams the preview row renders. The row shows however many fit the
 * card's width and clips the rest, so this is a ceiling on the work rather than
 * the number seen: at 44px a slot, more than this cannot fit any card the
 * layout allows (the list stops at 640px wide, which is eleven slots).
 */
const PREVIEW_CHORDS = 16;

interface Props {
  song: Song;
  onOpen: (songId: string) => void;
  /** The playlists this song is in. Each becomes a pill. */
  memberships?: Membership[];
  /** Opens that playlist at this song. Without it the pills are not drawn. */
  onOpenPlaylist?: (membership: Membership) => void;
  /** Offers "add to a playlist" on the row. */
  onAddToPlaylist?: (songId: string) => void;
  /** Whoever this was taken from has changed theirs since. The song screen has the choice. */
  changed?: boolean;
  /**
   * "Make available globally": whether this song shows in Shared songs, as a
   * checkbox on the row. Without it the checkbox is not drawn — the home
   * screen's card has none, and nor does a build with no database.
   */
  global?: {
    checked: boolean;
    /** On its way to the database. The box waits; the rest of the list does not. */
    busy: boolean;
    /** Why the last change did not go through, in words. */
    error: string | null;
    onChange: (next: boolean) => void;
  };
  /** Offers "delete" on the row. It asks first — see `DeleteSongSheet`. */
  onDelete?: (songId: string) => void;
}

/**
 * One song, as a thing to pick up: its name, how far along it is, and its
 * first few shapes. The home screen shows one for the latest song and the
 * Songs screen shows one for every song.
 *
 * On the Songs screen it also says which playlists the song is in, as pills
 * that open the playlist at that song. That is why the card is a box with a
 * button in it rather than one big button, which is what it used to be: a pill
 * is a control of its own, and a button cannot hold another.
 */
export default function SongCard({
  song,
  onOpen,
  memberships = [],
  onOpenPlaylist,
  onAddToPlaylist,
  changed = false,
  global,
  onDelete,
}: Props) {
  const pills = onOpenPlaylist ? memberships : [];
  const title = song.title.trim() || 'Untitled';

  return (
    <div className="card song-card">
      <button type="button" className="song-card-open" onClick={() => onOpen(song.id)}>
        <span className="resume-head">
          <span className="resume-titles">
            <strong>{title}</strong>
            <em>{songSubLine(song)}</em>
          </span>
          <span className="song-card-tags">
            {changed && <span className="tag tag-alert">Changed</span>}
            {/* Only when the box below does not already say it: shared, but
                by link alone. Unticking the box leaves a song here, and the
                row has to go on saying that the link still opens. */}
            {song.shared && !song.shared.listed && <span className="tag">Shared by link</span>}
            {song.shared && !global && song.shared.listed && <span className="tag">Shared</span>}
          </span>
        </span>
        {song.chords.length > 0 && (
          <span className="resume-chords">
            {song.chords.slice(0, PREVIEW_CHORDS).map((c) => (
              <ChordDiagram key={c.id} spec={c.spec} width={44} />
            ))}
          </span>
        )}
      </button>

      {(pills.length > 0 || onAddToPlaylist || global || onDelete) && (
        <div className="song-card-foot">
          {pills.map((m) => (
            <button
              key={m.playlistId}
              type="button"
              className="pill"
              onClick={() => onOpenPlaylist?.(m)}
              aria-label={`In the playlist ${m.name}. Open it.`}
            >
              {m.name}
            </button>
          ))}
          {onAddToPlaylist && (
            <button
              type="button"
              className="pill pill-add"
              onClick={() => onAddToPlaylist(song.id)}
              aria-label={`Add ${title} to a playlist`}
            >
              <Plus size={11} weight="bold" />
              Playlist
            </button>
          )}
          {global && (
            <label className={`song-card-global${global.busy ? ' is-busy' : ''}`}>
              <input
                type="checkbox"
                checked={global.checked}
                disabled={global.busy}
                onChange={(e) => global.onChange(e.target.checked)}
                aria-label={`Make ${title} available globally`}
              />
              {global.busy ? 'Saving…' : 'Make available globally'}
            </label>
          )}
          {onDelete && (
            <button
              type="button"
              className={`icon-btn sm song-card-delete${global ? '' : ' is-last'}`}
              onClick={() => onDelete(song.id)}
              aria-label={`Delete ${title}`}
            >
              <Trash size={15} />
            </button>
          )}
        </div>
      )}
      {global?.error && (
        <p className="field-note is-error song-card-error" role="alert">
          {global.error}
        </p>
      )}
    </div>
  );
}
