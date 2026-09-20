import { describe, expect, it } from 'vitest';
import { bumpRecent, parseRecent, recentSongs } from '../recent';
import { newSong } from '../storage';
import type { Song } from '../../types/song';

const song = (id: string, updatedAt: number): Song => ({ ...newSong(id), id, updatedAt });

describe('bumpRecent', () => {
  it('puts the song at the front', () => {
    expect(bumpRecent(['a', 'b'], 'c')).toEqual(['c', 'a', 'b']);
  });

  it('moves a song already in the list, rather than listing it twice', () => {
    expect(bumpRecent(['a', 'b', 'c'], 'c')).toEqual(['c', 'a', 'b']);
  });

  it('hands back the same list when the song is already first', () => {
    // The hook saves whenever the list changes, and this is every re-render
    // of an open song.
    const recent = ['a', 'b'];
    expect(bumpRecent(recent, 'a')).toBe(recent);
  });

  it('does not grow without limit', () => {
    let recent: readonly string[] = [];
    for (let i = 0; i < 100; i++) recent = bumpRecent(recent, `s${i}`);
    expect(recent.length).toBeLessThan(100);
    expect(recent[0]).toBe('s99');
  });
});

describe('recentSongs', () => {
  const songs = [song('old', 1), song('newest', 30), song('middle', 20)];

  it('leads with what was opened last, in that order', () => {
    expect(recentSongs(songs, ['old', 'middle'], 2).map((s) => s.id)).toEqual(['old', 'middle']);
  });

  it('fills up with the latest edits when not enough has been opened', () => {
    expect(recentSongs(songs, ['old'], 3).map((s) => s.id)).toEqual(['old', 'newest', 'middle']);
  });

  it('is the latest edits for someone who has opened nothing', () => {
    expect(recentSongs(songs, [], 2).map((s) => s.id)).toEqual(['newest', 'middle']);
  });

  it('skips a song that is gone', () => {
    expect(recentSongs(songs, ['deleted', 'old'], 1).map((s) => s.id)).toEqual(['old']);
  });

  it('shows a song once even if the stored list names it twice', () => {
    expect(recentSongs(songs, ['old', 'old'], 3).map((s) => s.id)).toEqual([
      'old',
      'newest',
      'middle',
    ]);
  });

  it('leaves the songs it was given in the order they were in', () => {
    const before = songs.map((s) => s.id);
    recentSongs(songs, [], 3);
    expect(songs.map((s) => s.id)).toEqual(before);
  });
});

describe('parseRecent', () => {
  it('reads back a list of ids', () => {
    expect(parseRecent('["a","b"]')).toEqual(['a', 'b']);
  });

  it('is empty for nothing, for rubbish, and for the wrong shape', () => {
    expect(parseRecent(null)).toEqual([]);
    expect(parseRecent('{not json')).toEqual([]);
    expect(parseRecent('{"a":1}')).toEqual([]);
  });

  it('drops anything that is not an id', () => {
    expect(parseRecent('["a",3,null,"b"]')).toEqual(['a', 'b']);
  });
});
