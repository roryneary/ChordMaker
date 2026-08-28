import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Six screens and a back-stack. No router library: this is a small state
 * machine, and the codebase carries neither a router nor a state library.
 *
 * The stack exists because full screen specifies "exit returns to the previous
 * screen, not the landing page" — that cannot be derived from the route alone.
 */
export type Route =
  | { name: 'landing' }
  | { name: 'chordEditor'; songId: string | null; chordId: string | null }
  | { name: 'words'; songId: string }
  | { name: 'song'; songId: string }
  | { name: 'fullScreen'; songId: string }
  | { name: 'ready'; songId: string }
  | { name: 'library' };

export const LANDING: Route = { name: 'landing' };

export function toHash(route: Route): string {
  switch (route.name) {
    case 'landing':
      return '#/';
    case 'library':
      return '#/library';
    case 'chordEditor':
      return `#/chord/${route.songId ?? 'new'}/${route.chordId ?? 'new'}`;
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

  if (parts[0] === 'library') return { name: 'library' };

  if (parts[0] === 'chord') {
    const songId = parts[1] && parts[1] !== 'new' ? parts[1] : null;
    const chordId = parts[2] && parts[2] !== 'new' ? parts[2] : null;
    return { name: 'chordEditor', songId, chordId };
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
