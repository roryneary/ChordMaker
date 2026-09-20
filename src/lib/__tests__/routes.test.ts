import { describe, expect, it } from 'vitest';
import { LANDING, fromHash, replaceTop, toHash, type Route } from '../../app/routes';

const song: Route = { name: 'song', songId: 's1' };
const other: Route = { name: 'song', songId: 's2' };
const words: Route = { name: 'words', songId: 's1' };
const editor: Route = { name: 'chordEditor', songId: 's1', chordId: null };

describe('hashes', () => {
  it('survives the round trip for every screen', () => {
    const routes: Route[] = [
      LANDING,
      { name: 'library' },
      { name: 'songs' },
      { name: 'playlists' },
      { name: 'playlist', playlistId: 'p1' },
      { name: 'playlistAdd', playlistId: 'p1' },
      { name: 'shared' },
      { name: 'sharedSong', shareId: 'sh1' },
      { name: 'signIn' },
      song,
      words,
      editor,
      { name: 'chordEditor', songId: 's1', chordId: 'c1' },
      { name: 'fullScreen', songId: 's1' },
      { name: 'ready', songId: 's1' },
    ];
    for (const route of routes) expect(fromHash(toHash(route))).toEqual(route);
  });

  it('reads a chord route as belonging to its song', () => {
    expect(fromHash('#/chord/s1/new')).toEqual(editor);
    expect(fromHash('#/chord/s1/c1')).toEqual({
      name: 'chordEditor',
      songId: 's1',
      chordId: 'c1',
    });
  });

  /* "Just one chord" used to open the editor with no song, at #/chord/new/new,
     and save to a store nothing read. Every chord belongs to a song now, so a
     bookmark or a stale tab pointing there goes home instead of to an editor
     with nowhere to save. */
  it('sends the retired song-less editor home', () => {
    expect(fromHash('#/chord/new/new')).toEqual(LANDING);
    expect(fromHash('#/chord/new')).toEqual(LANDING);
    expect(fromHash('#/chord')).toEqual(LANDING);
  });

  it('tells the song list from a song, one letter apart', () => {
    expect(fromHash('#/songs')).toEqual({ name: 'songs' });
    expect(fromHash('#/song/s1')).toEqual(song);
    // A song whose id happens to be "songs" is still a song.
    expect(fromHash('#/song/songs')).toEqual({ name: 'song', songId: 'songs' });
  });

  it('tells the playlists from one playlist, the same way', () => {
    expect(fromHash('#/playlists')).toEqual({ name: 'playlists' });
    expect(fromHash('#/playlist/p1')).toEqual({ name: 'playlist', playlistId: 'p1' });
    expect(fromHash('#/playlist/playlists')).toEqual({
      name: 'playlist',
      playlistId: 'playlists',
    });
    // No id is no playlist: home, like any other hash that names nothing.
    expect(fromHash('#/playlist')).toEqual(LANDING);
  });

  /* `#/library` was taken — it is the chord library — so songs other people
     have shared live under `#/shared`, and a link sent to the band is
     `#/shared/{id}`. Those links are out in the world: this shape cannot change. */
  it('reads a link sent to the band as the shared song it names', () => {
    expect(fromHash('#/shared/7f3e-uuid')).toEqual({ name: 'sharedSong', shareId: '7f3e-uuid' });
    expect(fromHash('#/shared')).toEqual({ name: 'shared' });
    expect(fromHash('#/library')).toEqual({ name: 'library' });
  });

  it('goes home for anything it does not recognise', () => {
    expect(fromHash('')).toEqual(LANDING);
    expect(fromHash('#/nonsense')).toEqual(LANDING);
  });
});

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
