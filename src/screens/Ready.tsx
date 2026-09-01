import { useState } from 'react';
import { BagSimple, CaretLeft, PaperPlaneTilt, Printer } from '@phosphor-icons/react';
import CapoChip from '../components/CapoChip';
import ChordDiagram from '../components/ChordDiagram';
import LyricBlock from '../components/lyric/LyricBlock';
import type { Song } from '../types/song';

interface Props {
  song: Song;
  nameOf: (chordId: string) => string | null;
  onClose: () => void;
  onPrint: () => Promise<void> | void;
  printing: boolean;
}

/** M06. The finished song, with the share sheet over it. */
export default function Ready({ song, nameOf, onClose, onPrint, printing }: Props) {
  const [sheetOpen, setSheetOpen] = useState(true);
  const meta = [
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

            <button
              type="button"
              className="share-row"
              onClick={() => void onPrint()}
              disabled={printing}
            >
              <Printer size={22} />
              <span>
                <strong>{printing ? 'Building the page…' : 'Print for the stand'}</strong>
                <em>One A4 page, big enough to read standing up</em>
              </span>
            </button>

            <button type="button" className="share-row" disabled>
              <PaperPlaneTilt size={22} />
              <span>
                <strong>Send it to someone</strong>
                <em>A link that opens without the app — not built yet</em>
              </span>
            </button>

            <button type="button" className="share-row" disabled>
              <BagSimple size={22} />
              <span>
                <strong>Keep it in the gig bag</strong>
                <em>Already saved on this device, and works with no signal</em>
              </span>
            </button>

            <button type="button" className="btn-ghost btn-block" onClick={onClose}>
              Not yet
            </button>
          </div>
        </>
      )}
    </div>
  );
}
