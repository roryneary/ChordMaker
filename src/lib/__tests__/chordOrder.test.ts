import { describe, expect, it } from 'vitest';
import { orderByFirstUse } from '../chordOrder';
import { songsReducer } from '../../hooks/useSongs';
import { emptyStore } from '../storage';
import { tokenise } from '../lyric';
import { emptySpec } from '../../hooks/useChordSpec';
import type { SongStore } from '../storage';

const spec = (name: string) => ({ ...emptySpec(), name });

/** A song with G, C, D added in that order and the words "one two three four". */
function song(): { store: SongStore; id: string; ids: Record<string, string> } {
  let store = songsReducer(emptyStore(), { type: 'CREATE_SONG', title: 'Order' });
  const id = store.currentId!;
  for (const name of ['G', 'C', 'D']) store = songsReducer(store, { type: 'ADD_CHORD', id, spec: spec(name) });
  store = songsReducer(store, { type: 'SET_LYRIC', id, lyric: 'one two\nthree four' });
  const s = store.songs[0];
  const ids = Object.fromEntries(s.chords.map((c) => [c.spec.name, c.id]));
  return { store, id, ids };
}

const names = (store: SongStore) => store.songs[0].chords.map((c) => c.spec.name);

describe('moving a chord along the row', () => {
  it('moves it to the place asked for', () => {
    const { store, id, ids } = song();
    const next = songsReducer(store, { type: 'REORDER_CHORD', id, chordId: ids.D, to: 0 });
    expect(names(next)).toEqual(['D', 'G', 'C']);
  });

  it('clamps a place past either end', () => {
    const { store, id, ids } = song();
    expect(names(songsReducer(store, { type: 'REORDER_CHORD', id, chordId: ids.G, to: 9 }))).toEqual([
      'C',
      'D',
      'G',
    ]);
  });

  /* Pressing "left" on the first chord: not an edit, so not a change anyone
     holding a copy should be told about. */
  it('is no edit at all when the chord is already there', () => {
    const { store, id, ids } = song();
    expect(songsReducer(store, { type: 'REORDER_CHORD', id, chordId: ids.G, to: -1 })).toBe(store);
    expect(songsReducer(store, { type: 'REORDER_CHORD', id, chordId: ids.D, to: 2 })).toBe(store);
    expect(songsReducer(store, { type: 'REORDER_CHORD', id, chordId: 'nope', to: 0 })).toBe(store);
  });
});

describe('ordering the chords as they are played', () => {
  it('goes by the first word each chord is on, and keeps unplaced ones last', () => {
    const { store, id, ids } = song();
    const words = store.songs[0].words;
    let next = songsReducer(store, { type: 'PLACE_CHORD', id, wordId: words[0].id, chordId: ids.D });
    next = songsReducer(next, { type: 'PLACE_CHORD', id, wordId: words[2].id, chordId: ids.G });
    next = songsReducer(next, { type: 'PLACE_CHORD', id, wordId: words[3].id, chordId: ids.D });
    next = songsReducer(next, { type: 'ORDER_CHORDS_AS_PLAYED', id });
    expect(names(next)).toEqual(['D', 'G', 'C']);
  });

  it('is no edit when they are already in that order', () => {
    const { store, id } = song();
    expect(songsReducer(store, { type: 'ORDER_CHORDS_AS_PLAYED', id })).toBe(store);
  });

  it('hands back the same list when nothing moves', () => {
    const chords = [{ id: 'a', spec: spec('A') }];
    const words = tokenise('la');
    expect(orderByFirstUse({ chords, words, placements: { [words[0].id]: 'a' } })).toBe(chords);
  });
});
