import { CaretRight, HandTap, MusicNotesPlus } from '@phosphor-icons/react';
import type { Song } from '../types/song';
import SongCard from '../components/SongCard';
import { ChordCreatorLockup } from '../components/Brand';

interface Props {
  songs: Song[];
  onNewSong: () => void;
  onJustChords: () => void;
  onResume: (songId: string) => void;
}

const greeting = (hour = new Date().getHours()) =>
  hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';

/**
 * The screen the app never had: it opened straight into a working screen. This
 * splits the two ways someone arrives — with the words in hand, or with a
 * tutor calling out chords and no time for anything else. Both make a song;
 * they differ only in which half comes first.
 */
export default function Landing({ songs, onNewSong, onJustChords, onResume }: Props) {
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

        <button type="button" className="card choice" onClick={onJustChords}>
          <span className="choice-head">
            <HandTap size={21} />
            <strong>Just the chords</strong>
            <CaretRight size={16} />
          </span>
          <span className="choice-body">
            Song name, capo and the shapes, as fast as they're called out. The
            words can wait.
          </span>
        </button>
      </div>

      {recent && (
        <>
          <p className="section-label">Pick up where you left off</p>
          <SongCard song={recent} onOpen={onResume} />
        </>
      )}
    </div>
  );
}
