import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CaretLeft, Plus, Trash, X } from '@phosphor-icons/react';
import { cleanPlaylistName, playlistNameTaken, resolveItems } from '../lib/playlists';
import { songSubLine } from '../lib/songSummary';
import type { Playlist } from '../types/playlist';
import type { Song } from '../types/song';

interface Props {
  playlist: Playlist;
  playlists: Playlist[];
  songs: Song[];
  /** The entry to pick out on arrival — set when you came in by a song's pill. */
  arriveAt: string | null;
  onArrived: () => void;
  onBack?: () => void;
  onOpenSong: (songId: string) => void;
  onAddSongs: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onMove: (itemId: string, to: number) => void;
  onRemove: (itemId: string) => void;
}

/** How long a row stays picked out: long enough to find, short enough to forget. */
const LIT_MS = 2500;

/**
 * One playlist, in running order.
 *
 * Reordering is by arrows rather than dragging. A drag on a phone fights the
 * page's own scroll, and the list is read with a guitar in one hand. What a
 * move must not do is lose the row you moved, so it is picked out and scrolled
 * back into view — the same treatment a row gets when you arrive by its pill.
 */
export default function PlaylistScreen({
  playlist,
  playlists,
  songs,
  arriveAt,
  onArrived,
  onBack,
  onOpenSong,
  onAddSongs,
  onRename,
  onDelete,
  onMove,
  onRemove,
}: Props) {
  const rows = useMemo(() => resolveItems(playlist, songs), [playlist, songs]);
  const [lit, setLit] = useState<string | null>(arriveAt);
  const [draft, setDraft] = useState(playlist.name);
  const [confirming, setConfirming] = useState(false);
  const list = useRef<HTMLOListElement>(null);

  // Taken once, as `lit` above; then handed back so reopening this playlist
  // from the list does not pick the same row out again.
  useEffect(() => {
    if (arriveAt) onArrived();
  }, [arriveAt, onArrived]);

  useEffect(() => {
    if (!lit) return;
    list.current
      ?.querySelector(`[data-item="${lit}"]`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const timer = window.setTimeout(() => setLit(null), LIT_MS);
    return () => window.clearTimeout(timer);
    // Re-run when the order changes too: the row has to be found where it is now.
  }, [lit, playlist.items]);

  const clean = cleanPlaylistName(draft);
  const taken = clean.length > 0 && playlistNameTaken(playlists, clean, playlist.id);

  /** A name that cannot be kept is put back rather than left in the box looking saved. */
  const commitName = () => {
    if (clean && !taken) {
      onRename(clean);
      setDraft(clean);
    } else setDraft(playlist.name);
  };

  /* Positions are indices into `playlist.items`, not into `rows`: an entry
     whose song is missing is not drawn but still holds a place. */
  const indexOf = (itemId: string) => playlist.items.findIndex((i) => i.id === itemId);
  const move = (itemId: string, by: -1 | 1) => {
    const at = rows.findIndex((r) => r.item.id === itemId);
    const swapWith = rows[at + by];
    if (!swapWith) return;
    onMove(itemId, indexOf(swapWith.item.id));
    setLit(itemId);
  };

  return (
    <div className="songs">
      <div className="library-head">
        {onBack && (
          <button type="button" className="icon-btn accent" onClick={onBack} aria-label="Back">
            <CaretLeft size={20} />
          </button>
        )}
        <div className="playlist-name">
          <input
            className="title-input display-sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                setDraft(playlist.name);
                e.currentTarget.blur();
              }
            }}
            aria-label="Playlist name"
            autoComplete="off"
            spellCheck={false}
          />
          <p className="library-sub">
            {taken
              ? 'You already have a playlist called that.'
              : `${rows.length} song${rows.length === 1 ? '' : 's'}, in the order you play them.`}
          </p>
        </div>
      </div>

      <div className="playlist-actions">
        <button type="button" className="btn-primary" onClick={onAddSongs}>
          <Plus size={15} /> Add songs
        </button>
        <button type="button" className="btn-ghost" onClick={() => setConfirming(true)}>
          <Trash size={15} /> Delete playlist
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="library-empty">Nothing in this playlist yet.</p>
      ) : (
        <ol className="set-list" ref={list}>
          {rows.map(({ item, song }, i) => {
            const title = song.title.trim() || 'Untitled';
            return (
              <li
                key={item.id}
                data-item={item.id}
                className={`card set-row${lit === item.id ? ' is-lit' : ''}`}
              >
                <span className="set-row-n">{i + 1}</span>
                <button
                  type="button"
                  className="set-row-open"
                  onClick={() => onOpenSong(song.id)}
                >
                  <strong>{title}</strong>
                  <em>{songSubLine(song)}</em>
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  disabled={i === 0}
                  onClick={() => move(item.id, -1)}
                  aria-label={`Move ${title} up`}
                >
                  <ArrowUp size={17} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  disabled={i === rows.length - 1}
                  onClick={() => move(item.id, 1)}
                  aria-label={`Move ${title} down`}
                >
                  <ArrowDown size={17} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => onRemove(item.id)}
                  aria-label={`Take ${title} out of this playlist`}
                >
                  <X size={17} />
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {confirming && (
        <>
          <button
            type="button"
            className="scrim"
            aria-label="Close"
            onClick={() => setConfirming(false)}
          />
          <div className="sheet" role="dialog" aria-label="Delete this playlist">
            <i className="grab" />
            <h2>Delete “{playlist.name}”?</h2>
            <p className="check-ask-why">
              {rows.length === 0
                ? 'There is nothing in it.'
                : `The ${rows.length === 1 ? 'song' : `${rows.length} songs`} in it ${
                    rows.length === 1 ? 'stays' : 'stay'
                  } in Songs. Only the playlist goes.`}
            </p>
            <div className="check-actions">
              <button type="button" className="btn-primary btn-block" onClick={onDelete}>
                Delete the playlist
              </button>
              <button
                type="button"
                className="btn-ghost btn-block"
                onClick={() => setConfirming(false)}
              >
                Keep it
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
