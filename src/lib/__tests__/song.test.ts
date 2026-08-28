import { describe, expect, it } from 'vitest';
import {
  emptyStore,
  migrateV1,
  newSong,
  parseStore,
  serializeStore,
} from '../storage';
import { songsReducer } from '../../hooks/useSongs';
import { tokenise } from '../lyric';
import { emptySpec } from '../../hooks/useChordSpec';
import type { SongStore } from '../storage';

const spec = (name: string) => ({ ...emptySpec(), name });

const storeWithSong = (): { store: SongStore; id: string } => {
  const store = songsReducer(emptyStore(), { type: 'CREATE_SONG', title: 'Harbour Lights' });
  return { store, id: store.currentId! };
};

describe('the store', () => {
  it('opens a newly created song', () => {
    const { store, id } = storeWithSong();
    expect(store.songs).toHaveLength(1);
    expect(store.currentId).toBe(id);
    expect(store.songs[0].title).toBe('Harbour Lights');
  });

  it('keeps other songs when one is deleted, and reopens a survivor', () => {
    let store = songsReducer(emptyStore(), { type: 'CREATE_SONG', title: 'One' });
    store = songsReducer(store, { type: 'CREATE_SONG', title: 'Two' });
    const open = store.currentId!;

    store = songsReducer(store, { type: 'DELETE_SONG', id: open });
    expect(store.songs).toHaveLength(1);
    expect(store.songs[0].title).toBe('One');
    expect(store.currentId).toBe(store.songs[0].id);
  });

  it('round-trips through storage', () => {
    const { store } = storeWithSong();
    expect(parseStore(serializeStore(store))).toEqual(store);
  });

  it('yields nothing rather than throwing on unusable data', () => {
    expect(parseStore(null)).toBeNull();
    expect(parseStore('not json')).toBeNull();
    expect(parseStore('{"v":1,"songs":[]}')).toBeNull();
  });

  it('drops a corrupt song without losing the rest of the library', () => {
    const { store } = storeWithSong();
    const raw = JSON.parse(serializeStore(store)) as { songs: unknown[] };
    raw.songs.push({ notASong: true });

    const parsed = parseStore(JSON.stringify(raw));
    expect(parsed?.songs).toHaveLength(1);
  });
});

describe('chords', () => {
  it('adds, updates and removes in order', () => {
    const { id } = storeWithSong();
    let store = storeWithSong().store;

    store = songsReducer(store, { type: 'ADD_CHORD', id: store.currentId!, spec: spec('G') });
    store = songsReducer(store, { type: 'ADD_CHORD', id: store.currentId!, spec: spec('D') });
    expect(store.songs[0].chords.map((c) => c.spec.name)).toEqual(['G', 'D']);

    const first = store.songs[0].chords[0].id;
    store = songsReducer(store, {
      type: 'UPDATE_CHORD',
      id: store.currentId!,
      chordId: first,
      spec: spec('G7'),
    });
    expect(store.songs[0].chords[0].spec.name).toBe('G7');

    store = songsReducer(store, {
      type: 'REMOVE_CHORD',
      id: store.currentId!,
      chordId: first,
    });
    expect(store.songs[0].chords.map((c) => c.spec.name)).toEqual(['D']);
    void id;
  });

  it('drops placements for a chord that is removed', () => {
    let store = storeWithSong().store;
    const id = store.currentId!;

    store = songsReducer(store, { type: 'SET_LYRIC', id, lyric: 'the harbour lights' });
    store = songsReducer(store, { type: 'ADD_CHORD', id, spec: spec('G') });

    const chordId = store.songs[0].chords[0].id;
    const wordId = store.songs[0].words[1].id;
    store = songsReducer(store, { type: 'PLACE_CHORD', id, wordId, chordId });
    expect(store.songs[0].placements[wordId]).toBe(chordId);

    store = songsReducer(store, { type: 'REMOVE_CHORD', id, chordId });
    // A placement pointing at a chord that no longer exists would render blank.
    expect(store.songs[0].placements).toEqual({});
  });
});

describe('editing the lyric', () => {
  it('leaves placed chords attached to their words', () => {
    let store = storeWithSong().store;
    const id = store.currentId!;

    store = songsReducer(store, { type: 'SET_LYRIC', id, lyric: 'the lights are on' });
    store = songsReducer(store, { type: 'ADD_CHORD', id, spec: spec('G') });
    const chordId = store.songs[0].chords[0].id;
    const lights = store.songs[0].words.find((w) => w.text === 'lights')!;

    store = songsReducer(store, { type: 'PLACE_CHORD', id, wordId: lights.id, chordId });
    store = songsReducer(store, {
      type: 'SET_LYRIC',
      id,
      lyric: 'the harbour lights are on',
    });

    const after = store.songs[0];
    expect(after.words.find((w) => w.text === 'lights')?.id).toBe(lights.id);
    expect(after.placements[lights.id]).toBe(chordId);
  });
});

describe('migrating from v1', () => {
  it('wraps the single v1 song as the first entry of the library', () => {
    const v1 = JSON.stringify({
      v: 1,
      title: 'Harbour Lights',
      chords: [{ id: 'c1', spec: spec('G') }],
    });

    const store = migrateV1(v1)!;
    expect(store.songs).toHaveLength(1);
    expect(store.songs[0].title).toBe('Harbour Lights');
    expect(store.songs[0].chords[0].spec.name).toBe('G');
    expect(store.currentId).toBe(store.songs[0].id);
    // v1 had no lyric, key, feel or capo — the state a song is in pre-paste.
    expect(store.songs[0].lyric).toBe('');
    expect(store.songs[0].capo).toBeNull();
  });

  it('ignores anything that is not a v1 song, or is empty', () => {
    expect(migrateV1(null)).toBeNull();
    expect(migrateV1('not json')).toBeNull();
    expect(migrateV1(JSON.stringify({ v: 2, songs: [] }))).toBeNull();
    expect(migrateV1(JSON.stringify({ v: 1, title: '  ', chords: [] }))).toBeNull();
  });
});

describe('newSong', () => {
  it('starts empty but tokenises to nothing rather than undefined', () => {
    const song = newSong('Untitled');
    expect(song.words).toEqual([]);
    expect(tokenise(song.lyric)).toEqual([]);
    expect(song.placements).toEqual({});
  });
});
