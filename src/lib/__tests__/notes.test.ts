import { describe, expect, it } from 'vitest';
import { MAX_NOTES, notesByWord, parseNotes, pruneNoteWords, songWideNotes } from '../notes';
import { emptyStore, parseStore, serializeStore } from '../storage';
import { parseSharedSong, songFromShare, toSharePayload, tooBigToSave } from '../sharedSong';
import { isBlankSong } from '../songSummary';
import { songsReducer } from '../../hooks/useSongs';
import { tokenise } from '../lyric';
import type { SongStore } from '../storage';
import type { SongNote } from '../../types/song';

/** A song with the words "strum it low / let it ring". */
function song(): { store: SongStore; id: string } {
  let store = songsReducer(emptyStore(), { type: 'CREATE_SONG', title: 'Low Tide' });
  const id = store.currentId!;
  store = songsReducer(store, { type: 'SET_LYRIC', id, lyric: 'strum it low\nlet it ring' });
  return { store, id };
}

const add = (store: SongStore, id: string, note: SongNote) =>
  songsReducer(store, { type: 'ADD_NOTE', id, note });

const notesOf = (store: SongStore) => store.songs[0].notes;

describe('notes on a song', () => {
  it('adds a note about the whole song, and one on a word', () => {
    const { store, id } = song();
    const word = store.songs[0].words[3];
    let next = add(store, id, { id: 'n1', kind: 'strum', text: ' D DU UDU ' });
    next = add(next, id, { id: 'n2', kind: 'general', text: 'Quiet here', wordId: word.id });
    expect(notesOf(next)).toEqual([
      { id: 'n1', kind: 'strum', text: 'D DU UDU' },
      { id: 'n2', kind: 'general', text: 'Quiet here', wordId: word.id },
    ]);
    expect(next.unsynced).toContain(id);
  });

  it('refuses a note with nothing in it', () => {
    const { store, id } = song();
    expect(add(store, id, { id: 'n1', kind: 'general', text: '   ' })).toBe(store);
  });

  it('edits a note, and saving it unchanged is no edit', () => {
    const { store, id } = song();
    const withNote = add(store, id, { id: 'n1', kind: 'general', text: 'Palm mute' });
    const edited = songsReducer(withNote, {
      type: 'UPDATE_NOTE',
      id,
      noteId: 'n1',
      text: 'Palm mute the verses',
    });
    expect(notesOf(edited)?.[0].text).toBe('Palm mute the verses');
    expect(
      songsReducer(edited, { type: 'UPDATE_NOTE', id, noteId: 'n1', text: 'Palm mute the verses ' }),
    ).toBe(edited);
  });

  /* An empty list is never stored: absent is the one way of having none. */
  it('removes a note, and the list with the last one', () => {
    const { store, id } = song();
    const withNote = add(store, id, { id: 'n1', kind: 'picking', text: 'T-3-2-3' });
    const gone = songsReducer(withNote, { type: 'REMOVE_NOTE', id, noteId: 'n1' });
    expect('notes' in gone.songs[0]).toBe(false);
    // Rubbing a note out is removing it.
    const rubbed = songsReducer(withNote, { type: 'UPDATE_NOTE', id, noteId: 'n1', text: '' });
    expect('notes' in rubbed.songs[0]).toBe(false);
  });

  /* A chord placement is a pointer and goes with its word. A note is something
     somebody wrote, so it stays — about the whole song now. */
  it('keeps a note whose word is edited out, as one about the whole song', () => {
    const { store, id } = song();
    const words = store.songs[0].words;
    let next = add(store, id, { id: 'n1', kind: 'general', text: 'Softly', wordId: words[5].id });
    next = add(next, id, { id: 'n2', kind: 'general', text: 'Build', wordId: words[0].id });
    next = songsReducer(next, { type: 'SET_LYRIC', id, lyric: 'strum it low\nlet it go' });
    expect(notesOf(next)).toEqual([
      { id: 'n1', kind: 'general', text: 'Softly' },
      { id: 'n2', kind: 'general', text: 'Build', wordId: words[0].id },
    ]);
  });

  it('keeps a note on a word that survives the edit where it was', () => {
    const { store, id } = song();
    const word = store.songs[0].words[0];
    let next = add(store, id, { id: 'n1', kind: 'general', text: 'Build', wordId: word.id });
    next = songsReducer(next, { type: 'SET_LYRIC', id, lyric: 'strum it low\n\nlet it ring' });
    expect(notesOf(next)?.[0].wordId).toBe(word.id);
  });

  it('counts a note as something in the song, so backing out does not bin it', () => {
    const { store, id } = song();
    const blank = { ...store.songs[0], title: '', lyric: '', words: [] };
    expect(isBlankSong(blank)).toBe(true);
    const noted = add(store, id, { id: 'n1', kind: 'general', text: 'Capo 2 on the live one' });
    expect(isBlankSong({ ...noted.songs[0], title: '', lyric: '', words: [] })).toBe(false);
  });

  it('survives a trip through storage', () => {
    const { store, id } = song();
    const noted = add(store, id, { id: 'n1', kind: 'strum', text: 'D DU UDU' });
    expect(parseStore(serializeStore(noted))).toEqual(noted);
  });
});

