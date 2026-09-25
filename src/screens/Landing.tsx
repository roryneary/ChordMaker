import { At, CaretRight, MusicNotesPlus, SignIn, UsersThree } from '@phosphor-icons/react';
import type { Song } from '../types/song';
import type { Mention } from '../types/feedback';
import { authorLabel } from '../lib/feedback';
import SongCard from '../components/SongCard';
import { ChordCreatorLockup } from '../components/Brand';

interface Props {
  /** The few songs opened last — `recentSongs`, already cut to length. */
  recent: Song[];
  /** Every song there is, for the way through to the rest of them. */
  songCount: number;
  onStart: () => void;
  onResume: (songId: string) => void;
  onAllSongs: () => void;
  onFindShared: () => void;
  /** Feedback posts that @ this player, not yet looked at. */
  mentions: Mention[];
  /** Where the notice goes: the thread, or the list when more than one is waiting. */
  onOpenMentions: () => void;
  /** Absent when there is nobody to sign in as: signed in already, or no database. */
  onSignIn?: () => void;
}

const greeting = (hour = new Date().getHours()) =>
  hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';

/**
 * Where everyone lands. It is two screens, told apart by whether there is a
 * song on this device.
 *
 * With none, it is a welcome: what the app makes, the one way to start, and
 * the two doors that matter to someone with an empty shelf — a finished song
 * somebody else has shared, which shows what all this is for faster than any
 * sentence, and sign-in, because someone with forty songs on another device
 * arrives here looking exactly like someone with none.
 *
 * With songs, it is the ones you opened last, because the usual reason to open
 * the app is to play something you played recently.
 *
 * There used to be two ways to start, "A song to play" and "Just the chords".
 * Both made the same song and differed only in which screen came next, so a
 * new player was asked to choose a workflow before seeing either. There is one
 * now, and it lands on the song screen, which offers both halves itself.
 */
export default function Landing({
  recent,
  songCount,
  onStart,
  onResume,
  onAllSongs,
  onFindShared,
  mentions,
  onOpenMentions,
  onSignIn,
}: Props) {
  const isNew = songCount === 0;

  return (
    <div className="landing">
      <div className="brand brand-sm">
        <ChordCreatorLockup size={26} />
      </div>

      <p className="greeting">{isNew ? 'Welcome.' : `${greeting()}.`}</p>
      <h1 className="display">
        {isNew ? (
          <>
            Songs you can
            <br />
            play from.
          </>
        ) : (
          <>
            What are we
            <br />
            playing?
          </>
        )}
      </h1>

      {/* The notice for being @-ed, on the screen everybody opens the app to.
          One line, and only while there is something: it goes once looked at. */}
      {mentions.length > 0 && (
        <button
          type="button"
          className="card landing-mention"
          onClick={onOpenMentions}
        >
          <At size={18} weight="bold" />
          <span>
            {authorLabel({ display: mentions[0].fromDisplay, handle: mentions[0].fromHandle })}{' '}
            mentioned you in “{mentions[0].title}”
            {mentions.length > 1 && <em> and {mentions.length - 1} more in feedback</em>}
          </span>
          <CaretRight size={16} />
        </button>
      )}

      {isNew && (
        <p className="landing-lede">
          Tap out the chords, paste in the words, and get a sheet you can read from a stand in
          a dim room. It is all kept on this device: no account, and no signal needed.
        </p>
      )}

      {!isNew && (
        <>
          <p className="section-label">Recent songs</p>
          {recent.map((song) => (
            <SongCard key={song.id} song={song} onOpen={onResume} />
          ))}
          {songCount > recent.length && (
            <button type="button" className="btn-ghost landing-more" onClick={onAllSongs}>
              All {songCount} songs
              <CaretRight size={14} />
            </button>
          )}
        </>
      )}

      <div className="choices">
        <button type="button" className="card choice" onClick={onStart}>
          <span className="choice-head">
            <MusicNotesPlus size={21} />
            <strong>New song</strong>
            <CaretRight size={16} />
          </span>
          {isNew && (
            <span className="choice-body">
              Give it a name, then add the chords or the words, whichever you have first.
            </span>
          )}
        </button>
      </div>

      {isNew && (
        <div className="landing-doors">
          <button type="button" className="btn-ghost" onClick={onFindShared}>
            <UsersThree size={16} />
            See a song someone has shared
          </button>
          {onSignIn && (
            <button type="button" className="btn-ghost" onClick={onSignIn}>
              <SignIn size={16} />
              Already have songs? Sign in
            </button>
          )}
        </div>
      )}
    </div>
  );
}
