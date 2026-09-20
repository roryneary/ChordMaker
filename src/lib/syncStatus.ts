/**
 * Whether the account really has your songs, as a thing the UI can say.
 *
 * Before this existed every Firestore call was fire-and-forget: a refused or
 * unreachable write became an unhandled rejection, the sidebar went on saying
 * "Songs saved to your account", and a broken sync was indistinguishable from
 * a working one — or from sync not being built at all.
 *
 * Pure, so the transitions can be tested without a Firestore. `useSongs` feeds
 * it; *which* songs are unconfirmed lives in the song store itself
 * (`SongStore.unsynced`), because that has to survive a reload and this does
 * not.
 */

export interface SyncState {
  /** False when the build carries no Firebase config — see lib/firebase.ts. */
  configured: boolean;
  uid: string | null;
  online: boolean;
  hydrating: boolean;
  /** The account's library has been fetched and merged this session. */
  hydrated: boolean;
  /** Writes and deletes sent and not yet answered. */
  pending: number;
  /** The code of the most recent failure, until a retry or the work clearing. */
  error: string | null;
}

export type SyncAction =
  | { type: 'account'; uid: string | null }
  | { type: 'online'; online: boolean }
  | { type: 'hydrateStarted'; uid: string }
  | { type: 'hydrateSucceeded'; uid: string }
  | { type: 'hydrateFailed'; uid: string; code: string }
  | { type: 'writeStarted'; uid: string }
  | { type: 'writeSucceeded'; uid: string }
  | { type: 'writeFailed'; uid: string; code: string }
  | { type: 'retry'; uid: string };

export const initialSync = (configured: boolean, online = true): SyncState => ({
  configured,
  uid: null,
  online,
  hydrating: false,
  hydrated: false,
  pending: 0,
  error: null,
});

export function syncReducer(state: SyncState, action: SyncAction): SyncState {
  if (action.type === 'online') {
    return state.online === action.online ? state : { ...state, online: action.online };
  }

  if (action.type === 'account') {
    if (action.uid === state.uid) return state;
    return { ...initialSync(state.configured, state.online), uid: action.uid };
  }

  /* A write outlives the account that sent it: sign out mid-flight and the
     answer still arrives. Counting it against whoever is signed in now would
     drive `pending` negative, or pin somebody else's error on them. */
  if (action.uid !== state.uid) return state;

  switch (action.type) {
    case 'hydrateStarted':
      return { ...state, hydrating: true, error: null };
    case 'hydrateSucceeded':
      return { ...state, hydrating: false, hydrated: true };
    case 'hydrateFailed':
      return { ...state, hydrating: false, error: action.code };
    case 'writeStarted':
      return { ...state, pending: state.pending + 1 };
    case 'writeSucceeded':
      return { ...state, pending: Math.max(0, state.pending - 1) };
    case 'writeFailed':
      return { ...state, pending: Math.max(0, state.pending - 1), error: action.code };
    case 'retry':
      return { ...state, error: null };
  }
}

export type SyncPhase = 'off' | 'signedOut' | 'syncing' | 'offline' | 'synced' | 'error';

/**
 * `unsynced` is how many songs the store still holds unconfirmed. It decides
 * two things the state alone cannot: an error is only worth showing while
 * something is actually unsaved (a later write that lands makes it history),
 * and "synced" is only true once nothing is waiting.
 */
export function syncPhase(state: SyncState, unsynced: number): SyncPhase {
  if (!state.configured) return 'off';
  if (!state.uid) return 'signedOut';

  const waiting = unsynced > 0 || !state.hydrated;
  if (state.hydrating || state.pending > 0) return state.online ? 'syncing' : 'offline';
  if (state.error && waiting) return 'error';
  if (waiting) return state.online ? 'syncing' : 'offline';
  return 'synced';
}

/** Firestore's `permission-denied`, whatever prefix or wrapper it arrives in. */
export function errorCode(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && code) return code.replace(/^firestore\//, '');
  return 'unknown';
}

const REASONS: Record<string, string> = {
  'permission-denied': 'the database refused it',
  unauthenticated: 'the sign-in has expired',
  unavailable: 'the database could not be reached',
  'deadline-exceeded': 'the database took too long',
  'resource-exhausted': 'the database quota is used up',
  'not-found': 'the database does not exist',
  'failed-precondition': 'the database is not set up',
};

export const syncErrorReason = (code: string): string =>
  REASONS[code] ?? `something went wrong (${code})`;

/** The one line under the handle. Says what is true, not what is hoped. */
export function syncLabel(phase: SyncPhase, error: string | null, unsynced: number): string {
  switch (phase) {
    case 'off':
      return 'No database in this build';
    case 'signedOut':
      return 'Keep your songs on every device';
    case 'syncing':
      return 'Saving to your account…';
    case 'offline':
      return unsynced > 0
        ? `No signal · ${unsynced} to save when it returns`
        : 'No signal · saved on this device';
    case 'error':
      return `Not saved to your account: ${syncErrorReason(error ?? 'unknown')}`;
    case 'synced':
      return 'Songs saved to your account';
  }
}

/** What the screens are handed: one phase, one sentence, one way to try again. */
export interface SyncView {
  phase: SyncPhase;
  label: string;
  /** How many songs, playlists and kept chords the account has not confirmed. */
  unsynced: number;
  retry: () => void;
}

/**
 * The same truth, said in the song rather than on the account chip.
 *
 * `syncLabel` is about the account, which is right where it sits — under the
 * handle, next to the way in and out of it. In a song it would be answering a
 * question nobody asked: what you want to know while you are typing is that
 * the song is kept, and signed out `syncLabel` says "Keep your songs on every
 * device", which is a sales pitch where a status belongs.
 *
 * So this one leads with the device, which is what `localStorage` has already
 * done by the time it renders, and mentions the account only where the two
 * differ. "Saved" unqualified is reserved for both places holding it.
 */
export function savedLabel(phase: SyncPhase, unsynced: number): string {
  switch (phase) {
    // No account to be had, or none signed in: the device is the whole story.
    case 'off':
    case 'signedOut':
      return 'Saved on this device';
    case 'syncing':
      return 'Saving…';
    case 'offline':
      return unsynced > 0 ? 'Saved on this device · no signal' : 'Saved';
    case 'error':
      return 'Saved here, not to your account';
    case 'synced':
      return 'Saved';
  }
}
