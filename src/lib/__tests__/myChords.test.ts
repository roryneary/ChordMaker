import { describe, expect, it } from 'vitest';
import { songsReducer } from '../../hooks/useSongs';
import { LIBRARY, findLibraryChord, libraryChordToSpec } from '../../data/chordLibrary';
import {
  MAX_CHORD_NAME,
  collapseByShape,
  findMine,
  isBuiltIn,
  keepOffer,
  matchesChordQuery,
  newMyChord,
  shapeKey,
} from '../myChords';
import { shapeToSpec, specToShape } from '../shape';
import { type SongStore, emptyStore, parseMyChord, parseStore, serializeStore } from '../storage';
import type { ChordSpec, StringMarker } from '../../types/chord';
import type { MyChord } from '../../types/myChord';

const NONE: StringMarker[] = ['none', 'none', 'none', 'none', 'none', 'none'];

/** Shapes that are not in the built-in library. */
const high = (name = 'G high'): ChordSpec => shapeToSpec(name, 'xx5433');
const other = (name = 'A thing'): ChordSpec => shapeToSpec(name, 'x07650');

const lib = (name: string): ChordSpec => libraryChordToSpec(findLibraryChord(name)!);

/** B, drawn the way a player who thinks in barres draws it: two of them. */
const bWithTwoBarres = (): ChordSpec => ({
  name: 'B',
  rootFret: 2,
  fretCount: 5,
  markers: ['none', 'none', 'none', 'none', 'none', 'muted'],
  dots: [],
  barres: [
    { fret: 1, fromString: 5, toString: 1 },
    { fret: 3, fromString: 4, toString: 2 },
  ],
});

const kept = (spec: ChordSpec, id: string, createdAt = 1): MyChord => ({
  id,
  spec,
  createdAt,
  updatedAt: createdAt,
});

describe('the key of a shape', () => {
  it('gives one key to a shape wherever its window sits', () => {
    const atFour: ChordSpec = {
      name: 'C♯',
      rootFret: 4,
      fretCount: 5,
      markers: ['none', 'none', 'none', 'none', 'none', 'muted'],
      dots: [
        { string: 5, fret: 1 },
        { string: 4, fret: 3 },
        { string: 3, fret: 3 },
        { string: 2, fret: 3 },
        { string: 1, fret: 1 },
      ],
      barres: [],
    };
    const atThree: ChordSpec = {
      ...atFour,
      rootFret: 3,
      dots: atFour.dots.map((d) => ({ ...d, fret: d.fret + 1 })),
    };
    expect(shapeKey(atThree)).toBe(shapeKey(atFour));
  });

  it('gives a barre and the same strings fretted one by one the same key', () => {
    const barred: ChordSpec = {
      name: 'F',
      rootFret: 1,
      fretCount: 5,
      markers: NONE,
      dots: [
        { string: 5, fret: 3 },
        { string: 4, fret: 3 },
        { string: 3, fret: 2 },
      ],
      barres: [{ fret: 1, fromString: 6, toString: 1 }],
    };
    const dotted: ChordSpec = {
      ...barred,
      barres: [],
      dots: [
        ...barred.dots,
        { string: 6, fret: 1 },
        { string: 2, fret: 1 },
        { string: 1, fret: 1 },
      ],
    };
    expect(shapeKey(dotted)).toBe(shapeKey(barred));
  });

  it('gives a shape drawn with two barres the key of the same shape drawn with dots', () => {
    // The compact notation has nothing to say about two barres, which is why
    // the key cannot be built on it: this is B, and B is built in.
    expect(specToShape(bWithTwoBarres())).toBeNull();
    expect(shapeKey(bWithTwoBarres())).toBe(shapeKey(lib('B')));
    expect(isBuiltIn(bWithTwoBarres())).toBe(true);
  });

  it('agrees with the compact notation wherever that can speak', () => {
    for (const chord of LIBRARY) {
      const spec = libraryChordToSpec(chord);
      expect(shapeKey(spec).split('.').join('')).toBe(specToShape(spec));
    }
  });

  it('tells an unset string from an open one and a muted one', () => {
    const spec = (marker: StringMarker): ChordSpec => ({
      ...high(),
      markers: ['none', 'none', 'none', 'none', marker, 'muted'],
    });
    const keys = new Set([shapeKey(spec('none')), shapeKey(spec('open')), shapeKey(spec('muted'))]);
    expect(keys.size).toBe(3);
  });

  it('ignores the name', () => {
    expect(shapeKey(high('One name'))).toBe(shapeKey(high('Another')));
  });

  it('knows every built-in shape, and that no two share a key', () => {
    const keys = LIBRARY.map((c) => shapeKey(libraryChordToSpec(c)));
    expect(new Set(keys).size).toBe(LIBRARY.length);
    for (const chord of LIBRARY) expect(isBuiltIn(libraryChordToSpec(chord))).toBe(true);
    expect(isBuiltIn(high())).toBe(false);
  });
});

