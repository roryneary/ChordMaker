import { describe, expect, it } from 'vitest';
import {
  MAX_LYRIC_CHARS,
  changedSinceShared,
  copyOf,
  parseSharedCard,
  parseSharedSong,
  senderLabel,
  shareUrl,
  songFromShare,
  toSharePayload,
  toSharedCard,
  tooBigToSave,
  updateAvailable,
} from '../sharedSong';
import { withoutUndefined } from '../firestoreData';
import { type SongStore, emptyStore, newSong, parseStore, serializeStore } from '../storage';
import { songsReducer } from '../../hooks/useSongs';
import { tokenise } from '../lyric';
import { emptySpec } from '../../hooks/useChordSpec';
import type { SharedSong } from '../../types/sharedSong';
import type { Song } from '../../types/song';

const spec = (name: string) => ({ ...emptySpec(), name });

/** A song with everything on it that must, and must not, travel. */
function harbourLights(): Song {
  const lyric = 'Harbour lights are low\nand the tide is turning';
  const words = tokenise(lyric);
  return {
    ...newSong('Harbour Lights'),
    capo: 2,
    chords: [{ id: 'c1', spec: spec('G') }],
    lyric,
    words,
    placements: { [words[0].id]: 'c1' },
    shared: { shareId: 'share-1', version: 3, at: 5, listed: true },
    copiedFrom: { shareId: 'older', version: 1, uid: 'u-sam', handle: 'sam' },
  };
}

const sharedFrom = (song: Song, over: Partial<SharedSong> = {}): SharedSong => ({
  id: 'share-1',
  ownerUid: 'u-rory',
  handle: 'rory',
  display: 'Rory',
  songId: song.id,
  version: 1,
  song: toSharePayload(song),
  publishedAt: 100,
  updatedAt: 100,
  ...over,
});

describe('what travels', () => {
  it('carries the music and nothing about whose library it was in', () => {
    const payload = toSharePayload(harbourLights());
    expect(Object.keys(payload).sort()).toEqual(
      ['capo', 'chords', 'feel', 'key', 'lyric', 'placements', 'title', 'words'].sort(),
    );
  });

  it('leaves an unanswered capo unanswered, rather than answering it', () => {
    const payload = toSharePayload(newSong('No capo chosen'));
    expect('capo' in payload).toBe(false);
  });

  it('survives the database and comes back the same', () => {
    const shared = sharedFrom(harbourLights());
    const { id, ...doc } = shared;
    expect(parseSharedSong(id, JSON.parse(JSON.stringify(doc)))).toEqual(shared);
  });

  it('refuses a document that is not a shared song', () => {
    expect(parseSharedSong('x', null)).toBeNull();
    expect(parseSharedSong('x', { ownerUid: 'u', handle: 'h', version: 1 })).toBeNull();
    expect(parseSharedSong('x', { song: {}, handle: 'h', version: 1 })).toBeNull();
  });

  it('draws a library card from the song, with a title that can be searched', () => {
    const card = toSharedCard(sharedFrom({ ...harbourLights(), title: '  Harbour Lights ' }));
    expect(card.titleLower).toBe('harbour lights');
    expect(card.chordCount).toBe(1);
    expect(card.firstChords).toEqual([spec('G')]);
    expect(parseSharedCard(card.id, JSON.parse(JSON.stringify(card)))).toEqual(card);
  });
});

describe("the recipient's copy", () => {
  it('is a new song of their own that remembers where it came from', () => {
    const theirs = harbourLights();
    const mine = songFromShare(sharedFrom(theirs, { version: 4 }), 'mine', 999);

    expect(mine.id).toBe('mine');
    expect(mine.title).toBe('Harbour Lights');
    expect(mine.placements).toEqual(theirs.placements);
    expect(mine.createdAt).toBe(999);
    expect(mine.copiedFrom).toEqual({
      shareId: 'share-1',
      version: 4,
      uid: 'u-rory',
      handle: 'rory',
      display: 'Rory',
    });
    // The sender's own link out is theirs, not something a copy inherits.
    expect(mine.shared).toBeUndefined();
  });

  it('names the sender by handle, as they typed it when there is one', () => {
    expect(senderLabel({ handle: 'rory', display: 'Rory' })).toBe('@Rory');
    expect(senderLabel({ handle: 'rory' })).toBe('@rory');
  });

  it('is told of a newer version, and only of a newer version of the same song', () => {
    const mine = songFromShare(sharedFrom(harbourLights(), { version: 2 }), 'mine');
    expect(updateAvailable(mine, sharedFrom(mine, { version: 2 }))).toBe(false);
    expect(updateAvailable(mine, sharedFrom(mine, { version: 3 }))).toBe(true);
    expect(updateAvailable(mine, sharedFrom(mine, { id: 'another', version: 9 }))).toBe(false);
  });

  it('is not told once it has gone its own way, or once the share is gone', () => {
    const mine = songFromShare(sharedFrom(harbourLights()), 'mine');
    const newer = sharedFrom(mine, { version: 5 });
    const kept: Song = { ...mine, copiedFrom: { ...mine.copiedFrom!, follows: false } };
    expect(updateAvailable(kept, newer)).toBe(false);
    expect(updateAvailable(mine, null)).toBe(false);
    expect(updateAvailable(newSong('made here'), newer)).toBe(false);
  });

  it('finds the copy already in the library', () => {
    const mine = songFromShare(sharedFrom(harbourLights()), 'mine');
    expect(copyOf([newSong('other'), mine], 'share-1')?.id).toBe('mine');
    expect(copyOf([newSong('other')], 'share-1')).toBeNull();
  });
});

