import { describe, expect, it } from 'vitest';
import { chromeFor, libraryIsStep } from '../../components/shell/AppShell';
import { LANDING, type Route } from '../../app/routes';

const song: Route = { name: 'song', songId: 's1' };
const editor: Route = { name: 'chordEditor', songId: 's1', chordId: null };
const library: Route = { name: 'library' };
const full: Route = { name: 'fullScreen', songId: 's1' };
const allSongs: Route = { name: 'songs' };
const playlists: Route = { name: 'playlists' };
const playlist: Route = { name: 'playlist', playlistId: 'p1' };
const playlistAdd: Route = { name: 'playlistAdd', playlistId: 'p1' };

const mobile = (route: Route, previous?: Route) => chromeFor(route, false, previous);
const desktop = (route: Route, previous?: Route) => chromeFor(route, true, previous);

describe('which chrome a screen gets', () => {
  it('gives mobile browsing screens the tab bar', () => {
    expect(mobile(LANDING)).toBe('tabs');
    expect(mobile(library, LANDING)).toBe('tabs');
    // Songs is where a phone finds any song but the latest, so it has to be
    // somewhere you can get to, and away from, by the tabs.
    expect(mobile(allSongs)).toBe('tabs');
    expect(mobile(allSongs, LANDING)).toBe('tabs');
    expect(mobile(playlists)).toBe('tabs');
  });

  /* One playlist is a list you are reading, like the songs. Adding songs to it
     is a step with a Done of its own, and a tab bar there is a way to walk off
     with the ticks unsaved. */
  it('keeps the tabs on a playlist, and withholds them while adding to one', () => {
    expect(mobile(playlist, playlists)).toBe('tabs');
    expect(mobile(playlist, allSongs)).toBe('tabs');
    expect(mobile(playlistAdd, playlist)).toBe('none');
  });

  /* The shared songs are somewhere you browse; one of them is where a link
     lands, with one thing to do, and a tab bar under "Keep this song" is an
     invitation to wander off before doing it. */
  it('keeps the tabs on the shared songs, and withholds them from one', () => {
    expect(mobile({ name: 'shared' }, allSongs)).toBe('tabs');
    expect(mobile({ name: 'sharedSong', shareId: 'sh1' }, LANDING)).toBe('none');
    expect(desktop({ name: 'sharedSong', shareId: 'sh1' })).toBe('sidebar');
  });

  /* Opening the library from the song list is going somewhere, not pausing
     half-way through a song — without this it lost its tab bar and grew a
     Back button, because anything that was not the landing page counted as
     "inside an edit". */
  it('keeps the library a destination when it is reached from a browsing screen', () => {
    expect(mobile(library, allSongs)).toBe('tabs');
    expect(libraryIsStep(allSongs)).toBe(false);
    expect(libraryIsStep(playlists)).toBe(false);
    expect(libraryIsStep(playlist)).toBe(false);
  });

  /* While editing one song you are not navigating, and the tab bar competes
     with the screen's primary action. */
  it('withholds the tab bar from every editing screen', () => {
    expect(mobile(song)).toBe('none');
    expect(mobile(editor)).toBe('none');
    expect(mobile({ name: 'words', songId: 's1' })).toBe('none');
    expect(mobile({ name: 'ready', songId: 's1' })).toBe('none');
  });

  /* Making or editing one of My chords is editing, though no song is open. */
  it('withholds the tab bar from a chord of your own, and treats the library opened from it as a step', () => {
    const myChord: Route = { name: 'myChord', chordId: null };
    expect(mobile(myChord, { name: 'library' })).toBe('none');
    expect(desktop(myChord, { name: 'library' })).toBe('sidebar');
    expect(mobile({ name: 'library' }, myChord)).toBe('none');
    expect(libraryIsStep(myChord)).toBe(true);
  });

  /* The library is a destination from the tab bar but a STEP when reached from
     the chord editor's "All 48" — and a tab bar there invites you to walk out
     of the song you are part-way through building. */
  it('treats the library as a step when it was opened from the editor', () => {
    expect(mobile(library, editor)).toBe('none');
    expect(mobile(library, song)).toBe('none');
    expect(mobile(library, LANDING)).toBe('tabs');
    // A deep link with nothing underneath is a destination.
    expect(mobile(library, undefined)).toBe('tabs');
  });

  /* Same rule decides who owns the way out. A Back button on the library as a
     destination pops to the landing page, which reads as the app losing your
     place rather than as going back. */
  it('gives Back to the library only when it is a step', () => {
    expect(libraryIsStep(editor)).toBe(true);
    expect(libraryIsStep(song)).toBe(true);
    expect(libraryIsStep(LANDING)).toBe(false);
    expect(libraryIsStep(undefined)).toBe(false);
  });

  it('keeps the sidebar on desktop, except in full screen', () => {
    expect(desktop(LANDING)).toBe('sidebar');
    expect(desktop(song)).toBe('sidebar');
    expect(desktop(library, editor)).toBe('sidebar');
    expect(desktop(allSongs)).toBe('sidebar');
    expect(desktop(playlistAdd, playlist)).toBe('sidebar');
    expect(desktop(full)).toBe('none');
  });

  /* Full screen is for reading while you play: no navigation at all. */
  it('strips all chrome in full screen on both sizes', () => {
    expect(mobile(full)).toBe('none');
    expect(desktop(full)).toBe('none');
  });
});
