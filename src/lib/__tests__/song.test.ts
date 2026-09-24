import { describe, expect, it } from 'vitest';
import {
  LOOSE_CHORDS_TITLE,
  adoptLooseChords,
  emptyStore,
  looseChordsToSong,
  migrateV1,
  newSong,
  parseStore,
  serializeStore,
} from '../storage';
import { songsReducer } from '../../hooks/useSongs';
import { tokenise } from '../lyric';
import { emptySpec } from '../../hooks/useChordSpec';
import { MAX_ROOT_FRET } from '../layout';
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

  it('pulls a chord back onto the neck rather than dropping it', () => {
    /* rootFret decides whether a nut is drawn and how wide the box is, so an
       off-neck value would render a diagram with no nut and a numeral for a
       fret that does not exist. The shape is still the player's work. */
    const { store, id } = storeWithSong();
    const withChord = songsReducer(store, {
      type: 'ADD_CHORD',
      id,
      spec: { ...spec('B'), rootFret: 99 },
    });
    const parsed = parseStore(serializeStore(withChord));
    expect(parsed?.songs[0].chords).toHaveLength(1);
    expect(parsed?.songs[0].chords[0].spec.rootFret).toBe(MAX_ROOT_FRET);
  });
});

/* A start card makes its song on the tap. Backed out of untouched, it would be
   an "Untitled" with nothing in it, in Songs and on the account. */
describe('walking away from a song with nothing in it', () => {
  const blank = (): { store: SongStore; id: string } => {
    const kept = songsReducer(emptyStore(), { type: 'CREATE_SONG', title: 'Kept' });
    const store = songsReducer(kept, { type: 'CREATE_SONG', title: '' });
    return { store, id: store.currentId! };
  };
  const discard = (store: SongStore, id: string) =>
    songsReducer(store, { type: 'DISCARD_IF_BLANK', id });

  it('throws it away, as a delete the account hears about', () => {
    const { store, id } = blank();
    const after = discard(store, id);
    expect(after.songs.map((s) => s.title)).toEqual(['Kept']);
    expect(after.currentId).toBe(after.songs[0].id);
    expect(after.unsynced).toContain(id);
  });

  it('counts a name of spaces, and words of blank lines, as nothing', () => {
    const { store, id } = blank();
    let spaced = songsReducer(store, { type: 'SET_TITLE', id, title: '  ' });
    spaced = songsReducer(spaced, { type: 'SET_LYRIC', id, lyric: '\n \n' });
    spaced = songsReducer(spaced, { type: 'SET_CAPO', id, capo: 2 });
    expect(discard(spaced, id).songs).toHaveLength(1);
  });

  it('keeps a song with a name, or words, or a chord', () => {
    const { store, id } = blank();
    const edits = [
      songsReducer(store, { type: 'SET_TITLE', id, title: 'Harbour Lights' }),
      songsReducer(store, { type: 'SET_LYRIC', id, lyric: 'Down by the water' }),
      songsReducer(store, { type: 'ADD_CHORD', id, spec: spec('G') }),
    ];
    for (const edited of edits) expect(discard(edited, id)).toBe(edited);
  });

  it('leaves alone one that is in a playlist, or shared', () => {
    const { store, id } = blank();
    const listed = songsReducer(store, { type: 'CREATE_PLAYLIST', name: 'Friday', songIds: [id] });
    expect(discard(listed, id)).toBe(listed);

    const shared = songsReducer(store, {
      type: 'SONG_SHARED',
      id,
      shareId: 'sh1',
      version: 1,
      listed: false,
      sentUpdatedAt: null,
    });
    expect(discard(shared, id)).toBe(shared);
  });

  it('does nothing for a song that is not there', () => {
    const { store } = blank();
    expect(discard(store, 'gone')).toBe(store);
  });
});

/**
 * The list of ids the account has not confirmed. It is kept by the reducer so
 * that recording a change is atomic with making it, and it is what stops an
 * edit made with no signal being reverted by "remote wins" at the next load.
 */
