import { describe, expect, it } from 'vitest';
import { detailsToAsk, missingDetails, parseNotNeeded } from '../details';
import { changedSinceShared, toSharePayload } from '../sharedSong';
import { emptyStore, parseStore, serializeStore, type SongStore } from '../storage';
import { songsReducer } from '../../hooks/useSongs';

/**
 * Opening a song to edit asks after what it is missing — who plays it, notes
 * on how to play it — unless the player has said this song does not need it.
 */

function song(): { store: SongStore; id: string } {
  const store = songsReducer(emptyStore(), { type: 'CREATE_SONG', title: 'Low Tide' });
  return { store, id: store.currentId! };
}

const notNeeded = (store: SongStore, id: string, detail: 'artist' | 'notes', on = true) =>
  songsReducer(store, { type: 'SET_NOT_NEEDED', id, detail, notNeeded: on });

describe('what a song is missing', () => {
  it('is who plays it and notes, until each is there', () => {
    const { store, id } = song();
    expect(missingDetails(store.songs[0])).toEqual(['artist', 'notes']);
    const artist = songsReducer(store, { type: 'SET_ARTIST', id, artist: 'Oasis' });
    expect(missingDetails(artist.songs[0])).toEqual(['notes']);
    const noted = songsReducer(artist, {
      type: 'ADD_NOTE',
      id,
      note: { id: 'n1', kind: 'strum', text: 'D DU' },
    });
    expect(missingDetails(noted.songs[0])).toEqual([]);
  });

  it('leaves out what this song has been said not to need', () => {
    const { store, id } = song();
    const next = notNeeded(store, id, 'artist');
    expect(next.songs[0].notNeeded).toEqual(['artist']);
    expect(missingDetails(next.songs[0])).toEqual(['notes']);
  });

  it('asks again once the tick is taken off, and leaves no key behind', () => {
    const { store, id } = song();
    const off = notNeeded(notNeeded(store, id, 'notes'), id, 'notes', false);
    expect('notNeeded' in off.songs[0]).toBe(false);
    expect(missingDetails(off.songs[0])).toEqual(['artist', 'notes']);
  });

  it('is no edit when the tick is already as asked', () => {
    const { store, id } = song();
    const once = notNeeded(store, id, 'artist');
    expect(notNeeded(once, id, 'artist')).toBe(once);
    expect(notNeeded(store, id, 'notes', false)).toBe(store);
  });
});

describe('when the song screen asks', () => {
  it('asks about a song made before this session, not one just made', () => {
    const s = song().store.songs[0];
    expect(detailsToAsk(s, s.createdAt + 1)).toEqual(['artist', 'notes']);
    expect(detailsToAsk(s, s.createdAt)).toEqual([]);
  });
});

describe('the ticks, kept', () => {
  it('survive a reload, and anything unknown in them is dropped', () => {
    const { store, id } = song();
    const next = notNeeded(store, id, 'notes');
    expect(parseStore(serializeStore(next))!.songs[0].notNeeded).toEqual(['notes']);
    expect(parseNotNeeded(['notes', 'capo', 'notes', 3])).toEqual(['notes']);
    expect(parseNotNeeded('artist')).toEqual([]);
  });

  it('do not travel with a shared song', () => {
    const { store, id } = song();
    expect('notNeeded' in toSharePayload(notNeeded(store, id, 'artist').songs[0])).toBe(false);
  });

  /* Ticking one is about this copy only. If it read as a change, the song
     screen would offer to share changes that no one else would ever see. */
  it('do not make a shared song read as changed since it was shared', () => {
    const { store, id } = song();
    const at = store.songs[0].updatedAt;
    const shared = songsReducer(store, {
      type: 'SONG_SHARED',
      id,
      shareId: 's1',
      version: 1,
      listed: false,
      sentUpdatedAt: at,
    });
    expect(changedSinceShared(shared.songs[0])).toBe(false);
    const ticked = notNeeded(shared, id, 'artist');
    expect(ticked.unsynced).toContain(id);
    expect(changedSinceShared(ticked.songs[0])).toBe(false);
  });

  it('leave a real change since sharing still showing as one', () => {
    const { store, id } = song();
    const shared = songsReducer(store, {
      type: 'SONG_SHARED',
      id,
      shareId: 's1',
      version: 1,
      listed: false,
      sentUpdatedAt: store.songs[0].updatedAt,
    });
    const edited = songsReducer(shared, { type: 'SET_TITLE', id, title: 'High Tide' });
    expect(changedSinceShared(notNeeded(edited, id, 'artist').songs[0])).toBe(true);
  });
});
