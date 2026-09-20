import { useCallback, useEffect, useState } from 'react';
import { RECENT_KEY, bumpRecent, parseRecent } from '../lib/recent';

function load(): readonly string[] {
  try {
    return parseRecent(window.localStorage.getItem(RECENT_KEY));
  } catch {
    return [];
  }
}

/**
 * The ids of the songs opened last, newest first, kept on this device. The
 * rules are in `lib/recent.ts`; this only holds the list and writes it down.
 */
export function useRecent() {
  const [recent, setRecent] = useState(load);

  useEffect(() => {
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    } catch {
      // Private mode or a full quota: the order is still right until the tab closes.
    }
  }, [recent]);

  const opened = useCallback((id: string) => setRecent((r) => bumpRecent(r, id)), []);

  return { recent, opened };
}
