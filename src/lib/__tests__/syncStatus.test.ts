import { describe, expect, it } from 'vitest';
import {
  type SyncState,
  errorCode,
  initialSync,
  savedLabel,
  syncLabel,
  syncPhase,
  syncReducer,
} from '../syncStatus';

/**
 * The sidebar used to say "Songs saved to your account" unconditionally, over
 * writes nobody ever checked. These are the transitions that sentence now
 * depends on, so it can only be shown when it is true.
 */

const UID = 'rory';
const signedIn = (): SyncState => syncReducer(initialSync(true), { type: 'account', uid: UID });
const hydrated = (): SyncState =>
  syncReducer(syncReducer(signedIn(), { type: 'hydrateStarted', uid: UID }), {
    type: 'hydrateSucceeded',
    uid: UID,
  });

describe('the sync phase', () => {
  it('is off when the build has no database, whoever is signed in', () => {
    const state = syncReducer(initialSync(false), { type: 'account', uid: UID });
    expect(syncPhase(state, 3)).toBe('off');
  });

  it('is signed out until an account attaches', () => {
    expect(syncPhase(initialSync(true), 0)).toBe('signedOut');
  });

  it('does not claim "synced" before the account has been read', () => {
    expect(syncPhase(signedIn(), 0)).toBe('syncing');
    expect(syncPhase(hydrated(), 0)).toBe('synced');
  });

  it('is syncing while a write is out, and synced once it is answered', () => {
    let state = syncReducer(hydrated(), { type: 'writeStarted', uid: UID });
    expect(state.pending).toBe(1);
    expect(syncPhase(state, 1)).toBe('syncing');

    state = syncReducer(state, { type: 'writeSucceeded', uid: UID });
    expect(state.pending).toBe(0);
    expect(syncPhase(state, 0)).toBe('synced');
  });

  it('counts several writes and never goes below none', () => {
    let state = hydrated();
    state = syncReducer(state, { type: 'writeStarted', uid: UID });
    state = syncReducer(state, { type: 'writeStarted', uid: UID });
    expect(state.pending).toBe(2);
    state = syncReducer(state, { type: 'writeSucceeded', uid: UID });
    state = syncReducer(state, { type: 'writeSucceeded', uid: UID });
    state = syncReducer(state, { type: 'writeSucceeded', uid: UID });
    expect(state.pending).toBe(0);
  });

  it('reports a refused write, and keeps reporting it until a retry', () => {
    let state = syncReducer(hydrated(), { type: 'writeStarted', uid: UID });
    state = syncReducer(state, { type: 'writeFailed', uid: UID, code: 'permission-denied' });
    expect(syncPhase(state, 1)).toBe('error');
    expect(state.error).toBe('permission-denied');

    state = syncReducer(state, { type: 'retry', uid: UID });
    expect(state.error).toBeNull();
    state = syncReducer(state, { type: 'writeStarted', uid: UID });
    expect(syncPhase(state, 1)).toBe('syncing');
  });

  it('lets a later success make an old error history', () => {
    let state = syncReducer(hydrated(), { type: 'writeStarted', uid: UID });
    state = syncReducer(state, { type: 'writeFailed', uid: UID, code: 'unavailable' });
    // The song was edited again, that write landed, and nothing is left unsaved.
    expect(syncPhase(state, 0)).toBe('synced');
  });

  it('reports a failed first read, since nothing is known to be saved', () => {
    let state = syncReducer(signedIn(), { type: 'hydrateStarted', uid: UID });
    state = syncReducer(state, { type: 'hydrateFailed', uid: UID, code: 'permission-denied' });
    expect(syncPhase(state, 0)).toBe('error');
  });

  it('says "no signal" rather than "saving" when there is none', () => {
    let state = syncReducer(hydrated(), { type: 'online', online: false });
    expect(syncPhase(state, 0)).toBe('synced');
    expect(syncPhase(state, 2)).toBe('offline');
    state = syncReducer(state, { type: 'writeStarted', uid: UID });
    expect(syncPhase(state, 2)).toBe('offline');
  });

  it('ignores the answer to a write sent by an account that has since left', () => {
    let state = syncReducer(hydrated(), { type: 'writeStarted', uid: UID });
    state = syncReducer(state, { type: 'account', uid: 'someone-else' });
    expect(state.pending).toBe(0);

    const after = syncReducer(state, { type: 'writeFailed', uid: UID, code: 'unavailable' });
    expect(after).toBe(state);
    expect(after.error).toBeNull();
  });

  it('starts over for a new account, but remembers whether there is signal', () => {
    let state = syncReducer(hydrated(), { type: 'online', online: false });
    state = syncReducer(state, { type: 'account', uid: null });
    expect(state.hydrated).toBe(false);
    expect(state.online).toBe(false);
    expect(syncPhase(state, 0)).toBe('signedOut');
  });
});

describe('what the user is told', () => {
  it('names the reason a write was refused', () => {
    expect(syncLabel('error', 'permission-denied', 1)).toBe(
      'Not saved to your account: the database refused it',
    );
    expect(syncLabel('error', 'some-new-code', 1)).toContain('some-new-code');
  });

  it('only says saved when it is', () => {
    expect(syncLabel('synced', null, 0)).toBe('Songs saved to your account');
    expect(syncLabel('syncing', null, 1)).not.toContain('saved to');
    expect(syncLabel('off', null, 0)).toBe('No database in this build');
  });

  it('counts what is waiting for a signal', () => {
    expect(syncLabel('offline', null, 2)).toContain('2 to save');
  });

  it('reads the code off a Firestore error, whatever shape it arrives in', () => {
    expect(errorCode({ code: 'permission-denied' })).toBe('permission-denied');
    expect(errorCode({ code: 'firestore/unavailable' })).toBe('unavailable');
    expect(errorCode(new Error('boom'))).toBe('unknown');
    expect(errorCode(null)).toBe('unknown');
  });
});

/**
 * The same truth said in the song rather than on the account chip. The line is
 * there to answer "is this kept?", so what it must never do is go quiet, or
 * turn into an advert, in the states where the answer is only half yes.
 */
describe('what the song itself says', () => {
  it('claims the device on its own when there is no account behind it', () => {
    // The sidebar's own words here are "Keep your songs on every device" —
    // an offer, where someone mid-verse wants a status.
    expect(savedLabel('signedOut', 0)).toBe('Saved on this device');
    expect(savedLabel('off', 0)).toBe('Saved on this device');
  });

  it('says plain "Saved" only when both places hold it', () => {
    expect(savedLabel('synced', 0)).toBe('Saved');
    expect(savedLabel('offline', 0)).toBe('Saved');
    expect(savedLabel('syncing', 1)).not.toContain('Saved');
  });

  it('owns up to the account being behind, without hiding that the song is safe', () => {
    const behind = savedLabel('offline', 2);
    expect(behind).toContain('this device');
    expect(behind).toContain('no signal');

    const failed = savedLabel('error', 1);
    expect(failed).toContain('Saved here');
    expect(failed).toContain('not to your account');
  });
});
