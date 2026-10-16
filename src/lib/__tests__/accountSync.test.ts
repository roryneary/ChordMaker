import { describe, expect, it } from 'vitest';
import { mergeOnSignIn, mergeStash, sameValue } from '../accountSync';
import { newSong } from '../storage';

/**
 * The Firestore calls in songSync.ts need a live project; this is the rule
 * underneath them that decides what a sign-in does to two libraries, which is
 * where the migration ROADMAP.md warns must not be got wrong actually lives.
 * The rule only ever looks at `.id`, which is what will let playlists reuse it.
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

  it("sets a different account's local work aside rather than dropping it", () => {
    const stranded = newSong('Made as someone else');
    const shared = newSong('Both have this');
    const { merged, stranded: aside } = mergeOnSignIn([stranded, shared], [shared], false);
    expect(merged).toEqual([shared]);
    // Only what the incoming account does not already hold needs keeping.
    expect(aside).toEqual([stranded]);
    // The ordinary case strands nothing.
    expect(mergeOnSignIn([stranded], [], true).stranded).toEqual([]);
  });

  it('generalises beyond songs — it only ever reads .id', () => {
    const local = { id: 'c1', spec: { name: 'G', rootFret: 1, fretCount: 4, markers: [], dots: [], barres: [] } };
    const { merged, toPush } = mergeOnSignIn([local], [], true);
    expect(merged).toEqual([local]);
    expect(toPush).toEqual([local]);
  });
});

/**
 * "Remote wins" is only safe to run on every page load if the device can say
 * which of its copies the account has never seen. Without this, editing a song
 * with no signal and reopening the app later silently reverted the edit.
 */
describe('unconfirmed local changes', () => {
  it('local wins on a shared id the account never confirmed, and goes back up', () => {
    const shared = newSong('Shared');
    const localEdit = { ...shared, title: 'Edited with no signal' };
    const { merged, toPush } = mergeOnSignIn([localEdit], [shared], true, [shared.id]);
    expect(merged).toEqual([localEdit]);
    expect(toPush).toEqual([localEdit]);
  });

  it('remote still wins on everything else', () => {
    const a = newSong('A');
    const b = newSong('B');
    const localA = { ...a, title: 'A, unconfirmed' };
    const localB = { ...b, title: 'B, stale copy' };
    const { merged, toPush } = mergeOnSignIn([localA, localB], [a, b], true, [a.id]);
    expect(merged).toEqual([localA, b]);
    expect(toPush).toEqual([localA]);
  });

  it('an unconfirmed delete stays deleted instead of coming back from the account', () => {
    const gone = newSong('Deleted on the pitch');
    const kept = newSong('Kept');
    const { merged, toPush, toDelete } = mergeOnSignIn([kept], [gone, kept], true, [gone.id]);
    expect(merged).toEqual([kept]);
    expect(toPush).toEqual([]);
    expect(toDelete).toEqual([gone.id]);
  });

  it('forgets an id that neither side has any more', () => {
    const { merged, toPush, toDelete } = mergeOnSignIn([], [], true, ['long-gone']);
    expect(merged).toEqual([]);
    expect(toPush).toEqual([]);
    expect(toDelete).toEqual([]);
  });

  it("never pushes another account's unconfirmed work, flagged or not", () => {
    const theirs = newSong('Not yours');
    const { merged, toPush, toDelete } = mergeOnSignIn([theirs], [], false, [theirs.id]);
    expect(merged).toEqual([]);
    expect(toPush).toEqual([]);
    expect(toDelete).toEqual([]);
  });
});

describe('a device this account has synced before', () => {
  it('drops what the account no longer holds: it was deleted on another device', () => {
    const gone = newSong('Deleted on the phone');
    const still = newSong('Still here');
    const { merged, toPush } = mergeOnSignIn([gone, still], [still], true, [], true);
    expect(merged.map((s) => s.id)).toEqual([still.id]);
    expect(toPush).toEqual([]);
  });

  it('keeps and sends what was made here and not yet confirmed', () => {
    const fresh = newSong('Made with no signal');
    const { merged, toPush } = mergeOnSignIn([fresh], [], true, [fresh.id], true);
    expect(merged).toEqual([fresh]);
    expect(toPush).toEqual([fresh]);
  });

  it('on a first sign-in, the same entry is local work and goes up', () => {
    const mine = newSong('Never sent');
    const { merged, toPush } = mergeOnSignIn([mine], [], true, [], false);
    expect(merged).toEqual([mine]);
    expect(toPush).toEqual([mine]);
  });

  it('keeps the local object when the account holds an identical copy', () => {
    const song = newSong('Same');
    const echo = { ...song };
    const { merged } = mergeOnSignIn([song], [echo], true, [], true);
    expect(merged[0]).toBe(song);
  });
});

describe('sameValue', () => {
  it('ignores key order and keys left undefined', () => {
    expect(sameValue({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
    expect(sameValue({ a: 1, capo: undefined }, { a: 1 })).toBe(true);
  });

  it('tells different data apart', () => {
    expect(sameValue({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameValue([1, 2], [2, 1])).toBe(false);
    expect(sameValue({ a: [] }, { a: {} })).toBe(false);
  });
});

describe('the stash', () => {
  it('adds to what is already set aside, the newer copy of an id replacing the older', () => {
    const a = newSong('A');
    const b = newSong('B');
    const newerA = { ...a, title: 'A, later' };
    expect(mergeStash([a], [b])).toEqual([a, b]);
    expect(mergeStash([a, b], [newerA])).toEqual([b, newerA]);
  });
});
