import { useCallback, useEffect, useMemo, useState } from 'react';
import { firebaseEnabled } from '../lib/firebase';
import { clearMentions, watchMentions } from '../lib/feedbackSync';
import type { Mention } from '../types/feedback';

/**
 * Who has @-ed me in feedback and I have not looked yet.
 *
 * Watched for as long as the app is open and signed in, so a notice is there
 * the next time the app is opened and turns up without a reload while it is.
 * `uid` is null until the account is finished (has a handle), since nobody can
 * be @-ed before they have a name to be @-ed by.
 *
 * Like `useSharedUpdates`, this is the database's answer as of a moment ago
 * and stays out of the song store. A failure is silent — no signal is simply
 * nothing new — and notices are never cached here for offline.
 */
export function useMentions(uid: string | null) {
  const [mentions, setMentions] = useState<Mention[]>([]);
  // Whose these are, so another account's never show for a render after a switch.
  const [owner, setOwner] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseEnabled || !uid) return;
    return watchMentions(
      uid,
      (next) => {
        setOwner(uid);
        setMentions(next);
      },
      (err) => console.error('Could not read mentions', err),
    );
  }, [uid]);

  const mine = useMemo(() => (uid && owner === uid ? mentions : []), [uid, owner, mentions]);

  /** The thread has been opened: its notices go. */
  const seen = useCallback(
    (threadId: string) => {
      const ids = mine.filter((m) => m.threadId === threadId).map((m) => m.id);
      if (!ids.length) return;
      // Gone from here straight away; the snapshot confirms it when the delete lands.
      setMentions((all) => all.filter((m) => !ids.includes(m.id)));
      clearMentions(ids).catch((err) => console.error('Could not clear mentions', err));
    },
    [mine],
  );

  return { mentions: mine, seen };
}
