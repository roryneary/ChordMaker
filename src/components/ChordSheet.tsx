import { useEffect, useState } from 'react';
import { Copy, ImageSquare, PencilSimple, ShareNetwork, Trash } from '@phosphor-icons/react';
import ChordDiagram from './ChordDiagram';
import { type ExportJob, canCopyImages, canShareFiles } from '../lib/share';
import type { ChordSpec } from '../types/chord';

interface Props {
  spec: ChordSpec;
  /** Which export is running, if any. One at a time, as on the Ready sheet. */
  busy: ExportJob | null;
  onShare: () => void;
  onSaveImage: () => void;
  onCopy: () => void;
  /** Only for one of My chords: a built-in shape is not the player's to change. */
  mine?: { onEdit: () => void; onDelete: () => void };
  onClose: () => void;
}

/**
 * One chord, opened from the Chords tab: the shape large, and the ways to hand
 * it to someone. Sending a chord is sending a picture of it (ROADMAP §0a) —
 * the same three rows the Ready sheet offers for a whole song, for one shape.
 *
 * One of My chords can also be edited or deleted from here. Deleting asks
 * first, and says the thing that is not obvious: songs hold their own copy of
 * every shape they use, so a song that uses this one keeps it.
 */
export default function ChordSheet({
  spec,
  busy,
  onShare,
  onSaveImage,
  onCopy,
  mine,
  onClose,
}: Props) {
  // Asked once. A row the device cannot honour is not offered at all.
  const [canShare] = useState(canShareFiles);
  const [canCopy] = useState(canCopyImages);
  const [deleting, setDeleting] = useState(false);
  const name = spec.name.trim() || '—';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <button type="button" className="scrim" aria-label="Close" onClick={onClose} />
      <div className="sheet chord-sheet" role="dialog" aria-modal="true" aria-label={name}>
        <i className="grab" />
        <h2>{name}</h2>
        <div className="chord-sheet-diagram">
          <ChordDiagram spec={spec} />
        </div>

        {deleting && mine ? (
          <>
            <p className="field-note delete-note">
              It goes from My chords, on this device and on your account.{' '}
              <strong>Songs already using this chord keep it.</strong>
            </p>
            <div className="check-actions">
              <button type="button" className="btn-danger btn-block" onClick={mine.onDelete}>
                <Trash size={16} />
                Delete it
              </button>
              <button type="button" className="btn-ghost btn-block" onClick={() => setDeleting(false)}>
                Keep it
              </button>
            </div>
          </>
        ) : (
          <>
            {canShare && (
              <button type="button" className="share-row" onClick={onShare} disabled={busy !== null}>
                <ShareNetwork size={22} />
                <span>
                  <strong>{busy === 'share' ? 'Drawing the chord…' : 'Send this chord'}</strong>
                  <em>A picture of the shape, straight into a chat</em>
                </span>
              </button>
            )}
            <button
              type="button"
              className="share-row"
              onClick={onSaveImage}
              disabled={busy !== null}
            >
              <ImageSquare size={22} />
              <span>
                <strong>{busy === 'image' ? 'Drawing the chord…' : 'Save it as a picture'}</strong>
                <em>Black on white, easy to read</em>
              </span>
            </button>
            {canCopy && (
              <button type="button" className="share-row" onClick={onCopy} disabled={busy !== null}>
                <Copy size={22} />
                <span>
                  <strong>{busy === 'copy' ? 'Copying…' : 'Copy the picture'}</strong>
                  <em>Paste it into a message</em>
                </span>
              </button>
            )}

            {mine && (
              <div className="chord-sheet-own">
                <button type="button" className="btn-ghost" onClick={mine.onEdit}>
                  <PencilSimple size={15} />
                  Change it
                </button>
                <button type="button" className="btn-ghost is-danger" onClick={() => setDeleting(true)}>
                  <Trash size={15} />
                  Delete from My chords
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
