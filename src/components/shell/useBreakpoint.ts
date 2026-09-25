import { useEffect, useState } from 'react';

/** Design frames are 390 and 1280; the shell switches between them here. */
export const DESKTOP_MIN = 1024;

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia(`(min-width: ${DESKTOP_MIN}px)`).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_MIN}px)`);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
}

/**
 * Room for two pages of a song side by side: wide, and tall enough that each
 * page holds a verse. A phone on its side is wide but not tall, and a split
 * there is two slivers — so it keeps the one column.
 */
const WIDE_PAGES = '(min-width: 900px) and (min-height: 560px)';

export function useTwoPagesFit(): boolean {
  const [fits, setFits] = useState(() => window.matchMedia(WIDE_PAGES).matches);

  useEffect(() => {
    const mq = window.matchMedia(WIDE_PAGES);
    const onChange = (e: MediaQueryListEvent) => setFits(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return fits;
}