describe('in the reducer', () => {
  const adopt = (shared: SharedSong, id = 'mine') =>
    songsReducer(emptyStore(), { type: 'ADOPT_SONG', song: songFromShare(shared, id) });

  it('keeps a shared song signed out: it is just a song, waiting for an account', () => {
    const store = adopt(sharedFrom(harbourLights()));
    expect(store.songs.map((s) => s.id)).toEqual(['mine']);
    expect(store.currentId).toBe('mine');
    expect(store.unsynced).toEqual(['mine']);
  });

  it('never lets a kept song arrive already shared', () => {
    const smuggled = { ...songFromShare(sharedFrom(harbourLights()), 'mine'), shared: harbourLights().shared };
    const store = songsReducer(emptyStore(), { type: 'ADOPT_SONG', song: smuggled });
    expect('shared' in store.songs[0]).toBe(false);
  });

  it('does not keep the same copy twice', () => {
    const once = adopt(sharedFrom(harbourLights()));
    const twice = songsReducer(once, { type: 'ADOPT_SONG', song: once.songs[0] });
    expect(twice).toBe(once);
  });

  it('round-trips a kept song through storage, lineage and all', () => {
    const store = adopt(sharedFrom(harbourLights()));
    expect(parseStore(serializeStore(store))).toEqual(store);
  });

  it('"replace mine" takes the new version but keeps the id, so playlists still hold it', () => {
    let store = adopt(sharedFrom(harbourLights()));
    store = songsReducer(store, { type: 'CREATE_PLAYLIST', name: 'Friday', songIds: ['mine'] });
    store = songsReducer(store, { type: 'SET_CAPO', id: 'mine', capo: 5 });

    const theirsNow: Song = { ...newSong('Harbour Lights (live)'), lyric: 'new words' };
    store = songsReducer(store, {
      type: 'REPLACE_FROM_SHARE',
      id: 'mine',
      shared: sharedFrom(theirsNow, { version: 2 }),
    });

    const mine = store.songs[0];
    expect(mine.id).toBe('mine');
    expect(mine.title).toBe('Harbour Lights (live)');
    expect(mine.copiedFrom?.version).toBe(2);
    // The new version never answered the capo, so my old answer must not survive it.
    expect('capo' in mine).toBe(false);
    expect(store.playlists[0].items.map((i) => i.songId)).toEqual(['mine']);
  });

  it('will not replace a song that was not taken from that share', () => {
    const store = adopt(sharedFrom(harbourLights()));
    const next = songsReducer(store, {
      type: 'REPLACE_FROM_SHARE',
      id: 'mine',
      shared: sharedFrom(newSong('Someone else entirely'), { id: 'another', version: 9 }),
    });
    expect(next).toBe(store);
  });

  it('"keep mine" stops the questions but keeps the lineage', () => {
    let store = adopt(sharedFrom(harbourLights()));
    store = songsReducer(store, { type: 'STOP_FOLLOWING', id: 'mine' });
    expect(store.songs[0].copiedFrom).toMatchObject({ handle: 'rory', follows: false });
    expect(songsReducer(store, { type: 'STOP_FOLLOWING', id: 'mine' })).toBe(store);
  });
});

