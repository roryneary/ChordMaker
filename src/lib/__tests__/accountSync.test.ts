import { describe, expect, it } from 'vitest';
import { mergeOnSignIn } from '../accountSync';
import { newSong } from '../storage';

/**
 * The Firestore calls in songSync.ts and chordSync.ts need a live project;
 * this is the rule underneath both of them that decides what a sign-in does
 * to two libraries, which is where the migration ROADMAP.md warns must not be
 * got wrong actually lives. Song fixtures stand in for both — the rule only
 * ever looks at `.id`.
 */

describe('mergeOnSignIn', () => {
  it('a brand new account keeps every local song and offers them all up', () => {
    const a = newSong('A');
    const b = newSong('B');
    const { merged, toPush } = mergeOnSignIn([a, b], [], true);
    expect(merged.map((s) => s.id).sort()).toEqual([a.id, b.id].sort());
    expect(toPush.map((s) => s.id).sort()).toEqual([a.id, b.id].sort());
  });

  it('an existing account with nothing local just gets its remote library', () => {
    const remote = newSong('Remote');
    const { merged, toPush } = mergeOnSignIn([], [remote], true);
    expect(merged).toEqual([remote]);
    expect(toPush).toEqual([]);
  });

  it('remote wins on a shared id — no attempt to merge two edited copies', () => {
    const shared = newSong('Shared');
    const localEdit = { ...shared, title: 'Shared (edited on this device)' };
    const remoteEdit = { ...shared, title: 'Shared (edited elsewhere)' };
    const { merged, toPush } = mergeOnSignIn([localEdit], [remoteEdit], true);
    expect(merged).toEqual([remoteEdit]);
    expect(toPush).toEqual([]);
  });

  it('a local-only song survives alongside an unrelated remote one', () => {
    const local = newSong('Local only');
    const remote = newSong('Remote only');
    const { merged, toPush } = mergeOnSignIn([local], [remote], true);
    expect(merged.map((s) => s.id).sort()).toEqual([local.id, remote.id].sort());
    expect(toPush).toEqual([local]);
  });

  it('a different account previously on this device never receives local work', () => {
    const strandedFromSomeoneElse = newSong('Not yours');
    const remote = newSong('Yours');
    const { merged, toPush } = mergeOnSignIn([strandedFromSomeoneElse], [remote], false);
    expect(merged).toEqual([remote]);
    expect(toPush).toEqual([]);
  });

  it('generalises to chords, not just songs — it only ever reads .id', () => {
    const local = { id: 'c1', spec: { name: 'G', rootFret: 1, fretCount: 4, markers: [], dots: [], barres: [] } };
    const { merged, toPush } = mergeOnSignIn([local], [], true);
    expect(merged).toEqual([local]);
    expect(toPush).toEqual([local]);
  });
});
