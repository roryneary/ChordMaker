import { describe, expect, it } from 'vitest';
import { songsReducer } from '../../hooks/useSongs';
import {
  matchesQuery,
  membershipBySong,
  moveItem,
  newPlaylist,
  parsePlaylist,
  playlistNameTaken,
  resolveItems,
} from '../playlists';
import { type SongStore, emptyStore, newSong, parseStore, serializeStore } from '../storage';
import type { Playlist } from '../../types/playlist';

/** A store with three songs and one playlist holding the first two. */
function setUp() {
  let store: SongStore = emptyStore();
  for (const title of ['One', 'Two', 'Three']) {
    store = songsReducer(store, { type: 'CREATE_SONG', title });
  }
  // CREATE_SONG puts the newest first.
  const [three, two, one] = store.songs.map((s) => s.id);
  store = songsReducer(store, {
    type: 'CREATE_PLAYLIST',
    name: 'Saturday',
    id: 'p1',
    songIds: [one, two],
  });
  // As if the account had confirmed everything so far.
  store = { ...store, unsynced: [], unsyncedPlaylists: [] };
  return { store, one, two, three };
}

const playlist = (store: SongStore, id = 'p1'): Playlist =>
  store.playlists.find((p) => p.id === id)!;
const songIds = (store: SongStore, id = 'p1') => playlist(store, id).items.map((i) => i.songId);

describe('playlists in the reducer', () => {
  it('makes a playlist holding the songs it was given, in order', () => {
    const { store, one, two } = setUp();
    expect(playlist(store).name).toBe('Saturday');
    expect(songIds(store)).toEqual([one, two]);
  });

  it('lists a new playlist as unconfirmed', () => {
    const { store } = setUp();
    const after = songsReducer(store, { type: 'CREATE_PLAYLIST', name: 'Lesson', id: 'p2' });
    expect(after.unsyncedPlaylists).toEqual(['p2']);
  });

  /* A nameless playlist is a blank pill on every song in it; two by one name
     are two pills nobody can tell apart. */
  it('refuses a playlist with no name, or a name already taken', () => {
    const { store } = setUp();
    expect(songsReducer(store, { type: 'CREATE_PLAYLIST', name: '   ' })).toBe(store);
    expect(songsReducer(store, { type: 'CREATE_PLAYLIST', name: ' saturday ' })).toBe(store);
    expect(songsReducer(store, { type: 'RENAME_PLAYLIST', id: 'p1', name: '' })).toBe(store);
  });

  it('lets a playlist keep its own name when renamed, and tidies the new one', () => {
    const { store } = setUp();
    expect(songsReducer(store, { type: 'RENAME_PLAYLIST', id: 'p1', name: 'Saturday' })).toBe(
      store,
    );
    const after = songsReducer(store, { type: 'RENAME_PLAYLIST', id: 'p1', name: '  Sunday   set ' });
    expect(playlist(after).name).toBe('Sunday set');
    expect(after.unsyncedPlaylists).toEqual(['p1']);
  });

  it('ignores songs that do not exist', () => {
    const { store, three } = setUp();
    const after = songsReducer(store, {
      type: 'ADD_TO_PLAYLIST',
      id: 'p1',
      songIds: ['nope', three],
    });
    expect(songIds(after)).toHaveLength(3);
    expect(songIds(after)[2]).toBe(three);
    expect(songsReducer(store, { type: 'ADD_TO_PLAYLIST', id: 'p1', songIds: ['nope'] })).toBe(
      store,
    );
  });

  /* The opener reprised as the closer. Item ids are what make the two entries
     independently movable and removable. */
  it('holds the same song twice, and removes one entry without the other', () => {
    const { store, one } = setUp();
    const twice = songsReducer(store, { type: 'ADD_TO_PLAYLIST', id: 'p1', songIds: [one] });
    expect(songIds(twice).filter((id) => id === one)).toHaveLength(2);

    const last = playlist(twice).items[2];
    const after = songsReducer(twice, { type: 'REMOVE_FROM_PLAYLIST', id: 'p1', itemId: last.id });
    expect(songIds(after).filter((id) => id === one)).toHaveLength(1);
  });

  it('moves an entry, and treats a move to where it already is as no change', () => {
    const { store, one, two } = setUp();
    const first = playlist(store).items[0];
    const after = songsReducer(store, {
      type: 'MOVE_PLAYLIST_ITEM',
      id: 'p1',
      itemId: first.id,
      to: 1,
    });
    expect(songIds(after)).toEqual([two, one]);
    expect(after.unsyncedPlaylists).toEqual(['p1']);

    expect(
      songsReducer(store, { type: 'MOVE_PLAYLIST_ITEM', id: 'p1', itemId: first.id, to: 0 }),
    ).toBe(store);
  });

  /* ROADMAP.md §0: a playlist naming a song that is gone is an entry nobody can
     open. The sweep is in the reducer so no route to a delete can forget it. */
  it('takes a deleted song out of every playlist, and marks those playlists', () => {
    const base = setUp();
    const { one, two, three } = base;
    let store = base.store;
    store = songsReducer(store, { type: 'CREATE_PLAYLIST', name: 'Lesson', id: 'p2', songIds: [one] });
    store = songsReducer(store, { type: 'CREATE_PLAYLIST', name: 'Other', id: 'p3', songIds: [three] });
    store = { ...store, unsynced: [], unsyncedPlaylists: [] };

    const after = songsReducer(store, { type: 'DELETE_SONG', id: one });
    expect(songIds(after, 'p1')).toEqual([two]);
    expect(songIds(after, 'p2')).toEqual([]);
    // Untouched playlists are neither rewritten nor sent.
    expect(playlist(after, 'p3')).toBe(playlist(store, 'p3'));
    expect(after.unsyncedPlaylists.sort()).toEqual(['p1', 'p2']);
    expect(after.unsynced).toEqual([one]);
  });

  it('deletes a playlist without touching its songs, and keeps the delete listed', () => {
    const { store } = setUp();
    const after = songsReducer(store, { type: 'DELETE_PLAYLIST', id: 'p1' });
    expect(after.playlists).toHaveLength(0);
    expect(after.songs).toBe(store.songs);
    expect(after.unsyncedPlaylists).toEqual(['p1']);
  });

  it('strikes a playlist off only for the version the account confirmed', () => {
    const { store } = setUp();
    const renamed = songsReducer(store, { type: 'RENAME_PLAYLIST', id: 'p1', name: 'Sunday' });
    const stale = songsReducer(renamed, {
      type: 'PLAYLIST_SYNCED',
      id: 'p1',
      updatedAt: playlist(store).updatedAt,
    });
    expect(stale.unsyncedPlaylists).toEqual(['p1']);

    const confirmed = songsReducer(renamed, {
      type: 'PLAYLIST_SYNCED',
      id: 'p1',
      updatedAt: playlist(renamed).updatedAt,
    });
    expect(confirmed.unsyncedPlaylists).toEqual([]);
  });
});