describe('the owner, after sharing', () => {
  const made = (): SongStore => {
    const store = songsReducer(emptyStore(), { type: 'CREATE_SONG', title: 'Mine', id: 's1' });
    return { ...store, unsynced: [] };
  };
  const shareIt = (store: SongStore, sentUpdatedAt: number | null, version = 1) =>
    songsReducer(store, {
      type: 'SONG_SHARED',
      id: 's1',
      shareId: 'share-1',
      version,
      listed: false,
      sentUpdatedAt,
    });

  it('does not read as changed the moment it is shared', () => {
    const before = made();
    const store = shareIt(before, before.songs[0].updatedAt);
    expect(store.songs[0].shared).toMatchObject({ shareId: 'share-1', version: 1, listed: false });
    expect(changedSinceShared(store.songs[0])).toBe(false);
    // It still has to reach the account, so the owner's other devices know.
    expect(store.unsynced).toEqual(['s1']);
  });

  it('reads as changed after an edit, and not again once the changes are shared', () => {
    let store = shareIt(made(), made().songs[0].updatedAt);
    store = songsReducer(store, { type: 'SET_TITLE', id: 's1', title: 'Mine, reworked' });
    expect(changedSinceShared(store.songs[0])).toBe(true);

    store = shareIt(store, store.songs[0].updatedAt, 2);
    expect(store.songs[0].shared?.version).toBe(2);
    expect(changedSinceShared(store.songs[0])).toBe(false);
  });

  it('still reads as changed when the edit landed while the share was in flight', () => {
    const before = made();
    const sent = before.songs[0].updatedAt;
    const edited = songsReducer(before, { type: 'SET_TITLE', id: 's1', title: 'Edited mid-flight' });
    expect(changedSinceShared(shareIt(edited, sent).songs[0])).toBe(true);
  });

  it('listing or unlisting does not disturb whether it has changed', () => {
    let store = shareIt(made(), made().songs[0].updatedAt);
    const relist = (s: typeof store) =>
      songsReducer(s, {
        type: 'SONG_SHARED',
        id: 's1',
        shareId: 'share-1',
        version: 1,
        listed: true,
        sentUpdatedAt: null,
      });

    store = relist(store);
    expect(store.songs[0].shared?.listed).toBe(true);
    expect(changedSinceShared(store.songs[0])).toBe(false);

    store = songsReducer(store, { type: 'SET_TITLE', id: 's1', title: 'Changed' });
    expect(changedSinceShared(relist(store).songs[0])).toBe(true);
  });

  /* The screen takes a shared song's link down before it asks for this; what
     the reducer owes is that the delete itself is no different for having been
     shared — gone, out of every playlist, and told to the account. */
  it('deletes like any other song: gone, out of its playlists, and the account told', () => {
    let store = shareIt(made(), made().songs[0].updatedAt);
    store = songsReducer(store, { type: 'CREATE_PLAYLIST', name: 'Friday', songIds: ['s1'] });
    store = songsReducer(store, { type: 'DELETE_SONG', id: 's1' });

    expect(store.songs).toEqual([]);
    expect(store.playlists[0].items).toEqual([]);
    expect(store.unsynced).toContain('s1');
  });

  it('stops being shared without a trace of the key', () => {
    let store = shareIt(made(), made().songs[0].updatedAt);
    store = songsReducer(store, { type: 'SONG_UNSHARED', id: 's1' });
    expect('shared' in store.songs[0]).toBe(false);
    expect(changedSinceShared(store.songs[0])).toBe(false);
  });
});

describe('what the account will take', () => {
  it('allows four times the longest real song, and says so past that', () => {
    const song = newSong('Long');
    expect(tooBigToSave({ ...song, lyric: 'x'.repeat(MAX_LYRIC_CHARS) })).toBeNull();
    expect(tooBigToSave({ ...song, lyric: 'x'.repeat(MAX_LYRIC_CHARS + 1) })).toMatch(/too long/);
  });

  it('never sends the database an undefined, however deep', () => {
    const song: Song = {
      ...newSong('Sparse'),
      capo: undefined,
      copiedFrom: { shareId: 's', version: 1, uid: 'u', handle: 'h', display: undefined },
    };
    const doc = withoutUndefined(song);
    expect('capo' in doc).toBe(false);
    expect('display' in doc.copiedFrom!).toBe(false);
    expect(doc.copiedFrom?.handle).toBe('h');
  });
});

describe('the link', () => {
  it('lives in the hash, whatever hash the page was on', () => {
    expect(shareUrl('abc', 'https://chordcreator.netlify.app/#/song/1/ready')).toBe(
      'https://chordcreator.netlify.app/#/shared/abc',
    );
    expect(shareUrl('abc', 'http://localhost:5183/')).toBe('http://localhost:5183/#/shared/abc');
  });
});
