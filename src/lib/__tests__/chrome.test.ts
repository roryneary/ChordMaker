import { describe, expect, it } from 'vitest';
import { chromeFor, libraryIsStep } from '../../components/shell/AppShell';
import { LANDING, type Route } from '../../app/routes';

const song: Route = { name: 'song', songId: 's1' };
const editor: Route = { name: 'chordEditor', songId: 's1', chordId: null };
const library: Route = { name: 'library' };
const full: Route = { name: 'fullScreen', songId: 's1' };

const mobile = (route: Route, previous?: Route) => chromeFor(route, false, previous);
const desktop = (route: Route, previous?: Route) => chromeFor(route, true, previous);

describe('which chrome a screen gets', () => {
  it('gives mobile browsing screens the tab bar', () => {
    expect(mobile(LANDING)).toBe('tabs');
    expect(mobile(library, LANDING)).toBe('tabs');
  });

  /* While editing one song you are not navigating, and the tab bar competes
     with the screen's primary action. */
  it('withholds the tab bar from every editing screen', () => {
    expect(mobile(song)).toBe('none');
    expect(mobile(editor)).toBe('none');
    expect(mobile({ name: 'words', songId: 's1' })).toBe('none');
    expect(mobile({ name: 'ready', songId: 's1' })).toBe('none');
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
    expect(desktop(full)).toBe('none');
  });

  /* Full screen is for reading while you play: no navigation at all. */
  it('strips all chrome in full screen on both sizes', () => {
    expect(mobile(full)).toBe('none');
    expect(desktop(full)).toBe('none');
  });
});
