import { type ComponentProps, useState } from 'react';
import {
  CaretLeft,
  Copy,
  ImageSquare,
  PaperPlaneTilt,
  Printer,
  ShareNetwork,
} from '@phosphor-icons/react';
import CapoChip, { CAPO_FRETS, capoChosen, capoLabel } from '../components/CapoChip';
import ChordDiagram from '../components/ChordDiagram';
import GlobalToggle from '../components/GlobalToggle';
import LyricBlock from '../components/lyric/LyricBlock';
import ShareLinkSheet from '../components/ShareLinkSheet';
import { ordinal } from '../lib/numerals';
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
  onCapo: (capo: number | null) => void;
  /** Sending the whole song as a link: everything `ShareLinkSheet` needs but the
      song, and the "Make available globally" box beside it. */
  sharing: Omit<ComponentProps<typeof ShareLinkSheet>, 'song' | 'onClose'> & {
    onSetListed: (listed: boolean) => void;
  };
}

/**
 * M06. The finished song, with "Share song" over it: every way a song leaves
 * the app, in one sheet, whether you came from the song screen or from a
 * song's row on Songs.
 *
 * The capo is asked here, not on the way in. It has to be an answer before
 * anything leaves, because it moves every chord on the sheet; asking in the
 * song screen covered only one of the two ways here.
 */
export default function Ready({
  song,
  nameOf,
  onClose,
  busy,
  onPrint,
  onShareChords,
  onSaveChordsImage,
  onCopyChords,
  onCapo,
  sharing,
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);
  /* Asked once. A row the device cannot honour is not offered at all, rather
     than offered and then apologised for. */
  const [canShare] = useState(canShareFiles);
  const [canCopy] = useState(canCopyImages);
  /* Latched at the moment the screen opens, not read live: answering the capo
     would otherwise pull the question out from under the finger that did. */
  const [askCapo] = useState(() => !capoChosen(song.capo));
  const capoOk = capoChosen(song.capo);
  // The picture is of the chords, so with none there is nothing to send.
  const noChords = song.chords.length === 0;
  const chordsHint = (otherwise: string) =>
    !capoOk ? 'Say about the capo first' : noChords ? 'Add a chord first' : otherwise;
  const pageHint = (otherwise: string) => (!capoOk ? 'Say about the capo first' : otherwise);
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
            Share song
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

            {askCapo && (
              <div className="check-ask ready-capo">
                <p className="check-ask-q">
                  {capoOk ? capoLabel(song.capo) : 'First: is there a capo on?'}
                </p>
                <p className="check-ask-why">
                  {capoOk
                    ? 'Change it here if that is not right.'
                    : 'Nobody has said yet, and it moves every chord on the sheet.'}
                </p>
                <div className="chips">
                  <button
                    type="button"
                    className={`chip${song.capo === null ? ' is-selected' : ''}`}
                    onClick={() => onCapo(null)}
                  >
                    No capo
                  </button>
                  {CAPO_FRETS.map((fret) => (
                    <button
                      key={fret}
                      type="button"
                      className={`chip${song.capo === fret ? ' is-selected' : ''}`}
                      onClick={() => onCapo(fret)}
                      aria-label={`Capo on the ${ordinal(fret)}`}
                    >
                      {ordinal(fret)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* First, because it is the one that sends the whole song: the
                words, the chords and the notes, opening without an account. */}
            <button
              type="button"
              className="share-row"
              disabled={!capoOk}
              onClick={() => {
                setSheetOpen(false);
                setLinkOpen(true);
              }}
            >
              <PaperPlaneTilt size={22} />
              <span>
                <strong>Share using link (for social media and email)</strong>
                <em>
                  {!capoOk
                    ? 'Say about the capo first'
                    : changedSinceShared(song)
                      ? 'You have changed it since you shared it'
                      : song.shared
                        ? 'Shared already. Send the link again, or stop sharing'
                        : 'The whole song, opening without an account'}
                </em>
              </span>
            </button>

            <GlobalToggle
              song={song}
              sharing={sharing}
              disabled={!capoOk}
              onSignIn={sharing.onSignIn}
            />
            {sharing.error && (
              <p className="field-note is-error" role="alert">
                {sharing.error}
              </p>
            )}

            {canShare && (
              <button
                type="button"
                className="share-row"
                onClick={onShareChords}
                disabled={busy !== null || noChords || !capoOk}
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
              disabled={busy !== null || noChords || !capoOk}
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
                disabled={busy !== null || noChords || !capoOk}
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
              disabled={busy !== null || !capoOk}
            >
              <Printer size={22} />
              <span>
                <strong>{busy === 'print' ? 'Building the page…' : 'Print for the stand'}</strong>
                <em>{pageHint('One A4 page, big enough to read standing up')}</em>
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
