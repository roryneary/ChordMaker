import { useState } from 'react';
import { ArrowsClockwise, Check, Copy, LinkBreak, ShareNetwork } from '@phosphor-icons/react';
import { canShareLinks, copyText, shareLink } from '../lib/share';
import { changedSinceShared, shareUrl } from '../lib/sharedSong';
import type { Song } from '../types/song';

/** Why sharing is not on offer, when it is not. */
export type SharingBlocked = 'signedOut' | 'noDatabase' | 'noCrypto' | null;

interface Props {
  song: Song;
  blocked: SharingBlocked;
  /** A share, a listing change or an unshare is on its way to the database. */
  busy: boolean;
  /** What went wrong with the last one, in words. */
  error: string | null;
  onShare: (listed: boolean) => void;
  onShareChanges: () => void;
  onSetListed: (listed: boolean) => void;
  onStopSharing: () => void;
  onSignIn: () => void;
  onClose: () => void;
}

/**
 * Sending the whole song to someone: making the link, and everything the owner
 * can do to it afterwards.
 *
 * Making the link and sending it are two taps, deliberately. The first goes to
 * the database; a share sheet or a clipboard write has to come from a tap that
 * is still fresh, and on Safari one that has waited on the network is not.
 *
 * The words here never call a link private, because it is not: anyone it is
 * passed on to can open it. What is true is that nobody can *find* it, and that
 * stopping kills it — so that is what the sheet says.
 */
export default function ShareLinkSheet({
  song,
  blocked,
  busy,
  error,
  onShare,
  onShareChanges,
  onSetListed,
  onStopSharing,
  onSignIn,
  onClose,
}: Props) {
  const [listed, setListed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [canSend] = useState(canShareLinks);

  const title = song.title.trim() || 'Untitled';
  const shared = song.shared;
  const url = shared ? shareUrl(shared.shareId, window.location.href) : '';
  const changed = changedSinceShared(song);

  const listedToggle = (checked: boolean, onChange: (next: boolean) => void) => (
    <label className="share-listed">
      <input
        type="checkbox"
        checked={checked}
        disabled={busy}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <strong>Make available globally</strong>
        <em>Anyone signed in can find it in Shared songs. Off, only people you give the link to.</em>
      </span>
    </label>
  );

  const body = () => {
    if (blocked === 'noDatabase') {
      return <p className="field-note">This build has no database, so there is nowhere to share to.</p>;
    }
    if (blocked === 'noCrypto') {
      return <p className="field-note">This browser cannot make a safe link. Try a newer one.</p>;
    }
    if (blocked === 'signedOut') {
      return (
        <>
          <p className="field-note">
            A shared song carries your name, so whoever gets it knows who it is from. Sign in to
            pick one — your songs stay on this device either way.
          </p>
          <div className="check-actions">
            <button type="button" className="btn-primary btn-block" onClick={onSignIn}>
              Sign in to share
            </button>
          </div>
        </>
      );
    }

    if (!shared) {
      return (
        <>
          <p className="field-note">
            Makes a link to a copy of this song. Whoever opens it can read it and keep a copy of
            their own, without an account. Your song stays yours: nothing they do changes it, and
            they only get later changes when you choose to share them.
          </p>
          {listedToggle(listed, setListed)}
          <div className="check-actions">
            <button
              type="button"
              className="btn-primary btn-block"
              disabled={busy}
              onClick={() => onShare(listed)}
            >
              {busy ? 'Making the link…' : 'Make the link'}
            </button>
          </div>
        </>
      );
    }

    return (
      <>
        {changed && (
          <div className="check-row">
            <ArrowsClockwise size={20} />
            <span>
              <strong>You&apos;ve changed this since you shared it</strong>
              <em>People with the link still see it as it was. Those who kept a copy are asked
                whether they want the new one.</em>
            </span>
            <button type="button" className="btn-ghost" disabled={busy} onClick={onShareChanges}>
              {busy ? 'Sharing…' : 'Share the changes'}
            </button>
          </div>
        )}

        <input
          className="input share-url"
          readOnly
          value={url}
          aria-label="The link to this song"
          onFocus={(e) => e.target.select()}
        />

        {canSend && (
          <button
            type="button"
            className="share-row"
            onClick={() => void shareLink(url, title)}
          >
            <ShareNetwork size={22} />
            <span>
              <strong>Send the link</strong>
              <em>Straight into a chat</em>
            </span>
          </button>
        )}
        <button
          type="button"
          className="share-row"
          onClick={() => void copyText(url).then(setCopied)}
        >
          {copied ? <Check size={22} /> : <Copy size={22} />}
          <span>
            <strong>{copied ? 'Copied' : 'Copy the link'}</strong>
            <em>Anyone you give it to can open the song. Nobody can find it without it.</em>
          </span>
        </button>

        {listedToggle(shared.listed, onSetListed)}

        {stopping ? (
          <div className="check-row share-stop">
            <LinkBreak size={20} />
            <span>
              <strong>Stop sharing “{title}”?</strong>
              <em>The link stops working for everyone. Copies people have already kept are theirs,
                and stay.</em>
            </span>
            <button type="button" className="btn-ghost" disabled={busy} onClick={onStopSharing}>
              {busy ? 'Stopping…' : 'Stop'}
            </button>
          </div>
        ) : (
          <button type="button" className="btn-ghost sheet-remove" onClick={() => setStopping(true)}>
            Stop sharing
          </button>
        )}
      </>
    );
  };

  return (
    <>
      <button type="button" className="scrim" aria-label="Close" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={`Share ${title}`}>
        <i className="grab" />
        <h2>{shared ? 'Shared' : 'Send a link to the band'}</h2>
        {body()}
        {error && (
          <p className="field-note is-error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="btn-ghost btn-block" onClick={onClose}>
          {shared ? 'Done' : 'Not yet'}
        </button>
      </div>
    </>
  );
}
