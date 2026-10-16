import { useId } from 'react';
import { DETAIL_LABEL } from '../lib/details';
import { MAX_ARTIST_CHARS } from '../lib/sharedSong';
import type { Song, SongDetail } from '../types/song';

interface Props {
  song: Song;
  /** What was missing as the screen opened. Held fixed while the sheet is up,
      so a row does not vanish from under the player as they fill it in. */
  asking: SongDetail[];
  onArtist: (artist: string) => void;
  /** Closes the sheet and takes the player to the notes, to write one. */
  onWriteNote: () => void;
  onNotNeeded: (detail: SongDetail, notNeeded: boolean) => void;
  onClose: () => void;
}

/**
 * "This song is missing…", as a song being come back to opens to edit. Each
 * missing detail can be filled in, or ticked as not needed for this song — and
 * a tick is the end of it: that song is not asked about that detail again.
 *
 * Who plays it is typed right here, because it is one line and the sheet is
 * already asking for it. A note is not: it is a sentence written with the song
 * in view, so the sheet steps aside and goes to the notes.
 */
export default function MissingDetailsSheet({
  song,
  asking,
  onArtist,
  onWriteNote,
  onNotNeeded,
  onClose,
}: Props) {
  const base = useId();
  const ticked = (d: SongDetail) => !!song.notNeeded?.includes(d);

  return (
    <>
      <button type="button" className="scrim" aria-label="Close" onClick={onClose} />
      <div className="sheet" role="dialog" aria-labelledby={`${base}-title`}>
        <i className="grab" />
        <h2 id={`${base}-title`}>
          {asking.length === 1 ? 'This song is missing something' : 'This song is missing a few things'}
        </h2>
        <p className="field-note details-lead">
          Add it now, or tick <strong>Not needed</strong> and this song will not ask again.
        </p>

        {asking.map((d) => (
          <div key={d} className={`detail-row${ticked(d) ? ' is-skipped' : ''}`}>
            <span className="detail-name">{DETAIL_LABEL[d]}</span>
            {d === 'artist' && (
              <input
                className="detail-input"
                value={song.artist ?? ''}
                onChange={(e) => onArtist(e.target.value)}
                maxLength={MAX_ARTIST_CHARS}
                placeholder="Who plays it?"
                aria-label="Artist"
                autoComplete="off"
                spellCheck={false}
                disabled={ticked(d)}
              />
            )}
            {d === 'notes' && (
              <button
                type="button"
                className="btn-secondary detail-go"
                onClick={onWriteNote}
                disabled={ticked(d)}
              >
                Write a note
              </button>
            )}
            <label className="detail-skip">
              <input
                type="checkbox"
                checked={ticked(d)}
                onChange={(e) => onNotNeeded(d, e.target.checked)}
              />
              Not needed for this song
            </label>
          </div>
        ))}

        <div className="check-actions">
          <button type="button" className="btn-primary btn-block" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </>
  );
}
