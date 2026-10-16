import { ArrowsOutSimple, PencilSimple, ShareNetwork } from '@phosphor-icons/react';
import { playOrEdit, songSubLine } from '../lib/songSummary';
import type { Song } from '../types/song';

interface Props {
  song: Song;
  onPlay: () => void;
  onShare: () => void;
  onEdit: () => void;
  onClose: () => void;
}

/**
 * A song picked on Songs: what to do with it. Songs is where you go to find
 * one to *do something with* — play it, send it, change it — and "send it" was
 * reachable only by opening the song to edit it and finding the button there.
 *
 * Only on Songs. Home, a playlist and the sidebar still play a song on the tap:
 * there, playing is what the list is for.
 *
 * With nothing to read yet there is nothing to play, so Play is not offered,
 * rather than offered and refused (`playOrEdit`).
 */
export default function SongOpenSheet({ song, onPlay, onShare, onEdit, onClose }: Props) {
  const title = song.title.trim() || 'Untitled';
  const playable = playOrEdit(song) === 'play';

  return (
    <>
      <button type="button" className="scrim" aria-label="Close" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={title}>
        <i className="grab" />
        <h2>{title}</h2>
        <p className="song-open-sub">{songSubLine(song)}</p>

        {playable && (
          <button type="button" className="share-row" onClick={onPlay}>
            <ArrowsOutSimple size={22} />
            <span>
              <strong>Play song</strong>
              <em>Full screen, with the chords over the words</em>
            </span>
          </button>
        )}
        <button type="button" className="share-row" onClick={onShare}>
          <ShareNetwork size={22} />
          <span>
            <strong>Share song</strong>
            <em>A link, a picture of the chords, a printed page, or Shared songs</em>
          </span>
        </button>
        <button type="button" className="share-row" onClick={onEdit}>
          <PencilSimple size={22} />
          <span>
            <strong>Edit song</strong>
            <em>{playable ? 'The chords, the words and the notes' : 'Nothing in it yet'}</em>
          </span>
        </button>

        <button type="button" className="btn-ghost btn-block" onClick={onClose}>
          Not now
        </button>
      </div>
    </>
  );
}