describe('reading notes back', () => {
  it('drops what is malformed or empty, and nothing else', () => {
    expect(
      parseNotes([
        { id: 'a', kind: 'strum', text: 'D DU' },
        { id: 'b', kind: 'odd', text: 'kept as general' },
        { id: 'c', kind: 'general', text: '  ' },
        { kind: 'general', text: 'no id' },
        'nonsense',
        { id: 'd', kind: 'picking', text: 'T-3', wordId: 'w1' },
      ]),
    ).toEqual([
      { id: 'a', kind: 'strum', text: 'D DU' },
      { id: 'b', kind: 'general', text: 'kept as general' },
      { id: 'd', kind: 'picking', text: 'T-3', wordId: 'w1' },
    ]);
    expect(parseNotes(undefined)).toEqual([]);
  });

  it('hands back the same list when every word survived', () => {
    const words = tokenise('one two');
    const notes: SongNote[] = [{ id: 'n', kind: 'general', text: 'x', wordId: words[0].id }];
    expect(pruneNoteWords(notes, words)).toBe(notes);
  });

  it('groups by word, and puts the whole-song ones general first', () => {
    const notes: SongNote[] = [
      { id: 'p', kind: 'picking', text: 'T-3' },
      { id: 'w', kind: 'general', text: 'here', wordId: 'w1' },
      { id: 's', kind: 'strum', text: 'D DU' },
      { id: 'g', kind: 'general', text: 'gently' },
    ];
    expect(songWideNotes(notes).map((n) => n.id)).toEqual(['g', 's', 'p']);
    expect(notesByWord(notes).get('w1')?.map((n) => n.id)).toEqual(['w']);
  });
});

describe('notes travelling with a shared song', () => {
  it('go with it, and arrive on the copy', () => {
    const { store, id } = song();
    const noted = add(store, id, { id: 'n1', kind: 'strum', text: 'D DU UDU' }).songs[0];
    const payload = toSharePayload(noted);
    expect(payload.notes).toEqual([{ id: 'n1', kind: 'strum', text: 'D DU UDU' }]);

    const shared = parseSharedSong('share-1', {
      ownerUid: 'u',
      handle: 'rory',
      display: 'Rory',
      songId: noted.id,
      version: 1,
      song: payload,
      publishedAt: 1,
      updatedAt: 1,
    });
    expect(shared && songFromShare(shared, 'mine').notes).toEqual(payload.notes);
  });

  it('are left off a song that has none', () => {
    expect('notes' in toSharePayload(song().store.songs[0])).toBe(false);
  });

  it('say so before the account refuses too many', () => {
    const notes = Array.from({ length: MAX_NOTES + 1 }, (_, i) => ({
      id: `n${i}`,
      kind: 'general' as const,
      text: 'x',
    }));
    expect(tooBigToSave({ ...song().store.songs[0], notes })).toMatch(/more notes/);
  });
});