describe('playlists across a sign-in', () => {
  it('leaves playlists alone when the account sent none to merge', () => {
    const { store } = setUp();
    const after = songsReducer(store, { type: 'HYDRATE', remote: store.songs, allowPush: true });
    expect(after.playlists).toBe(store.playlists);
  });

  it('pushes a playlist the account has never seen', () => {
    const { store } = setUp();
    const after = songsReducer(store, {
      type: 'HYDRATE',
      remote: store.songs,
      allowPush: true,
      remotePlaylists: [],
    });
    expect(after.playlists.map((p) => p.id)).toEqual(['p1']);
    expect(after.unsyncedPlaylists).toEqual(['p1']);
  });

  it('lets an unconfirmed local reorder beat the account, and a confirmed one lose', () => {
    const { store } = setUp();
    const remote: Playlist = { ...playlist(store), name: 'From the account' };

    const clean = songsReducer(store, {
      type: 'HYDRATE',
      remote: store.songs,
      allowPush: true,
      remotePlaylists: [remote],
    });
    expect(playlist(clean).name).toBe('From the account');

    const dirty = songsReducer(
      { ...store, unsyncedPlaylists: ['p1'] },
      { type: 'HYDRATE', remote: store.songs, allowPush: true, remotePlaylists: [remote] },
    );
    expect(playlist(dirty).name).toBe('Saturday');
    expect(dirty.unsyncedPlaylists).toEqual(['p1']);
  });

  it('does not resurrect a playlist deleted here while unconfirmed', () => {
    const { store } = setUp();
    const ghost = playlist(store);
    const deleted = songsReducer(store, { type: 'DELETE_PLAYLIST', id: 'p1' });
    const after = songsReducer(deleted, {
      type: 'HYDRATE',
      remote: store.songs,
      allowPush: true,
      remotePlaylists: [ghost],
    });
    expect(after.playlists).toHaveLength(0);
    expect(after.unsyncedPlaylists).toEqual(['p1']);
  });

  it('replaces the playlists with a different account’s, and restores its own', () => {
    const { store } = setUp();
    const theirs = newPlaylist('Theirs');
    const mine = newPlaylist('Set aside last time');
    const after = songsReducer(store, {
      type: 'HYDRATE',
      remote: [],
      allowPush: false,
      remotePlaylists: [theirs],
      restoredPlaylists: [mine],
    });
    expect(after.playlists.map((p) => p.name).sort()).toEqual(['Set aside last time', 'Theirs']);
    expect(after.unsyncedPlaylists).toEqual([mine.id]);
  });
});

