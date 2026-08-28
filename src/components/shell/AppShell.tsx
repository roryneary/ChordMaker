import type { ReactNode } from 'react';
import type { Route } from '../../app/routes';
import type { Song } from '../../types/song';
import Sidebar from './Sidebar';
import TabBar from './TabBar';
import { useIsDesktop } from './useBreakpoint';

interface Props {
  route: Route;
  /** The screen beneath this one, which decides whether the library is a
      destination or a step inside an editing flow. */
  previous?: Route;
  songs: Song[];
  currentId: string | null;
  onGo: (route: Route) => void;
  onStart: () => void;
  children: ReactNode;
}

/**
 * Which chrome a screen gets, if any.
 *
 * The tab bar shows on browsing screens only; editing screens and full screen
 * get none. Full screen gets none on desktop either — it is for reading while
 * you play, so it keeps no navigation at all.
 *
 * The library is both things depending on how you got there. Opened from the
 * tab bar it is a destination. Opened from the chord editor's "All 48" it is a
 * step in building a song, and a tab bar there is an invitation to walk out of
 * the song mid-edit — so it gets the screen's own Back button instead.
 */
/**
 * Whether the library is a step inside an editing flow rather than a place you
 * navigated to. It decides both the chrome and who owns the way out: a step
 * leaves by its own Back button, a destination by the tab bar or the sidebar.
 */
export function libraryIsStep(previous?: Route): boolean {
  return !!previous && previous.name !== 'landing';
}

export function chromeFor(
  route: Route,
  isDesktop: boolean,
  previous?: Route,
): 'sidebar' | 'tabs' | 'none' {
  if (route.name === 'fullScreen') return 'none';
  if (isDesktop) return 'sidebar';
  if (route.name === 'landing') return 'tabs';
  if (route.name === 'library') return libraryIsStep(previous) ? 'none' : 'tabs';
  return 'none';
}

export default function AppShell({
  route,
  previous,
  songs,
  currentId,
  onGo,
  onStart,
  children,
}: Props) {
  const isDesktop = useIsDesktop();
  const chrome = chromeFor(route, isDesktop, previous);

  return (
    <div className={`shell shell-${chrome}`}>
      {chrome === 'sidebar' && (
        <Sidebar
          route={route}
          songs={songs}
          currentId={currentId}
          onGo={onGo}
          onStart={onStart}
        />
      )}
      <main className="shell-main">{children}</main>
      {chrome === 'tabs' && <TabBar route={route} onGo={onGo} onStart={onStart} />}
    </div>
  );
}