describe('whether a shape can be kept', () => {
  it('will not offer to keep nothing, a built-in shape, or one already kept', () => {
    const mine = [kept(high(), 'a')];
    expect(keepOffer(mine, { ...high(), dots: [], barres: [] })).toBe('empty');
    expect(keepOffer(mine, lib('Em'))).toBe('builtIn');
    expect(keepOffer(mine, high('Under another name'))).toBe('mine');
    expect(keepOffer(mine, other())).toBe('offer');
  });

  it('lets a chord being edited keep its own shape', () => {
    const mine = [kept(high(), 'a'), kept(other(), 'b')];
    expect(keepOffer(mine, high('Renamed'), 'a')).toBe('offer');
    // But not take the shape of the one beside it.
    expect(keepOffer(mine, other(), 'a')).toBe('mine');
    expect(findMine(mine, other(), 'a')?.id).toBe('b');
  });

  it('keeps the older of two alike, and names the other', () => {
    const { kept: left, dropped } = collapseByShape([
      kept(high(), 'newer', 20),
      kept(other(), 'alone', 5),
      kept(high('Same shape'), 'older', 10),
    ]);
    expect(left.map((c) => c.id)).toEqual(['alone', 'older']);
    expect(dropped).toEqual(['newer']);
  });

  it('breaks a tie the same way whichever order the two arrive in', () => {
    const a = kept(high(), 'a', 10);
    const b = kept(high(), 'b', 10);
    expect(collapseByShape([a, b]).dropped).toEqual(['b']);
    expect(collapseByShape([b, a]).dropped).toEqual(['b']);
  });

  it('trims a name and holds it to what the account will take', () => {
    const chord = newMyChord(high(`  ${'x'.repeat(MAX_CHORD_NAME + 20)}  `));
    expect(chord.spec.name).toHaveLength(MAX_CHORD_NAME);
  });

  it('finds a flat or a sharp typed the way people type them', () => {
    expect(matchesChordQuery('B♭', 'bb')).toBe(true);
    expect(matchesChordQuery('F♯m7', 'f#m')).toBe(true);
    expect(matchesChordQuery('G', '  ')).toBe(true);
    expect(matchesChordQuery('G', 'am')).toBe(false);
  });
});

describe('reading a chord back', () => {
  it('reads one of my chords', () => {
    const chord = kept(high(), 'a', 7);
    expect(parseMyChord(JSON.parse(JSON.stringify(chord)))).toEqual(chord);
  });

  it('does not read a chord saved without its stamps', () => {
    // STRICT ON PURPOSE, unlike parseSong and parsePlaylist. The retired
    // loose-chord store wrote bare { id, spec } to the path My chords syncs to,
    // and those shapes already live in a "Loose chords" song. Defaulting the
    // stamps would bring every one of them back as a duplicate.
    expect(parseMyChord({ id: 'old', spec: high() })).toBeNull();
    expect(parseMyChord({ id: 'old', spec: high(), createdAt: 1 })).toBeNull();
    expect(parseMyChord(null)).toBeNull();
  });
});

