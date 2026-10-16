import { useId, useState } from 'react';
import { Info } from '@phosphor-icons/react';
import { type SharingBlocked, globalAction, globalOffered } from '../lib/sharedSong';
import type { Song } from '../types/song';

interface Props {
  song: Song;
  sharing: {
    blocked: SharingBlocked;
    busy: boolean;
    onShare: (listed: boolean) => void;
    onSetListed: (listed: boolean) => void;
  };
  onSignIn: () => void;
  /** Held back for a reason of the sheet's own: the capo, before it is answered. */
  disabled?: boolean;
}

/**
 * "Make available globally", in the share sheet: the same box as on each row of
 * Songs, with the whole of what it means one tap away behind the ⓘ rather than
 * crammed under it. The rule for what a tick does is `globalAction`.
 *
 * Not a <label> round the lot: the ⓘ is a button, and a button inside a label
 * is one tap away from ticking the box by accident.
 */
export default function GlobalToggle({ song, sharing, onSignIn, disabled = false }: Props) {
  const id = useId();
  const [about, setAbout] = useState(false);
  if (!globalOffered(sharing.blocked)) return null;

  const listed = song.shared?.listed === true;
  const change = (next: boolean) => {
    const action = globalAction(song, sharing.blocked, next);
    if (action === 'signIn') onSignIn();
    else if (action === 'share') sharing.onShare(true);
    else if (action === 'list' || action === 'unlist') sharing.onSetListed(next);
  };
  const line =
    sharing.blocked === 'signedOut'
      ? 'Sign in first: a shared song goes out under your name'
      : listed
        ? 'In Shared songs, for anyone signed in to find'
        : 'Off: only people you send the link to can open it';

  return (
    <div className={`share-global${sharing.busy ? ' is-busy' : ''}${disabled ? ' is-disabled' : ''}`}>
      <input
        id={id}
        type="checkbox"
        checked={listed}
        disabled={sharing.busy || disabled}
        onChange={(e) => change(e.target.checked)}
      />
      <span>
        <span className="share-global-head">
          <label htmlFor={id}>Make available globally</label>
          <button
            type="button"
            className="icon-btn sm"
            aria-label="What does this do?"
            aria-expanded={about}
            onClick={() => setAbout((v) => !v)}
          >
            <Info size={17} />
          </button>
        </span>
        <em>{sharing.busy ? 'Saving…' : line}</em>
        {about && (
          <div className="share-global-about">
            <p>
              Puts this song in <strong>Shared songs</strong>, where anyone signed in can find it by
              its title, play it and keep a copy of their own. It goes out under your name. Your
              song stays yours: nothing they do changes it, and they only get your later changes
              when you choose to share them.
            </p>
            <p>
              Turning it off takes the song out of Shared songs, but a link you have already sent
              still opens. To stop that too, use <strong>Stop sharing</strong> under Share using
              link.
            </p>
          </div>
        )}
      </span>
    </div>
  );
}