describe('what the account has not confirmed', () => {
  it('lists a song from the moment it is created, and once only', () => {
    const { store, id } = storeWithSong();
    expect(store.unsynced).toEqual([id]);

    const edited = songsReducer(store, { type: 'SET_TITLE', id, title: 'Harbour Lights II' });
    expect(edited.unsynced).toEqual([id]);
  });

  it('is cleared by the confirmation of the version that was sent', () => {
    const { store, id } = storeWithSong();
    const sent = store.songs[0].updatedAt;
    const confirmed = songsReducer(store, { type: 'SYNCED', id, updatedAt: sent });
    expect(confirmed.unsynced).toEqual([]);
    // And it survives the trip through storage either way.
    expect(parseStore(serializeStore(store))!.unsynced).toEqual([id]);
    expect(parseStore(serializeStore(confirmed))!.unsynced).toEqual([]);
  });

  it('stays listed when the song was edited while that write was in flight', () => {
    const { store, id } = storeWithSong();
    const sent = store.songs[0].updatedAt;
    const editedMeanwhile = songsReducer(store, { type: 'SET_TITLE', id, title: 'Newer' });
    // Same millisecond or not, the stamp has moved on.
    expect(editedMeanwhile.songs[0].updatedAt).toBeGreaterThan(sent);

    const after = songsReducer(editedMeanwhile, { type: 'SYNCED', id, updatedAt: sent });
    expect(after).toBe(editedMeanwhile);
    expect(after.unsynced).toEqual([id]);
  });

  it('keeps a deleted song listed until the account confirms the delete', () => {
    const { store, id } = storeWithSong();
    const synced = songsReducer(store, { type: 'SYNCED', id, updatedAt: store.songs[0].updatedAt });
    const deleted = songsReducer(synced, { type: 'DELETE_SONG', id });
    expect(deleted.songs).toEqual([]);
    expect(deleted.unsynced).toEqual([id]);

    // A write confirmation for it is not the delete's confirmation.
    expect(songsReducer(deleted, { type: 'SYNCED', id, updatedAt: 123 }).unsynced).toEqual([id]);
    expect(songsReducer(deleted, { type: 'SYNCED', id, updatedAt: null }).unsynced).toEqual([]);
  });

  it('reads a store saved before the list existed as fully confirmed', () => {
    const { store } = storeWithSong();
    const raw = JSON.parse(serializeStore(store)) as { unsynced?: unknown };
    delete raw.unsynced;
    expect(parseStore(JSON.stringify(raw))!.unsynced).toEqual([]);
  });
});