/** A store with two kept chords, as if the account had confirmed both. */
function setUp(): SongStore {
  let store: SongStore = emptyStore();
  store = songsReducer(store, { type: 'KEEP_CHORD', spec: high(), id: 'a' });
  store = songsReducer(store, { type: 'KEEP_CHORD', spec: other(), id: 'b' });
  return { ...store, unsyncedChords: [] };
}

describe('my chords in the reducer', () => {
  it('keeps a chord, and lists it as unconfirmed', () => {
    const store = songsReducer(emptyStore(), { type: 'KEEP_CHORD', spec: high(), id: 'a' });
    expect(store.chords.map((c) => c.id)).toEqual(['a']);
    expect(store.unsyncedChords).toEqual(['a']);
  });

  it('refuses a chord with no name, no shape, a built-in shape, or a shape already kept', () => {
    const store = setUp();
    const tries: ChordSpec[] = [
      high('   '),
      { ...other('Nothing'), dots: [], barres: [] },
      lib('G'),
      bWithTwoBarres(),
      high('Again'),
    ];
    for (const spec of tries) {
      expect(songsReducer(store, { type: 'KEEP_CHORD', spec })).toBe(store);
    }
  });

  it('keeps a second voicing under the same name', () => {
    // Sameness is the shape, not the name: two voicings of G are both "G".
    const store = songsReducer(setUp(), {
      type: 'KEEP_CHORD',
      spec: shapeToSpec('G high', 'xx5787'),
      id: 'c',
    });
    expect(store.chords.filter((c) => c.spec.name === 'G high').map((c) => c.id)).toEqual([
      'c',
      'a',
    ]);
  });

  it('renames a kept chord, and refuses to reshape it into one already there', () => {
    const store = setUp();
    const renamed = songsReducer(store, { type: 'UPDATE_MY_CHORD', id: 'a', spec: high('New name') });
    expect(renamed.chords.find((c) => c.id === 'a')?.spec.name).toBe('New name');
    expect(renamed.unsyncedChords).toEqual(['a']);

    expect(songsReducer(store, { type: 'UPDATE_MY_CHORD', id: 'a', spec: other() })).toBe(store);
    expect(songsReducer(store, { type: 'UPDATE_MY_CHORD', id: 'a', spec: lib('C') })).toBe(store);
  });

  it('treats saving a kept chord unchanged as no edit', () => {
    const store = setUp();
    expect(songsReducer(store, { type: 'UPDATE_MY_CHORD', id: 'a', spec: high() })).toBe(store);
  });

  it('deletes a kept chord without touching any song that uses the shape', () => {
    let store = setUp();
    store = songsReducer(store, { type: 'CREATE_SONG', title: 'Song', id: 's' });
    store = songsReducer(store, { type: 'ADD_CHORD', id: 's', spec: high() });
    const song = store.songs[0];

    store = songsReducer(store, { type: 'DELETE_MY_CHORD', id: 'a' });
    expect(store.chords.map((c) => c.id)).toEqual(['b']);
    expect(store.unsyncedChords).toEqual(['a']);
    expect(store.songs[0]).toBe(song);
  });

  it('leaves my chords alone when a song or one of its chords is deleted', () => {
    let store = setUp();
    store = songsReducer(store, { type: 'CREATE_SONG', title: 'Song', id: 's' });
    store = songsReducer(store, { type: 'ADD_CHORD', id: 's', spec: high(), chordId: 'in-song' });
    const mine = store.chords;

    store = songsReducer(store, { type: 'REMOVE_CHORD', id: 's', chordId: 'in-song' });
    expect(store.chords).toBe(mine);
    store = songsReducer(store, { type: 'DELETE_SONG', id: 's' });
    expect(store.chords).toBe(mine);
    expect(store.unsyncedChords).toEqual([]);
  });

  it('strikes a chord off only for the version the account confirmed', () => {
    let store = songsReducer(emptyStore(), { type: 'KEEP_CHORD', spec: high(), id: 'a' });
    const sent = store.chords[0].updatedAt;
    store = songsReducer(store, { type: 'UPDATE_MY_CHORD', id: 'a', spec: high('Renamed') });

    // The confirmation of the first write arrives after the rename.
    store = songsReducer(store, { type: 'MY_CHORD_SYNCED', id: 'a', updatedAt: sent });
    expect(store.unsyncedChords).toEqual(['a']);

    store = songsReducer(store, {
      type: 'MY_CHORD_SYNCED',
      id: 'a',
      updatedAt: store.chords[0].updatedAt,
    });
    expect(store.unsyncedChords).toEqual([]);
  });
});

