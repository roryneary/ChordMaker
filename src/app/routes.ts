import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A handful of screens and a back-stack. No router library: this is a small state
 * machine, and the codebase carries neither a router nor a state library.
 *
 * The stack exists because full screen specifies "exit returns to the previous
 * screen, not the landing page" — that cannot be derived from the route alone.
 */
export type Route =
  | { name: 'landing' }
  /* A chord in a song. There used to be a song-less form of this route for
     "Just one chord"; it saved to a store nothing read. `myChord` below is
     what that should have been: a chord with no song, kept in a library the
     Chords tab shows. */
  | { name: 'chordEditor'; songId: string; chordId: string | null }
  | { name: 'words'; songId: string }
  | { name: 'song'; songId: string }
  | { name: 'fullScreen'; songId: string }
  | { name: 'ready'; songId: string }
  | { name: 'library' }
  /** One of My chords in the editor: a new one, or one already kept. */
  | { name: 'myChord'; chordId: string | null }
  /** Every song. Plural, and nothing to do with `song` below it. */
  | { name: 'songs' }
  /** Every playlist, then one of them, then the step that adds songs to it. */
  | { name: 'playlists' }
  | { name: 'playlist'; playlistId: string }
  | { name: 'playlistAdd'; playlistId: string }
  /* Songs other people have shared, then one of them — which is also where a
     link sent to the band lands. Not under `library`: that is the chord library. */
  | { name: 'shared' }
  | { name: 'sharedSong'; shareId: string }
  | { name: 'signIn' };

export const LANDING: Route = { name: 'landing' };

export function toHash(route: Route): string {
  switch (route.name) {
    case 'landing':
      return '#/';
    case 'library':
      return '#/library';
    // Under the library, where it lives. Not `#/chords/...`: that is one letter
    // from `#/chord/new`, which is the retired song-less editor and goes home.
    case 'myChord':
      return `#/library/chord/${route.chordId ?? 'new'}`;
    case 'songs':
      return '#/songs';
    case 'playlists':
      return '#/playlists';
    case 'playlist':
      return `#/playlist/${route.playlistId}`;
    case 'playlistAdd':
      return `#/playlist/${route.playlistId}/add`;
    case 'shared':
      return '#/shared';
    case 'sharedSong':
      return `#/shared/${route.shareId}`;
    case 'signIn':
      return '#/signin';
    case 'chordEditor':
      return `#/chord/${route.songId}/${route.chordId ?? 'new'}`;
    case 'words':
      return `#/song/${route.songId}/words`;
    case 'fullScreen':
      return `#/song/${route.songId}/full`;
    case 'ready':
      return `#/song/${route.songId}/ready`;
    case 'song':
      return `#/song/${route.songId}`;
  }
}

export function fromHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (!parts.length) return LANDING;

  if (parts[0] === 'library' && parts[1] === 'chord' && parts[2]) {
    return { name: 'myChord', chordId: parts[2] === 'new' ? null : parts[2] };
  }
  if (parts[0] === 'library') return { name: 'library' };
  if (parts[0] === 'songs') return { name: 'songs' };
  if (parts[0] === 'playlists') return { name: 'playlists' };
  if (parts[0] === 'playlist' && parts[1]) {
    const playlistId = parts[1];
    return parts[2] === 'add' ? { name: 'playlistAdd', playlistId } : { name: 'playlist', playlistId };
  }
  if (parts[0] === 'shared') {
    return parts[1] ? { name: 'sharedSong', shareId: parts[1] } : { name: 'shared' };
  }
  if (parts[0] === 'signin') return { name: 'signIn' };

  // `#/chord/new/new` was the song-less editor. A bookmark to it lands home.
  if (parts[0] === 'chord' && parts[1] && parts[1] !== 'new') {
    const chordId = parts[2] && parts[2] !== 'new' ? parts[2] : null;
    return { name: 'chordEditor', songId: parts[1], chordId };
  }

  if (parts[0] === 'song' && parts[1]) {
    const songId = parts[1];
    if (parts[2] === 'words') return { name: 'words', songId };
    if (parts[2] === 'full') return { name: 'fullScreen', songId };
    if (parts[2] === 'ready') return { name: 'ready', songId };
    return { name: 'song', songId };
  }

  return LANDING;
}

const sameRoute = (a: Route, b: Route) => toHash(a) === toHash(b);

/**
 * Replaces the top of the stack — but replacing it with the screen already
 * underneath pops onto that instead. Without this, the chord editor saving
 * back to the song it belongs to leaves the song on the stack twice, and Back
 * from the song looks like it has done nothing.
 */
export function replaceTop(stack: Route[], next: Route): Route[] {
  const under = stack[stack.length - 2];
  if (under && sameRoute(under, next)) return stack.slice(0, -1);
  return [...stack.slice(0, -1), next];
}

/**
 * The song we are inside, or null once we have walked out of it. Not just "the
 * route's songId": the chord library opened from the editor, and the sign-in
 * opened from sharing, are steps taken from within a song and name none — so
 * those are looked through to whatever they were opened from.
 *
 * `myChord` is looked through as well. It is only offered from the Chords tab,
 * which is not inside a song; but the answer here decides whether a blank song
 * is thrown away, so it does not rest on that staying true.
 */
export function openSongId(stack: readonly Route[]): string | null {
  for (let i = stack.length - 1; i >= 0; i--) {
    const route = stack[i];
    if (route.name === 'library' || route.name === 'signIn' || route.name === 'myChord') continue;
    return 'songId' in route ? route.songId : null;
  }
  return null;
}

export function useRoute() {
  const [stack, setStack] = useState<Route[]>(() => {
    const initial = fromHash(window.location.hash);
    return sameRoute(initial, LANDING) ? [LANDING] : [LANDING, initial];
  });

  const route = stack[stack.length - 1];
  // Lets the hashchange listener tell our own writes apart from a real Back.
  const writing = useRef(false);

  useEffect(() => {
    const next = toHash(route);
    if (window.location.hash !== next) {
      writing.current = true;
      window.location.hash = next;
    }
  }, [route]);

  useEffect(() => {
    const onHashChange = () => {
      if (writing.current) {
        writing.current = false;
        return;
      }
      const target = fromHash(window.location.hash);
      setStack((s) => {
        if (sameRoute(target, s[s.length - 1])) return s;
        // Browser Back onto the screen we came from pops rather than pushes,
        // so the stack does not grow every time someone reverses.
        if (s.length > 1 && sameRoute(target, s[s.length - 2])) return s.slice(0, -1);
        return [...s, target];
      });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const go = useCallback((next: Route) => {
    setStack((s) => (sameRoute(next, s[s.length - 1]) ? s : [...s, next]));
  }, []);

  /** Replaces the current entry — for steps in a flow you should not reverse into. */
  const replace = useCallback((next: Route) => {
    setStack((s) => replaceTop(s, next));
  }, []);

  const back = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  const reset = useCallback((next: Route = LANDING) => setStack([next]), []);

  return { route, stack, go, replace, back, reset, canGoBack: stack.length > 1 };
}
