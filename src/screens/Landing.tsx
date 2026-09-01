import { CaretRight, HandTap, MusicNotesPlus } from '@phosphor-icons/react';
import type { Song } from '../types/song';
import ChordDiagram from '../components/ChordDiagram';
import { ChordCreatorLockup } from '../components/Brand';
import { lineCount, unchordedLineCount } from '../lib/lyric';
import { ordinal } from '../lib/numerals';

interface Props {
  songs: Song[];
  onNewSong: () => void;
  onOneChord: () => void;
  onResume: (songId: string) => void;
}

const greeting = (hour = new Date().getHours()) =>
  hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';

/** "Five chords in · capo on the 2nd" */
function subLine(song: Song): string {
  const bits: string[] = [];
  const n = song.chords.length;
  if (n) bits.push(`${n} chord${n === 1 ? '' : 's'} in`);
  if (song.capo) bits.push(`capo on the ${ordinal(song.capo)}`);
  return bits.join(' · ') || 'Nothing in it yet';
}

function progressTag(song: Song): string | null {
  if (!song.chords.length) return null;
  const lines = lineCount(song.lyric);
  if (!song.lyric.trim()) return 'Just chords';
  const left = unchordedLineCount(song.words, song.placements, lines);
  if (left === 0) return 'Ready';
  return 'Half done';
}

/**
 * The screen the app never had: it opened straight into a working screen. This
 * splits the two things someone actually arrives wanting — a whole song, or one
 * shape they have forgotten.
 */
export default function Landing({ songs, onNewSong, onOneChord, onResume }: Props) {
  const recent = songs[0] ?? null;

  return (
    <div className="landing">
      <div className="brand brand-sm">
        <ChordCreatorLockup size={26} />
      </div>

      <p className="greeting">{greeting()}.</p>
      <h1 className="display">
        What are we
        <br />
        making?
      </h1>

      <div className="choices">
        <button type="button" className="card choice" onClick={onNewSong}>
          <span className="choice-head">
            <MusicNotesPlus size={21} />
            <strong>A song to play</strong>
            <CaretRight size={16} />
          </span>
          <span className="choice-body">
            Line up the chords, add the words, and get a sheet you can read from a
            stand in a dim room.
          </span>
        </button>

        <button type="button" className="card choice" onClick={onOneChord}>
          <span className="choice-head">
            <HandTap size={21} />
            <strong>Just one chord</strong>
            <CaretRight size={16} />
          </span>
          <span className="choice-body">
            You've forgotten the shape. Happens to everyone. Work it out and keep it.
          </span>
        </button>
      </div>

      {recent && (
        <>
          <p className="section-label">Pick up where you left off</p>
          <button
            type="button"
            className="card resume"
            onClick={() => onResume(recent.id)}
          >
            <span className="resume-head">
              <span className="resume-titles">
                <strong>{recent.title.trim() || 'Untitled'}</strong>
                <em>{subLine(recent)}</em>
              </span>
              {progressTag(recent) && (
                <span className="tag">{progressTag(recent)}</span>
              )}
            </span>
            {recent.chords.length > 0 && (
              <span className="resume-chords">
                {recent.chords.slice(0, 4).map((c) => (
                  <ChordDiagram key={c.id} spec={c.spec} width={44} />
                ))}
              </span>
            )}
          </button>
        </>
      )}
    </div>
  );
}