describe('playlists in storage', () => {
  it('round-trips with the songs', () => {
    const { store } = setUp();
    expect(parseStore(serializeStore(store))).toEqual(store);
  });

  it('reads a store saved before playlists existed as having none', () => {
    const song = newSong('Old');
    const raw = JSON.stringify({ v: 2, songs: [song], currentId: song.id });
    const parsed = parseStore(raw);
    expect(parsed?.playlists).toEqual([]);
    expect(parsed?.unsyncedPlaylists).toEqual([]);
  });

  it('drops what is not a playlist or an item, and keeps the rest', () => {
    expect(parsePlaylist(null)).toBeNull();
    expect(parsePlaylist({ name: 'No id' })).toBeNull();
    const parsed = parsePlaylist({
      id: 'p',
      name: 'Set',
      items: [{ id: 'i1', songId: 's1', stray: true }, { id: 'i2' }, 'junk'],
    });
    expect(parsed?.items).toEqual([{ id: 'i1', songId: 's1' }]);
  });
});

describe('reading playlists', () => {
  it('says which playlists a song is in, once per playlist', () => {
    const { store, one, three } = setUp();
    const twice = songsReducer(store, { type: 'ADD_TO_PLAYLIST', id: 'p1', songIds: [one] });
    const map = membershipBySong(twice.playlists);

    expect(map.get(one)).toEqual([
      { playlistId: 'p1', name: 'Saturday', itemId: playlist(twice).items[0].id },
    ]);
    expect(map.get(three)).toBeUndefined();
  });

  /* A playlist can arrive from the account naming a song another device
     deleted. It is skipped, not drawn as a hole. */
  it('skips an entry whose song is not here', () => {
    const { store, one, two } = setUp();
    const withGhost: Playlist = {
      ...playlist(store),
      items: [{ id: 'g', songId: 'gone' }, ...playlist(store).items],
    };
    expect(resolveItems(withGhost, store.songs).map((r) => r.song.id)).toEqual([one, two]);
  });

  it('clamps a move to the ends and ignores an unknown entry', () => {
    const items = [
      { id: 'a', songId: '1' },
      { id: 'b', songId: '2' },
      { id: 'c', songId: '3' },
    ];
    expect(moveItem(items, 'a', 99).map((i) => i.id)).toEqual(['b', 'c', 'a']);
    expect(moveItem(items, 'c', -5).map((i) => i.id)).toEqual(['c', 'a', 'b']);
    expect(moveItem(items, 'zz', 1)).toBe(items);
  });

  it('knows a taken name whatever its case or spacing', () => {
    const { store } = setUp();
    expect(playlistNameTaken(store.playlists, '  SATURDAY ')).toBe(true);
    expect(playlistNameTaken(store.playlists, 'Saturday', 'p1')).toBe(false);
    expect(playlistNameTaken(store.playlists, 'Sunday')).toBe(false);
  });

  it('finds a song by any words of its title, in any order', () => {
    const song = { ...newSong('Harbour Lights'), id: 's' };
    expect(matchesQuery(song, '')).toBe(true);
    expect(matchesQuery(song, 'lights harb')).toBe(true);
    expect(matchesQuery(song, 'harbor')).toBe(false);
  });
});
