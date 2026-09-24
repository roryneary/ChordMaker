import { type ComponentProps, useState } from 'react';
import {
  CaretLeft,
  Copy,
  ImageSquare,
  PaperPlaneTilt,
  Printer,
  ShareNetwork,
} from '@phosphor-icons/react';
import CapoChip from '../components/CapoChip';
import ChordDiagram from '../components/ChordDiagram';
import LyricBlock from '../components/lyric/LyricBlock';
import ShareLinkSheet from '../components/ShareLinkSheet';
import { changedSinceShared } from '../lib/sharedSong';
import { type ExportJob, canCopyImages, canShareFiles } from '../lib/share';
import type { Song } from '../types/song';

interface Props {
  song: Song;
  nameOf: (chordId: string) => string | null;
  onClose: () => void;
  /** Which export is running, if any. One at a time: they share a canvas's worth of work. */
  busy: ExportJob | null;
  onPrint: () => void;
  onShareChords: () => void;
  onSaveChordsImage: () => void;
  onCopyChords: () => void;
  /** Sending the whole song as a link: everything `ShareLinkSheet` needs but the song. */
  sharing: Omit<ComponentProps<typeof ShareLinkSheet>, 'song' | 'onClose'>;
}

/** M06. The finished song, with the share sheet over it. */
export default function Ready({
  song,
  nameOf,
  onClose,
  busy,
  onPrint,
  onShareChords,
  onSaveChordsImage,
  onCopyChords,
  sharing,
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);
  /* Asked once. A row the device cannot honour is not offered at all, rather
     than offered and then apologised for. */
  const [canShare] = useState(canShareFiles);
  const [canCopy] = useState(canCopyImages);
  // The picture is of the chords, so with none there is nothing to send.
  const noChords = song.chords.length === 0;
  const chordsHint = (otherwise: string) => (noChords ? 'Add a chord first' : otherwise);
  const meta = [
    song.artist?.trim() || null,
    song.chords.length ? `${song.chords.length} chords` : null,
    song.key ? `key of ${song.key}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="ready">
      {/* The screen's own way out. It used to depend on the share sheet's "Not
          yet" button, so dismissing the sheet by its scrim left the screen with
          no exit at all — mobile gives this route no tab bar. */}
      <div className="editor-bar">
        <button type="button" className="icon-btn accent" onClick={onClose} aria-label="Back">
          <CaretLeft size={20} />
        </button>
        <span className="spacer" />
        {!sheetOpen && (
          <button type="button" className="btn-ghost" onClick={() => setSheetOpen(true)}>
            Where&apos;s it going?
          </button>
        )}
      </div>

      <div className="ready-body">
        <p className="kicker">Ready for the room</p>
        <h1 className="display-lg">{song.title.trim() || 'Untitled'}</h1>
        {meta && <p className="ready-meta">{meta}</p>}

        <CapoChip capo={song.capo} variant="statement" />

        {song.chords.length > 0 && (
          <ul className="ready-chords">
            {song.chords.slice(0, 4).map((c) => (
              <li key={c.id}>
                <strong>{c.spec.name.trim() || '—'}</strong>
                <ChordDiagram spec={c.spec} width={56} />
              </li>
            ))}
          </ul>
        )}

        {song.lyric.trim() && (
          <>
            <hr className="rule" />
            <LyricBlock
              lyric={song.lyric}
              words={song.words}
              placements={song.placements}
              nameOf={nameOf}
              sizes={{ word: 18, chord: 12.5 }}
              maxLines={2}
            />
          </>
        )}
      </div>

      {sheetOpen && (
        <>
          <button
            type="button"
            className="scrim"
            aria-label="Close"
            onClick={() => setSheetOpen(false)}
          />
          <div className="sheet" role="dialog" aria-label="Share this song">
            <i className="grab" />
            <h2>Where&apos;s it going?</h2>

            {canShare && (
              <button
                type="button"
                className="share-row"
                onClick={onShareChords}
                disabled={busy !== null || noChords}
              >
                <ShareNetwork size={22} />
                <span>
                  <strong>{busy === 'share' ? 'Drawing the chords…' : 'Send the chords'}</strong>
                  <em>{chordsHint('One picture of every shape, straight into a chat')}</em>
                </span>
              </button>
            )}

            <button
              type="button"
              className="share-row"
              onClick={onSaveChordsImage}
              disabled={busy !== null || noChords}
            >
              <ImageSquare size={22} />
              <span>
                <strong>
                  {busy === 'image' ? 'Drawing the chords…' : 'Save the chords as a picture'}
                </strong>
                <em>{chordsHint('The title, the capo and every shape, easy to read')}</em>
              </span>
            </button>

            {canCopy && (
              <button
                type="button"
                className="share-row"
                onClick={onCopyChords}
                disabled={busy !== null || noChords}
              >
                <Copy size={22} />
                <span>
                  <strong>{busy === 'copy' ? 'Copying…' : 'Copy the chords'}</strong>
                  <em>{chordsHint('Paste the picture into a message')}</em>
                </span>
              </button>
            )}

            <button
              type="button"
              className="share-row"
              onClick={onPrint}
              disabled={busy !== null}
            >
              <Printer size={22} />
              <span>
                <strong>{busy === 'print' ? 'Building the page…' : 'Print for the stand'}</strong>
                <em>One A4 page, big enough to read standing up</em>
              </span>
            </button>

            {/* There was a third row here, "Keep it in the gig bag", disabled
                and explaining that the song was already saved. The gig bag is
                the song list, and every song is in it from its first tap, so
                the row offered nothing and is gone. */}
            <button
              type="button"
              className="share-row"
              onClick={() => {
                setSheetOpen(false);
                setLinkOpen(true);
              }}
            >
              <PaperPlaneTilt size={22} />
              <span>
                <strong>{song.shared ? 'Shared — send the link again' : 'Send a link to the band'}</strong>
                <em>
                  {changedSinceShared(song)
                    ? 'You have changed it since you shared it'
                    : 'The whole song, opening without an account'}
                </em>
              </span>
            </button>

            <button type="button" className="btn-ghost btn-block" onClick={onClose}>
              Not yet
            </button>
          </div>
        </>
      )}

      {linkOpen && (
        <ShareLinkSheet
          song={song}
          {...sharing}
          onClose={() => {
            setLinkOpen(false);
            setSheetOpen(true);
          }}
        />
      )}
    </div>
  );
}
