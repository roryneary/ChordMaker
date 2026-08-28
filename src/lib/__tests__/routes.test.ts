import { describe, expect, it } from 'vitest';
import { LANDING, replaceTop, type Route } from '../../app/routes';

const song: Route = { name: 'song', songId: 's1' };
const other: Route = { name: 'song', songId: 's2' };
const words: Route = { name: 'words', songId: 's1' };
const editor: Route = { name: 'chordEditor', songId: 's1', chordId: null };

describe('replaceTop', () => {
  it('swaps the screen you are on for the next one', () => {
    expect(replaceTop([LANDING, words], song)).toEqual([LANDING, song]);
  });

  /* The chord editor saves back to the song it was opened from. Pushing that
     song on top of itself would leave Back apparently doing nothing. */
  it('pops onto the screen underneath rather than stacking it twice', () => {
    expect(replaceTop([LANDING, song, editor], song)).toEqual([LANDING, song]);
  });

  it('only counts the same song as the same screen', () => {
    expect(replaceTop([LANDING, other, editor], song)).toEqual([LANDING, other, song]);
  });

  it('leaves a one-screen stack with one screen', () => {
    expect(replaceTop([LANDING], song)).toEqual([song]);
  });
});