describe("the account's library arriving", () => {
  it('merges against the store as it is now, keeping a song made while it was loading', () => {
    const remote = newSong('From the account');
    const { store, id } = storeWithSong(); // made a moment before the fetch returned

    const after = songsReducer(store, { type: 'HYDRATE', remote: [remote], allowPush: true });
    expect(after.songs.map((s) => s.id).sort()).toEqual([remote.id, id].sort());
    // The new one still has to go up; the account's own copy does not.
    expect(after.unsynced).toEqual([id]);
  });

  it("keeps an edit the account never confirmed, and takes the account's copy otherwise", () => {
    let store = storeWithSong().store;
    const id = store.currentId!;
    const remoteCopy = { ...store.songs[0], title: 'Older copy on the account' };

    // Unconfirmed: local wins and stays listed.
    let after = songsReducer(store, { type: 'HYDRATE', remote: [remoteCopy], allowPush: true });
    expect(after.songs[0].title).toBe('Harbour Lights');
    expect(after.unsynced).toEqual([id]);

    // Confirmed: nothing local to protect, so the account's copy wins.
    store = songsReducer(store, { type: 'SYNCED', id, updatedAt: store.songs[0].updatedAt });
    after = songsReducer(store, { type: 'HYDRATE', remote: [remoteCopy], allowPush: true });
    expect(after.songs[0].title).toBe('Older copy on the account');
    expect(after.unsynced).toEqual([]);
  });

  it('does not bring back a song deleted with no signal', () => {
    const { store, id } = storeWithSong();
    const ghost = store.songs[0];
    const deleted = songsReducer(store, { type: 'DELETE_SONG', id });

    const after = songsReducer(deleted, { type: 'HYDRATE', remote: [ghost], allowPush: true });
    expect(after.songs).toEqual([]);
    expect(after.unsynced).toEqual([id]); // the delete still has to go up
  });

  it("replaces another account's library, and hands back work set aside earlier", () => {
    const { store } = storeWithSong(); // someone else's, left on this device
    const mine = newSong('Mine, on the account');
    const setAside = newSong('Mine, set aside last time');

    const after = songsReducer(store, {
      type: 'HYDRATE',
      remote: [mine],
      allowPush: false,
      restored: [setAside, mine],
    });
    expect(after.songs.map((s) => s.id).sort()).toEqual([mine.id, setAside.id].sort());
    // Only the restored song the account lacks needs writing up.
    expect(after.unsynced).toEqual([setAside.id]);
    expect(after.currentId).toBe(after.songs[0].id);
  });

  it('puts the most recently touched song first', () => {
    const older = { ...newSong('Older'), updatedAt: 1000 };
    const newer = { ...newSong('Newer'), updatedAt: 2000 };
    const after = songsReducer(emptyStore(), {
      type: 'HYDRATE',
      remote: [older, newer],
      allowPush: true,
    });
    expect(after.songs.map((s) => s.title)).toEqual(['Newer', 'Older']);
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

  /* The name is what gets printed over the word, so a nameless chord would be
     stored only to render as an em dash on the song screen and a gap on the
     sheet. The editor disables its save button too; this is the backstop. */
  it('refuses a chord with no name, and trims the one it keeps', () => {
    let store = storeWithSong().store;
    const id = store.currentId!;

    const before = store;
    store = songsReducer(store, { type: 'ADD_CHORD', id, spec: spec('') });
    store = songsReducer(store, { type: 'ADD_CHORD', id, spec: spec('   ') });
    expect(store).toBe(before);
    expect(store.songs[0].chords).toHaveLength(0);

    store = songsReducer(store, { type: 'ADD_CHORD', id, spec: spec('  Am  ') });
    expect(store.songs[0].chords[0].spec.name).toBe('Am');

    const only = store.songs[0].chords[0].id;
    const named = store;
    store = songsReducer(store, { type: 'UPDATE_CHORD', id, chordId: only, spec: spec(' ') });
    expect(store).toBe(named);
    expect(store.songs[0].chords[0].spec.name).toBe('Am');
  });

  it('treats saving a chord unchanged as no edit', () => {
    // A chord is opened just to tick "Keep in My chords". A new song object
    // would move `updatedAt`: a needless sync, and "changed" to everyone
    // holding a copy of a shared song.
    let store = storeWithSong().store;
    const id = store.currentId!;
    store = songsReducer(store, { type: 'ADD_CHORD', id, spec: spec('G'), chordId: 'c1' });
    const before = { ...store, unsynced: [] };

    const after = songsReducer(before, {
      type: 'UPDATE_CHORD',
      id,
      chordId: 'c1',
      spec: spec('  G '),
    });
    expect(after).toBe(before);
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
    // Unanswered, not "no capo": v1 never asked, so the app cannot claim either.
    expect(store.songs[0].capo).toBeUndefined();
  });

  it('ignores anything that is not a v1 song, or is empty', () => {
    expect(migrateV1(null)).toBeNull();
    expect(migrateV1('not json')).toBeNull();
    expect(migrateV1(JSON.stringify({ v: 2, songs: [] }))).toBeNull();
    expect(migrateV1(JSON.stringify({ v: 1, title: '  ', chords: [] }))).toBeNull();
  });
});

/**
 * "Just one chord" saved its shapes to a store of their own that no screen
 * ever read back. Everything is a song now; these were somebody's work, so
 * they become one rather than vanishing with the store that held them.
 */
describe('folding the loose chords', () => {
  const loose = JSON.stringify([
    { id: 'c1', spec: spec('G') },
    { id: 'c2', spec: spec('Bm7') },
  ]);

  it('keeps them as one song, in order, under a title that says what they are', () => {
    const song = looseChordsToSong(loose)!;
    expect(song.title).toBe(LOOSE_CHORDS_TITLE);
    expect(song.chords.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(song.chords.map((c) => c.spec.name)).toEqual(['G', 'Bm7']);
    expect(song.lyric).toBe('');
    // Nobody was ever asked about a capo for these.
    expect(song.capo).toBeUndefined();
  });

  it('makes no song out of nothing', () => {
    expect(looseChordsToSong(null)).toBeNull();
    expect(looseChordsToSong('not json')).toBeNull();
    // What the old hook wrote on every start, chords or no chords.
    expect(looseChordsToSong('[]')).toBeNull();
    expect(looseChordsToSong('[{"junk":1}]')).toBeNull();
    expect(looseChordsToSong('{"v":2}')).toBeNull();
  });

  it('pulls an off-neck shape back on, as the song store does', () => {
    const raw = JSON.stringify([{ id: 'c1', spec: { ...spec('B'), rootFret: 99 } }]);
    expect(looseChordsToSong(raw)!.chords[0].spec.rootFret).toBe(MAX_ROOT_FRET);
  });

  it('goes to the top of the library without taking over the open song', () => {
    const { store, id } = storeWithSong();
    const song = looseChordsToSong(loose)!;

    const after = adoptLooseChords(store, song);
    expect(after.songs.map((s) => s.id)).toEqual([song.id, id]);
    expect(after.currentId).toBe(id);
    // It is new to the account, like any other new song.
    expect(after.unsynced).toContain(song.id);
  });

  it('becomes the open song when there was none', () => {
    const song = looseChordsToSong(loose)!;
    expect(adoptLooseChords(emptyStore(), song).currentId).toBe(song.id);
  });
});

describe('the capo', () => {
  it('starts unanswered on a new song, so nothing has been decided for the player', () => {
    expect(newSong('Harbour Lights').capo).toBeUndefined();
  });

  it('keeps an explicit "no capo" apart from one nobody has been asked about', () => {
    const { store, id } = storeWithSong();
    const chosen = songsReducer(store, { type: 'SET_CAPO', id, capo: null });
    expect(chosen.songs[0].capo).toBeNull();

    // Both survive the round trip: a song saved before the question existed
    // carries capo: null and must keep reading as already decided.
    const back = parseStore(serializeStore(chosen))!;
    expect(back.songs[0].capo).toBeNull();
    expect(parseStore(serializeStore(store))!.songs[0].capo).toBeUndefined();
  });

  it('round-trips a fret, and refuses a shape it cannot read', () => {
    const { store, id } = storeWithSong();
    const capoed = songsReducer(store, { type: 'SET_CAPO', id, capo: 3 });
    expect(parseStore(serializeStore(capoed))!.songs[0].capo).toBe(3);

    const raw = JSON.parse(serializeStore(capoed)) as { songs: { capo: unknown }[] };
    raw.songs[0].capo = 'second';
    expect(parseStore(JSON.stringify(raw))!.songs[0].capo).toBeUndefined();
  });
});

describe('who plays it', () => {
  it('starts absent, so a song nobody has named is not a song by ""', () => {
    expect(newSong('Harbour Lights').artist).toBeUndefined();
    expect('artist' in newSong('Harbour Lights')).toBe(false);
  });

  it('keeps what is typed, and round-trips it', () => {
    const { store, id } = storeWithSong();
    const named = songsReducer(store, { type: 'SET_ARTIST', id, artist: 'The Harbour Band' });
    expect(named.songs[0].artist).toBe('The Harbour Band');
    expect(parseStore(serializeStore(named))!.songs[0].artist).toBe('The Harbour Band');
  });

  it('drops the field when it is rubbed out, rather than storing an empty name', () => {
    const { store, id } = storeWithSong();
    const named = songsReducer(store, { type: 'SET_ARTIST', id, artist: 'The Harbour Band' });
    const cleared = songsReducer(named, { type: 'SET_ARTIST', id, artist: '   ' });
    expect('artist' in cleared.songs[0]).toBe(false);
    expect('artist' in parseStore(serializeStore(cleared))!.songs[0]).toBe(false);
  });

  it('is quiet when the name did not change, so the account is not written to again', () => {
    const { store, id } = storeWithSong();
    const named = songsReducer(store, { type: 'SET_ARTIST', id, artist: 'Dylan' });
    const again = songsReducer(named, { type: 'SET_ARTIST', id, artist: 'Dylan' });
    expect(again).toBe(named);
    // And a song nobody has named is not touched by clearing what is not there.
    expect(songsReducer(store, { type: 'SET_ARTIST', id, artist: '' })).toBe(store);
  });

  it('reads a stored name of the wrong shape as nobody having said', () => {
    const { store, id } = storeWithSong();
    const named = songsReducer(store, { type: 'SET_ARTIST', id, artist: 'Dylan' });
    const raw = JSON.parse(serializeStore(named)) as { songs: { artist: unknown }[] };
    raw.songs[0].artist = 42;
    expect(parseStore(JSON.stringify(raw))!.songs[0].artist).toBeUndefined();
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