describe('my chords across a sign-in', () => {
  it('leaves my chords alone when the account sent none to merge', () => {
    const store = { ...setUp(), unsyncedChords: ['a'] };
    const after = songsReducer(store, { type: 'HYDRATE', remote: [], allowPush: true });
    expect(after.chords).toBe(store.chords);
    expect(after.unsyncedChords).toBe(store.unsyncedChords);
  });

  it('pushes a chord the account has never seen', () => {
    const store = { ...setUp(), unsyncedChords: ['a', 'b'] };
    const after = songsReducer(store, {
      type: 'HYDRATE',
      remote: [],
      allowPush: true,
      remoteChords: [],
    });
    expect(after.chords.map((c) => c.id).sort()).toEqual(['a', 'b']);
    expect([...after.unsyncedChords].sort()).toEqual(['a', 'b']);
  });

  it('takes in a chord kept on another device', () => {
    const after = songsReducer(setUp(), {
      type: 'HYDRATE',
      remote: [],
      allowPush: true,
      remoteChords: [
        ...setUp().chords,
        kept(shapeToSpec('Elsewhere', 'xx5787'), 'remote', 99),
      ],
    });
    expect(after.chords.map((c) => c.id)).toContain('remote');
    expect(after.unsyncedChords).not.toContain('remote');
  });

  it('collapses the same shape kept on two devices into the older, and deletes the other', () => {
    // Kept here, offline, a moment ago; kept on the laptop last week.
    let store = songsReducer(emptyStore(), { type: 'KEEP_CHORD', spec: high(), id: 'phone' });
    const laptop = kept(high('G up the neck'), 'laptop', 1);
    store = songsReducer(store, {
      type: 'HYDRATE',
      remote: [],
      allowPush: true,
      remoteChords: [laptop],
    });
    expect(store.chords).toEqual([laptop]);
    // 'phone' has nothing behind it now, which is how a delete is spelled.
    expect(store.unsyncedChords).toEqual(['phone']);
  });

  it('replaces my chords with a different account\'s, and restores its own', () => {
    const theirs = kept(shapeToSpec('Theirs', 'xx5787'), 'theirs', 3);
    const mineBefore = kept(shapeToSpec('Set aside', 'x07655'), 'stashed', 2);
    const after = songsReducer(setUp(), {
      type: 'HYDRATE',
      remote: [],
      allowPush: false,
      remoteChords: [theirs],
      restoredChords: [mineBefore],
    });
    expect(after.chords.map((c) => c.id).sort()).toEqual(['stashed', 'theirs']);
    expect(after.unsyncedChords).toEqual(['stashed']);
  });
});

describe('my chords in storage', () => {
  it('round-trips with the songs', () => {
    const store = { ...setUp(), unsyncedChords: ['b'] };
    expect(parseStore(serializeStore(store))).toEqual(store);
  });

  it('reads a store saved before my chords existed as having none', () => {
    const store = parseStore(JSON.stringify({ v: 2, songs: [], currentId: null }));
    expect(store?.chords).toEqual([]);
    expect(store?.unsyncedChords).toEqual([]);
  });

  it('drops a kept chord it cannot read rather than the whole library', () => {
    const raw = JSON.parse(serializeStore(setUp())) as { chords: unknown[] };
    raw.chords.push({ id: 'old', spec: high() }, 'rubbish');
    expect(parseStore(JSON.stringify(raw))?.chords.map((c) => c.id)).toEqual(['b', 'a']);
  });
});
