import { useEffect, useState } from 'react';
import { Check, Warning } from '@phosphor-icons/react';
import { type SyncPhase, type SyncView, savedLabel } from '../lib/syncStatus';

/**
 * "Saved", where the writing happens.
 *
 * The app has never had a Save button and should not grow one: every change is
 * already committed by the time you could press it (`useSongs` writes the whole
 * store on every store change), so the button would commit nothing, and a
 * button that appears to be what keeps your work teaches you to fear leaving
 * without pressing it — on a phone, where Back is one tap, that is exactly the
 * wrong lesson. What was missing was not the action but the reassurance: the
 * one honest sentence existed only on the sidebar chip and the Account screen,
 * and on a phone the song screen and the words editor have no chrome at all.
 *
 * So this is the sentence, in the header beside the title, which is where every
 * autosaving editor puts it.
 */

/**
 * How long saving has to last before it is worth saying.
 *
 * Every keystroke is its own write, so the phase flips to `syncing` and back at
 * typing speed; said out loud that is a header flickering "Saving…"/"Saved" per
 * character, which reads as a machine in trouble. Saving is therefore only
 * announced once it has gone on long enough to be worth knowing about — a stall,
 * a slow connection — and a write that lands inside the window is never
 * mentioned at all.
 *
 * What the line claims in that window stays true throughout it: `savedLabel`
 * leads with the device, and `localStorage` has the change before this renders.
 * Only the account can be behind, the account chip is where its exact state is
 * said, and a write that actually fails says so here regardless — `error` is not
 * delayed, because the whole point of the line is that a bad save is loud.
 */
const QUIET_MS = 500;

function useSettled(phase: SyncPhase): SyncPhase {
  /** What the line says, which lags the truth only while saving is brief. */
  const [shown, setShown] = useState(phase);
  /** The phase last seen, so the change itself can be spotted during render. */
  const [seen, setSeen] = useState(phase);

  if (phase !== seen) {
    setSeen(phase);
    /* Anything that is not saving is said at once — a save that has landed, and
       above all one that failed. Only the start of saving waits. */
    if (phase !== 'syncing') setShown(phase);
  }

  /* The timer is the external system this synchronises with, which is what an
     effect is for. It restarts whenever saving does, so a burst of
     per-keystroke writes never accumulates its way past the window. */
  useEffect(() => {
    if (phase !== 'syncing') return;
    const t = window.setTimeout(() => setShown('syncing'), QUIET_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  return shown;
}

export default function SavedLine({ sync }: { sync: SyncView }) {
  const phase = useSettled(sync.phase);
  const failed = phase === 'error';

  return (
    <span className={failed ? 'saved-line is-error' : 'saved-line'}>
      {/* A tick is the whole message at a glance; the words are for when you
          stop to read. Nothing at all while saving — a spinner in a header the
          eye is not on is movement for its own sake. */}
      {failed ? <Warning size={13} weight="fill" /> : phase !== 'syncing' && <Check size={13} />}
      <span role="status">{savedLabel(phase, sync.unsynced)}</span>
      {failed && (
        <button type="button" className="sync-retry" onClick={sync.retry}>
          Try again
        </button>
      )}
    </span>
  );
}
