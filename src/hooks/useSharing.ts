import { type Dispatch, useCallback, useMemo, useState } from 'react';
import type { SharingBlocked } from '../components/ShareLinkSheet';
import { firebaseEnabled } from '../lib/firebase';
import { newShareId, tooBigToSave } from '../lib/sharedSong';
import {
  ShareGoneError,
  type Sharer,
  publishChanges,
  publishSong,
  setListed,
  unshare,
} from '../lib/sharedSongSync';
import { errorCode, syncErrorReason } from '../lib/syncStatus';
import type { Song } from '../types/song';
import type { Account } from './useAuth';
import type { SongsAction } from './useSongs';

/**
 * The owner's side of sharing, as the props `ShareLinkSheet` wants.
 *
 * Each action is a call the player waits on — it needs a signal and says so
 * when it fails — and then a dispatch recording what the database now holds.
 * In that order, always: the song only says "shared" once it is. The reducer
 * never hears about a share that did not happen, and never talks to a server.
 */
export function useSharing(account: Account | null, dispatch: Dispatch<SongsAction>) {
  /* Which song is on its way to the database, not merely whether one is: the
     Songs screen has a checkbox on every row, and ticking one must not grey out
     the rest. */
  const [busyId, setBusyId] = useState<string | null>(null);
  /* Filed under the song it happened to, so opening the sheet on another song
     does not show it somebody else's failure. */
  const [failure, setFailure] = useState<{ songId: string; message: string } | null>(null);
  const [canMakeIds] = useState(() => newShareId() !== null);

  const sharer = useMemo<Sharer | null>(
    () =>
      account?.handle
        ? { uid: account.uid, handle: account.handle, display: account.display ?? account.handle }
        : null,
    [account],
  );

  const blocked: SharingBlocked = !firebaseEnabled
    ? 'noDatabase'
    : !canMakeIds
      ? 'noCrypto'
      : !sharer
        ? 'signedOut'
        : null;

  const attempt = useCallback(
    (song: Song, work: () => Promise<void>) => {
      setBusyId(song.id);
      setFailure(null);
      work()
        .catch((err: unknown) => {
          console.error(`Could not share "${song.title}"`, err);
          if (err instanceof ShareGoneError) {
            // Stopped from another device. This one's song still said "shared",
            // with a link that no longer opens: put that right before anything.
            dispatch({ type: 'SONG_UNSHARED', id: song.id });
            setFailure({
              songId: song.id,
              message: 'This song had stopped being shared, so the old link is gone. Make a new one.',
            });
            return;
          }
          setFailure({
            songId: song.id,
            message: `That did not go through: ${syncErrorReason(errorCode(err))}.`,
          });
        })
        .finally(() => setBusyId(null));
    },
    [dispatch],
  );

  /** Everything `ShareLinkSheet` needs for `song`, apart from the song and the way out. */
  const sharingFor = useCallback(
    (song: Song) => ({
      blocked,
      busy: busyId === song.id,
      error: failure?.songId === song.id ? failure.message : null,

      onShare: (listed: boolean) => {
        const shareId = newShareId();
        if (!sharer || !shareId) return;
        const problem = tooBigToSave(song);
        if (problem) return setFailure({ songId: song.id, message: problem });
        attempt(song, async () => {
          const shared = await publishSong(sharer, song, shareId, listed);
          dispatch({
            type: 'SONG_SHARED',
            id: song.id,
            shareId,
            version: shared.version,
            listed,
            sentUpdatedAt: song.updatedAt,
          });
        });
      },

      onShareChanges: () => {
        const ref = song.shared;
        if (!sharer || !ref) return;
        const problem = tooBigToSave(song);
        if (problem) return setFailure({ songId: song.id, message: problem });
        attempt(song, async () => {
          const shared = await publishChanges(sharer, song, ref);
          dispatch({
            type: 'SONG_SHARED',
            id: song.id,
            shareId: ref.shareId,
            version: shared.version,
            listed: ref.listed,
            sentUpdatedAt: song.updatedAt,
          });
        });
      },

      onSetListed: (listed: boolean) => {
        const ref = song.shared;
        if (!ref) return;
        attempt(song, async () => {
          await setListed(ref, listed);
          dispatch({
            type: 'SONG_SHARED',
            id: song.id,
            shareId: ref.shareId,
            version: ref.version,
            listed,
            // Nothing of the song went up, so whether it has changed since is
            // left exactly as it was.
            sentUpdatedAt: null,
          });
        });
      },

      /**
       * Deleting a song. For one that has never been shared this is just the
       * dispatch. For a shared one the copy others can reach comes down
       * *first*, and the song only goes if that worked: once the song is gone
       * nothing here remembers its share id, so a copy left up could never be
       * taken down by anyone. Copies people have already kept are theirs, and
       * are not touched — there is no way to, and no right to.
       */
      onDelete: () => {
        const ref = song.shared;
        if (!ref) return dispatch({ type: 'DELETE_SONG', id: song.id });
        if (blocked) {
          return setFailure({
            songId: song.id,
            message:
              blocked === 'signedOut'
                ? 'This song is shared, and its link has to come down with it. Sign in to delete it.'
                : 'This song is shared, and this build cannot reach the database to take its link down.',
          });
        }
        attempt(song, async () => {
          await unshare(ref.shareId);
          dispatch({ type: 'DELETE_SONG', id: song.id });
        });
      },

      onStopSharing: () => {
        const ref = song.shared;
        if (!ref) return;
        attempt(song, async () => {
          await unshare(ref.shareId);
          dispatch({ type: 'SONG_UNSHARED', id: song.id });
        });
      },
    }),
    [attempt, blocked, busyId, dispatch, failure, sharer],
  );

  return { sharingFor };
}
